import { Request, Response } from 'express'
import { Prisma, RecurringFrequency, TransactionType } from '@prisma/client'
import { prisma } from '../config/db.js'
import {
  createRecurringSchema,
  updateRecurringSchema
} from '../validations/recurring.validation.js'

/**
 * Computes next run date accurately handling leap years and variable month lengths.
 * E.g. A monthly schedule started on Jan 31 will produce:
 * Feb 28 (or 29) -> Mar 31 -> Apr 30 -> May 31.
 */
export function computeNextRunDate(
  currentRunDate: Date,
  frequency: RecurringFrequency,
  targetDayOfMonth?: number
): Date {
  const current = new Date(currentRunDate)

  if (frequency === 'DAILY') {
    const next = new Date(current)
    next.setUTCDate(next.getUTCDate() + 1)
    return next
  }

  if (frequency === 'WEEKLY') {
    const next = new Date(current)
    next.setUTCDate(next.getUTCDate() + 7)
    return next
  }

  if (frequency === 'MONTHLY') {
    const originalTargetDay = targetDayOfMonth ?? current.getUTCDate()
    let nextYear = current.getUTCFullYear()
    let nextMonth = current.getUTCMonth() + 1
    if (nextMonth > 11) {
      nextMonth = 0
      nextYear += 1
    }

    // Number of days in the next target month
    const daysInNextMonth = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate()
    const clampedDay = Math.min(originalTargetDay, daysInNextMonth)

    return new Date(
      Date.UTC(
        nextYear,
        nextMonth,
        clampedDay,
        current.getUTCHours(),
        current.getUTCMinutes(),
        current.getUTCSeconds(),
        current.getUTCMilliseconds()
      )
    )
  }

  // Fallback
  const fallback = new Date(current)
  fallback.setUTCDate(fallback.getUTCDate() + 1)
  return fallback
}

export async function getRecurringTransactions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id

  try {
    const recurringList = await prisma.recurringTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        wallet: {
          select: { id: true, name: true, type: true, currency: true }
        },
        category: {
          select: { id: true, name: true, color: true, icon: true }
        }
      }
    })

    const now = new Date()
    const activeCount = recurringList.filter((r) => r.isActive).length
    const dueCount = recurringList.filter(
      (r) => r.isActive && r.nextRunDate <= now && (!r.endDate || r.nextRunDate <= r.endDate)
    ).length

    res.status(200).json({
      recurring: recurringList,
      summary: {
        total: recurringList.length,
        activeCount,
        dueCount
      }
    })
  } catch (error) {
    console.error('[GetRecurring Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat jadwal transaksi rutin.'
    })
  }
}

export async function getRecurringById(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const recurring = await prisma.recurringTransaction.findFirst({
      where: { id, userId },
      include: {
        wallet: true,
        category: true
      }
    })

    if (!recurring) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Jadwal transaksi rutin tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    res.status(200).json({ recurring })
  } catch (error) {
    console.error('[GetRecurringById Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat detail transaksi rutin.'
    })
  }
}

export async function createRecurring(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = createRecurringSchema.safeParse(req.body)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data jadwal transaksi rutin tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { walletId, categoryId, type, amount, description, frequency, startDate, endDate, isActive } =
    validation.data

  try {
    // Verify wallet ownership
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId }
    })
    if (!wallet) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Dompet tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    // Verify category ownership
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

    const startDateTime = new Date(startDate)
    const endDateTime = endDate ? new Date(endDate) : null

    if (endDateTime && endDateTime < startDateTime) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Tanggal akhir tidak boleh mendahului tanggal mulai.'
      })
      return
    }

    const recurring = await prisma.recurringTransaction.create({
      data: {
        userId,
        walletId,
        categoryId,
        type: type as TransactionType,
        amount: new Prisma.Decimal(amount),
        description: description ?? null,
        frequency: frequency as RecurringFrequency,
        startDate: startDateTime,
        endDate: endDateTime,
        nextRunDate: startDateTime,
        isActive: isActive ?? true
      },
      include: {
        wallet: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, color: true } }
      }
    })

    res.status(201).json({
      message: 'Jadwal transaksi rutin berhasil dibuat.',
      recurring
    })
  } catch (error) {
    console.error('[CreateRecurring Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal membuat jadwal transaksi rutin.'
    })
  }
}

export async function updateRecurring(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  const validation = updateRecurringSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data pembaruan jadwal transaksi rutin tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  try {
    const existing = await prisma.recurringTransaction.findFirst({
      where: { id, userId }
    })

    if (!existing) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Jadwal transaksi rutin tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    const { walletId, categoryId, type, amount, description, frequency, startDate, endDate, isActive } =
      validation.data

    if (walletId) {
      const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId } })
      if (!wallet) {
        res.status(404).json({ error: 'Not Found', message: 'Dompet tidak ditemukan.' })
        return
      }
    }

    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId } })
      if (!category) {
        res.status(404).json({ error: 'Not Found', message: 'Kategori tidak ditemukan.' })
        return
      }
    }

    const updateData: Prisma.RecurringTransactionUpdateInput = {}
    if (walletId) updateData.wallet = { connect: { id: walletId } }
    if (categoryId) updateData.category = { connect: { id: categoryId } }
    if (type) updateData.type = type as TransactionType
    if (amount !== undefined) updateData.amount = new Prisma.Decimal(amount)
    if (description !== undefined) updateData.description = description
    if (frequency) updateData.frequency = frequency as RecurringFrequency
    if (startDate) {
      const newStart = new Date(startDate)
      updateData.startDate = newStart
      // If schedule hasn't run yet, update nextRunDate as well
      if (!existing.lastProcessedDate) {
        updateData.nextRunDate = newStart
      }
    }
    if (endDate !== undefined) {
      updateData.endDate = endDate ? new Date(endDate) : null
    }
    if (isActive !== undefined) updateData.isActive = isActive

    const updated = await prisma.recurringTransaction.update({
      where: { id },
      data: updateData,
      include: {
        wallet: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, color: true } }
      }
    })

    res.status(200).json({
      message: 'Jadwal transaksi rutin berhasil diperbarui.',
      recurring: updated
    })
  } catch (error) {
    console.error('[UpdateRecurring Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memperbarui jadwal transaksi rutin.'
    })
  }
}

export async function toggleRecurring(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const existing = await prisma.recurringTransaction.findFirst({
      where: { id, userId }
    })

    if (!existing) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Jadwal transaksi rutin tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    const newActiveState = typeof req.body.isActive === 'boolean' ? req.body.isActive : !existing.isActive

    const updated = await prisma.recurringTransaction.update({
      where: { id },
      data: { isActive: newActiveState },
      include: {
        wallet: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } }
      }
    })

    res.status(200).json({
      message: `Jadwal transaksi rutin berhasil ${newActiveState ? 'diaktifkan' : 'dijeda'}.`,
      recurring: updated
    })
  } catch (error) {
    console.error('[ToggleRecurring Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal mengubah status jadwal transaksi rutin.'
    })
  }
}

export async function deleteRecurring(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const existing = await prisma.recurringTransaction.findFirst({
      where: { id, userId }
    })

    if (!existing) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Jadwal transaksi rutin tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    await prisma.recurringTransaction.delete({
      where: { id }
    })

    res.status(200).json({
      message: 'Jadwal transaksi rutin berhasil dihapus.'
    })
  } catch (error) {
    console.error('[DeleteRecurring Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal menghapus jadwal transaksi rutin.'
    })
  }
}

/**
 * Idempotent execution engine for due recurring transactions.
 * Atomically creates Transaction, updates Wallet balance, and advances nextRunDate.
 */
export async function processDueRecurring(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const now = new Date()

  try {
    const dueItems = await prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        nextRunDate: { lte: now }
      },
      include: {
        wallet: true
      }
    })

    if (dueItems.length === 0) {
      res.status(200).json({
        message: 'Tidak ada transaksi rutin yang jatuh tempo saat ini.',
        processedCount: 0,
        results: []
      })
      return
    }

    type ProcessResult = {
      id: string
      description: string | null
      amount: number
      status: 'PROCESSED' | 'SKIPPED_EXPIRED' | 'SKIPPED_INSUFFICIENT_FUNDS'
    }

    const results: ProcessResult[] = []

    // Process each due item atomically
    for (const item of dueItems) {
      if (item.endDate && item.nextRunDate > item.endDate) {
        await prisma.recurringTransaction.update({
          where: { id: item.id },
          data: { isActive: false }
        })
        results.push({
          id: item.id,
          description: item.description,
          amount: item.amount.toNumber(),
          status: 'SKIPPED_EXPIRED'
        })
        continue
      }

      await prisma.$transaction(async (tx) => {
        // Double check wallet balance if EXPENSE
        if (item.type === 'EXPENSE') {
          const freshWallet = await tx.wallet.findUnique({
            where: { id: item.walletId }
          })
          if (!freshWallet || freshWallet.balance.lessThan(item.amount)) {
            results.push({
              id: item.id,
              description: item.description,
              amount: item.amount.toNumber(),
              status: 'SKIPPED_INSUFFICIENT_FUNDS'
            })
            return
          }
        }

        // 1. Create Transaction
        await tx.transaction.create({
          data: {
            userId,
            walletId: item.walletId,
            categoryId: item.categoryId,
            type: item.type,
            amount: item.amount,
            description: item.description ? `[Rutin] ${item.description}` : `[Rutin] Transaksi Otomatis`,
            date: item.nextRunDate
          }
        })

        // 2. Atomically mutate Wallet balance
        if (item.type === 'INCOME') {
          await tx.wallet.update({
            where: { id: item.walletId },
            data: { balance: { increment: item.amount } }
          })
        } else {
          await tx.wallet.update({
            where: { id: item.walletId },
            data: { balance: { decrement: item.amount } }
          })
        }

        // 3. Advance nextRunDate safely
        const originalDay = new Date(item.startDate).getUTCDate()
        const nextDate = computeNextRunDate(item.nextRunDate, item.frequency, originalDay)
        const isExpired = Boolean(item.endDate && nextDate > item.endDate)

        await tx.recurringTransaction.update({
          where: { id: item.id },
          data: {
            lastProcessedDate: new Date(),
            nextRunDate: nextDate,
            isActive: isExpired ? false : item.isActive
          }
        })

        results.push({
          id: item.id,
          description: item.description,
          amount: item.amount.toNumber(),
          status: 'PROCESSED'
        })
      })
    }

    const processedCount = results.filter((r) => r.status === 'PROCESSED').length

    res.status(200).json({
      message: `Pemrosesan selesai. ${processedCount} transaksi berhasil dieksekusi.`,
      processedCount,
      results
    })
  } catch (error) {
    console.error('[ProcessDueRecurring Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memproses transaksi rutin jatuh tempo.'
    })
  }
}
