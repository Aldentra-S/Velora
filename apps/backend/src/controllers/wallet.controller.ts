import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/db.js'
import { createWalletSchema, updateWalletSchema } from '../validations/finance.validation.js'

export async function getWallets(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id

  try {
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            transactions: true,
            transfersFrom: true,
            transfersTo: true,
            recurringTransactions: true
          }
        }
      }
    })

    res.status(200).json({ wallets })
  } catch (error) {
    console.error('[GetWallets Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat daftar dompet.'
    })
  }
}

export async function getWalletById(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const wallet = await prisma.wallet.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: {
            transactions: true,
            transfersFrom: true,
            transfersTo: true,
            recurringTransactions: true
          }
        }
      }
    })

    if (!wallet) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Dompet tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    res.status(200).json({ wallet })
  } catch (error) {
    console.error('[GetWalletById Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal mengambil detail dompet.'
    })
  }
}

export async function getWalletHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const wallet = await prisma.wallet.findFirst({
      where: { id, userId }
    })

    if (!wallet) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Dompet tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    // Get recent transactions for this wallet
    const transactions = await prisma.transaction.findMany({
      where: { walletId: id, userId },
      orderBy: { date: 'desc' },
      take: 50,
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } }
      }
    })

    // Get recent transfers involving this wallet
    const transfers = await prisma.transfer.findMany({
      where: {
        userId,
        OR: [{ fromWalletId: id }, { toWalletId: id }]
      },
      orderBy: { date: 'desc' },
      take: 50,
      include: {
        fromWallet: { select: { id: true, name: true } },
        toWallet: { select: { id: true, name: true } }
      }
    })

    res.status(200).json({
      wallet,
      transactions,
      transfers
    })
  } catch (error) {
    console.error('[GetWalletHistory Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat riwayat transaksi dompet.'
    })
  }
}

export async function createWallet(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = createWalletSchema.safeParse(req.body)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data dompet tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { name, type, initialBalance, currency, description } = validation.data

  try {
    const wallet = await prisma.wallet.create({
      data: {
        userId,
        name,
        type,
        balance: new Prisma.Decimal(initialBalance),
        currency,
        description: description ?? null
      }
    })

    res.status(201).json({
      message: 'Dompet berhasil dibuat.',
      wallet
    })
  } catch (error) {
    console.error('[CreateWallet Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal membuat dompet baru.'
    })
  }
}

export async function updateWallet(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  const validation = updateWalletSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data pembaruan dompet tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  try {
    const existingWallet = await prisma.wallet.findFirst({
      where: { id, userId }
    })

    if (!existingWallet) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Dompet tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    const updatedWallet = await prisma.wallet.update({
      where: { id },
      data: validation.data
    })

    res.status(200).json({
      message: 'Dompet berhasil diperbarui.',
      wallet: updatedWallet
    })
  } catch (error) {
    console.error('[UpdateWallet Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memperbarui dompet.'
    })
  }
}

export async function deleteWallet(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const existingWallet = await prisma.wallet.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: {
            transactions: true,
            transfersFrom: true,
            transfersTo: true,
            recurringTransactions: true
          }
        }
      }
    })

    if (!existingWallet) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Dompet tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    if (existingWallet._count.transactions > 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Dompet tidak dapat dihapus karena masih memiliki riwayat transaksi tercatat. Hapus transaksi terkait terlebih dahulu atau pertahankan dompet ini.'
      })
      return
    }

    if (existingWallet._count.transfersFrom > 0 || existingWallet._count.transfersTo > 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Dompet tidak dapat dihapus karena masih memiliki riwayat transfer antardompet yang tercatat.'
      })
      return
    }

    if (existingWallet._count.recurringTransactions > 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Dompet tidak dapat dihapus karena masih terhubung dengan jadwal transaksi rutin. Hapus atau ubah jadwal transaksi rutin terlebih dahulu.'
      })
      return
    }

    await prisma.wallet.delete({
      where: { id }
    })

    res.status(200).json({
      message: 'Dompet berhasil dihapus.'
    })
  } catch (error) {
    console.error('[DeleteWallet Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal menghapus dompet.'
    })
  }
}
