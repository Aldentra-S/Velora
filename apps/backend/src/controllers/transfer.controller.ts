import { Request, Response } from 'express'
import { Prisma, TransferStatus } from '@prisma/client'
import { prisma } from '../config/db.js'
import {
  createTransferSchema,
  transferQuerySchema
} from '../validations/transfer.validation.js'

export async function createTransfer(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = createTransferSchema.safeParse(req.body)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data transfer tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { fromWalletId, toWalletId, amount, notes, date } = validation.data
  const decimalAmount = new Prisma.Decimal(amount)

  try {
    // 1. Verify ownership of both wallets
    const [fromWallet, toWallet] = await Promise.all([
      prisma.wallet.findFirst({ where: { id: fromWalletId, userId } }),
      prisma.wallet.findFirst({ where: { id: toWalletId, userId } })
    ])

    if (!fromWallet) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Dompet asal tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    if (!toWallet) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Dompet tujuan tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    // Quick pre-check on balance (detailed atomic check handled inside transaction)
    if (fromWallet.balance.lessThan(decimalAmount)) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Saldo dompet '${fromWallet.name}' tidak mencukupi untuk transfer nominal ini.`
      })
      return
    }

    // 2. Atomic Transaction with Conditional Update
    const result = await prisma.$transaction(async (tx) => {
      // Atomic Conditional Decrement: PostgreSQL row lock & balance guard
      const deductResult = await tx.wallet.updateMany({
        where: {
          id: fromWalletId,
          userId,
          balance: { gte: decimalAmount }
        },
        data: {
          balance: { decrement: decimalAmount }
        }
      })

      if (deductResult.count === 0) {
        throw new Error('INSUFFICIENT_BALANCE')
      }

      // Atomic Increment on destination wallet
      const updatedTo = await tx.wallet.update({
        where: { id: toWalletId },
        data: {
          balance: { increment: decimalAmount }
        }
      })

      // Create Transfer record
      const transfer = await tx.transfer.create({
        data: {
          userId,
          fromWalletId,
          toWalletId,
          amount: decimalAmount,
          notes: notes || null,
          status: TransferStatus.COMPLETED,
          date: date ? new Date(date) : new Date()
        },
        include: {
          fromWallet: {
            select: { id: true, name: true, currency: true }
          },
          toWallet: {
            select: { id: true, name: true, currency: true }
          }
        }
      })

      // Fetch fresh balance of source wallet
      const updatedFrom = await tx.wallet.findUniqueOrThrow({
        where: { id: fromWalletId }
      })

      return {
        transfer,
        balances: {
          fromWallet: {
            id: updatedFrom.id,
            name: updatedFrom.name,
            balance: updatedFrom.balance.toString()
          },
          toWallet: {
            id: updatedTo.id,
            name: updatedTo.name,
            balance: updatedTo.balance.toString()
          }
        }
      }
    })

    res.status(201).json({
      message: 'Transfer antardompet berhasil dicatat.',
      transfer: {
        id: result.transfer.id,
        fromWalletId: result.transfer.fromWalletId,
        toWalletId: result.transfer.toWalletId,
        amount: result.transfer.amount.toString(),
        notes: result.transfer.notes,
        status: result.transfer.status,
        date: result.transfer.date,
        cancelledAt: result.transfer.cancelledAt,
        createdAt: result.transfer.createdAt,
        updatedAt: result.transfer.updatedAt,
        fromWallet: result.transfer.fromWallet,
        toWallet: result.transfer.toWallet
      },
      balances: result.balances
    })
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Saldo dompet asal tidak mencukupi untuk melakukan transfer.'
      })
      return
    }

    console.error('[CreateTransfer Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal mencatat transfer antardompet.'
    })
  }
}

export async function getTransfers(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = transferQuerySchema.safeParse(req.query)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Parameter filter transfer tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { page, limit, walletId, status, startDate, endDate } = validation.data
  const skip = (page - 1) * limit

  try {
    const where: Prisma.TransferWhereInput = { userId }

    if (walletId) {
      where.OR = [{ fromWalletId: walletId }, { toWalletId: walletId }]
    }

    if (status && status !== 'ALL') {
      where.status = status as TransferStatus
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    const [total, rawTransfers] = await prisma.$transaction([
      prisma.transfer.count({ where }),
      prisma.transfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          fromWallet: {
            select: { id: true, name: true, type: true, currency: true }
          },
          toWallet: {
            select: { id: true, name: true, type: true, currency: true }
          }
        }
      })
    ])

    const transfers = rawTransfers.map((t) => ({
      id: t.id,
      fromWalletId: t.fromWalletId,
      toWalletId: t.toWalletId,
      amount: t.amount.toString(),
      notes: t.notes,
      status: t.status,
      date: t.date,
      cancelledAt: t.cancelledAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      fromWallet: t.fromWallet,
      toWallet: t.toWallet
    }))

    const totalPages = Math.ceil(total / limit) || 1

    res.status(200).json({
      transfers,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    })
  } catch (error) {
    console.error('[GetTransfers Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat daftar riwayat transfer.'
    })
  }
}

export async function getTransferById(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const transfer = await prisma.transfer.findFirst({
      where: { id, userId },
      include: {
        fromWallet: {
          select: { id: true, name: true, type: true, currency: true }
        },
        toWallet: {
          select: { id: true, name: true, type: true, currency: true }
        }
      }
    })

    if (!transfer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Data transfer tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    res.status(200).json({
      transfer: {
        id: transfer.id,
        fromWalletId: transfer.fromWalletId,
        toWalletId: transfer.toWalletId,
        amount: transfer.amount.toString(),
        notes: transfer.notes,
        status: transfer.status,
        date: transfer.date,
        cancelledAt: transfer.cancelledAt,
        createdAt: transfer.createdAt,
        updatedAt: transfer.updatedAt,
        fromWallet: transfer.fromWallet,
        toWallet: transfer.toWallet
      }
    })
  } catch (error) {
    console.error('[GetTransferById Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat detail transfer.'
    })
  }
}

export async function cancelTransfer(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    // 1. Initial lookup
    const existing = await prisma.transfer.findFirst({
      where: { id, userId },
      include: {
        toWallet: true
      }
    })

    if (!existing) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Data transfer tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    if (existing.status === TransferStatus.CANCELLED) {
      res.status(409).json({
        error: 'Conflict',
        message: 'Transfer ini sudah dibatalkan sebelumnya.'
      })
      return
    }

    // 2. Atomic Reversal Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Optimistic lock on transfer status to prevent race conditions on double cancellation
      const transition = await tx.transfer.updateMany({
        where: {
          id,
          userId,
          status: TransferStatus.COMPLETED
        },
        data: {
          status: TransferStatus.CANCELLED,
          cancelledAt: new Date()
        }
      })

      if (transition.count === 0) {
        throw new Error('ALREADY_CANCELLED_OR_CONFLICT')
      }

      // Atomic conditional decrement on destination wallet
      // Destination wallet must have balance >= transfer.amount
      const deductTarget = await tx.wallet.updateMany({
        where: {
          id: existing.toWalletId,
          userId,
          balance: { gte: existing.amount }
        },
        data: {
          balance: { decrement: existing.amount }
        }
      })

      if (deductTarget.count === 0) {
        throw new Error('TARGET_INSUFFICIENT_BALANCE')
      }

      // Refund source wallet
      const refundSource = await tx.wallet.update({
        where: { id: existing.fromWalletId },
        data: {
          balance: { increment: existing.amount }
        }
      })

      const updatedTarget = await tx.wallet.findUniqueOrThrow({
        where: { id: existing.toWalletId }
      })

      const updatedTransfer = await tx.transfer.findUniqueOrThrow({
        where: { id }
      })

      return {
        transfer: updatedTransfer,
        balances: {
          fromWallet: {
            id: refundSource.id,
            name: refundSource.name,
            balance: refundSource.balance.toString()
          },
          toWallet: {
            id: updatedTarget.id,
            name: updatedTarget.name,
            balance: updatedTarget.balance.toString()
          }
        }
      }
    })

    res.status(200).json({
      message: 'Transfer berhasil dibatalkan dan saldo telah dikembalikan.',
      transfer: {
        id: result.transfer.id,
        status: result.transfer.status,
        cancelledAt: result.transfer.cancelledAt
      },
      balances: result.balances
    })
  } catch (error: any) {
    if (error?.message === 'ALREADY_CANCELLED_OR_CONFLICT') {
      res.status(409).json({
        error: 'Conflict',
        message: 'Transfer ini sedang atau sudah dibatalkan oleh proses lain.'
      })
      return
    }

    if (error?.message === 'TARGET_INSUFFICIENT_BALANCE') {
      res.status(400).json({
        error: 'Bad Request',
        message:
          'Transfer tidak dapat dibatalkan karena saldo dompet penerima telah terpakai dan tidak mencukupi untuk pengembalian dana.'
      })
      return
    }

    console.error('[CancelTransfer Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal membatalkan transfer antardompet.'
    })
  }
}
