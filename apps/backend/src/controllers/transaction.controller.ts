import { Request, Response } from 'express'
import { Prisma, TransactionType } from '@prisma/client'
import { prisma } from '../config/db.js'
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionQuerySchema
} from '../validations/finance.validation.js'

export async function getTransactions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = transactionQuerySchema.safeParse(req.query)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Parameter filter transaksi tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { page, limit, walletId, categoryId, type, startDate, endDate, search, sortBy, sortOrder } = validation.data
  const skip = (page - 1) * limit

  try {
    const where: Prisma.TransactionWhereInput = { userId }

    if (walletId) where.walletId = walletId
    if (categoryId) where.categoryId = categoryId
    if (type) where.type = type

    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        const parsedStart = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`)
        if (!isNaN(parsedStart.getTime())) where.date.gte = parsedStart
      }
      if (endDate) {
        const parsedEnd = new Date(endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`)
        if (!isNaN(parsedEnd.getTime())) where.date.lte = parsedEnd
      }
    }

    if (search && search.trim() !== '') {
      const q = search.trim()
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
        { wallet: { name: { contains: q, mode: 'insensitive' } } }
      ]
    }

    const orderBy: Prisma.TransactionOrderByWithRelationInput = {
      [sortBy]: sortOrder
    }

    const [total, transactions] = await prisma.$transaction([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          wallet: {
            select: { id: true, name: true, type: true, currency: true }
          },
          category: {
            select: { id: true, name: true, type: true, color: true, icon: true }
          }
        }
      })
    ])

    const totalPages = Math.ceil(total / limit) || 1

    res.status(200).json({
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    })
  } catch (error) {
    console.error('[GetTransactions Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat daftar transaksi.'
    })
  }
}

export async function getTransactionById(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        wallet: true,
        category: true
      }
    })

    if (!transaction) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    res.status(200).json({ transaction })
  } catch (error) {
    console.error('[GetTransactionById Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat detail transaksi.'
    })
  }
}

export async function createTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = createTransactionSchema.safeParse(req.body)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data transaksi tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { walletId, categoryId, type, amount, description, date } = validation.data
  const decimalAmount = new Prisma.Decimal(amount)

  try {
    // 1. Verify wallet ownership
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId }
    })
    if (!wallet) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Dompet tujuan tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    // 2. Verify category ownership & type matching
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId }
    })
    if (!category) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Kategori tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    if (category.type !== type) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Kategori '${category.name}' adalah tipe ${category.type}, tidak cocok dengan transaksi ${type}.`
      })
      return
    }

    // 3. Atomic execution: create transaction and adjust wallet balance
    const result = await prisma.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          userId,
          walletId,
          categoryId,
          type,
          amount: decimalAmount,
          description,
          date: new Date(date)
        },
        include: {
          wallet: true,
          category: true
        }
      })

      // Balance adjustment: + for INCOME, - for EXPENSE
      const balanceChange = type === TransactionType.INCOME ? decimalAmount : decimalAmount.negated()

      const updatedWallet = await tx.wallet.update({
        where: { id: walletId },
        data: {
          balance: { increment: balanceChange }
        }
      })

      return { transaction: newTransaction, wallet: updatedWallet }
    })

    res.status(201).json({
      message: 'Transaksi berhasil dicatat.',
      transaction: result.transaction,
      updatedWallet: result.wallet
    })
  } catch (error) {
    console.error('[CreateTransaction Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal mencatat transaksi baru.'
    })
  }
}

export async function updateTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  const validation = updateTransactionSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data pembaruan transaksi tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  try {
    const existingTransaction = await prisma.transaction.findFirst({
      where: { id, userId }
    })

    if (!existingTransaction) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    const targetWalletId = validation.data.walletId || existingTransaction.walletId
    const targetCategoryId = validation.data.categoryId || existingTransaction.categoryId
    const targetType = validation.data.type || existingTransaction.type
    const targetAmount = validation.data.amount
      ? new Prisma.Decimal(validation.data.amount)
      : existingTransaction.amount

    // Verify wallet ownership if changing
    const wallet = await prisma.wallet.findFirst({
      where: { id: targetWalletId, userId }
    })
    if (!wallet) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Dompet tujuan tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    // Verify category ownership if changing
    const category = await prisma.category.findFirst({
      where: { id: targetCategoryId, userId }
    })
    if (!category) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Kategori tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    if (category.type !== targetType) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Kategori '${category.name}' adalah tipe ${category.type}, tidak cocok dengan transaksi ${targetType}.`
      })
      return
    }

    // Atomic transaction: Revert old effect, apply new effect, update record
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Revert effect on old wallet
      const oldRevert =
        existingTransaction.type === TransactionType.INCOME
          ? existingTransaction.amount.negated()
          : existingTransaction.amount

      await tx.wallet.update({
        where: { id: existingTransaction.walletId },
        data: { balance: { increment: oldRevert } }
      })

      // 2. Apply effect on new wallet
      const newApply =
        targetType === TransactionType.INCOME ? targetAmount : targetAmount.negated()

      const newWallet = await tx.wallet.update({
        where: { id: targetWalletId },
        data: { balance: { increment: newApply } }
      })

      // 3. Update transaction record
      const updatedTx = await tx.transaction.update({
        where: { id },
        data: {
          walletId: targetWalletId,
          categoryId: targetCategoryId,
          type: targetType,
          amount: targetAmount,
          description: validation.data.description ?? existingTransaction.description,
          date: validation.data.date ? new Date(validation.data.date) : existingTransaction.date
        },
        include: {
          wallet: true,
          category: true
        }
      })

      return { transaction: updatedTx, wallet: newWallet }
    })

    res.status(200).json({
      message: 'Transaksi berhasil diperbarui.',
      transaction: updated.transaction,
      updatedWallet: updated.wallet
    })
  } catch (error) {
    console.error('[UpdateTransaction Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memperbarui transaksi.'
    })
  }
}

export async function deleteTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const existingTransaction = await prisma.transaction.findFirst({
      where: { id, userId }
    })

    if (!existingTransaction) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    // Atomic: Revert wallet balance & delete transaction
    const updatedWallet = await prisma.$transaction(async (tx) => {
      const revertAmount =
        existingTransaction.type === TransactionType.INCOME
          ? existingTransaction.amount.negated()
          : existingTransaction.amount

      const wallet = await tx.wallet.update({
        where: { id: existingTransaction.walletId },
        data: {
          balance: { increment: revertAmount }
        }
      })

      await tx.transaction.delete({
        where: { id }
      })

      return wallet
    })

    res.status(200).json({
      message: 'Transaksi berhasil dihapus dan saldo telah disesuaikan.',
      updatedWallet
    })
  } catch (error) {
    console.error('[DeleteTransaction Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal menghapus transaksi.'
    })
  }
}
