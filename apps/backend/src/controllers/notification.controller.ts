import { Request, Response } from 'express'
import { prisma } from '../config/db.js'

/**
 * Synchronizes real in-app system alerts from database data
 * Strictly idempotent: prevents duplicate notifications on repeated requests or refreshes
 */
async function syncSystemAlerts(userId: string): Promise<void> {
  const now = new Date()
  const currentPeriod = now.toISOString().substring(0, 7) // "YYYY-MM"

  // Start & End of current month in UTC
  const [yearStr, monthStr] = currentPeriod.split('-')
  const startOfMonth = new Date(Date.UTC(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1))
  const endOfMonth = new Date(Date.UTC(parseInt(yearStr, 10), parseInt(monthStr, 10), 1))

  try {
    // ── 1. Check Budget Limits ────────────────────────────────────────────────
    const budgets = await prisma.budget.findMany({
      where: { userId, period: currentPeriod },
      include: { category: true }
    })

    if (budgets.length > 0) {
      for (const budget of budgets) {
        // Aggregate actual expenses for this category in the current month
        const expenseAgg = await prisma.transaction.aggregate({
          where: {
            userId,
            categoryId: budget.categoryId,
            type: 'EXPENSE',
            date: {
              gte: startOfMonth,
              lt: endOfMonth
            }
          },
          _sum: { amount: true }
        })

        const spent = Number(expenseAgg._sum.amount || 0)
        const limit = Number(budget.amount)

        if (limit > 0) {
          if (spent >= limit) {
            // Check if already notified for this budget in the current month
            const existing = await prisma.notification.findFirst({
              where: {
                userId,
                type: 'BUDGET_EXCEEDED',
                message: { contains: budget.category.name },
                createdAt: { gte: startOfMonth }
              }
            })

            if (!existing) {
              await prisma.notification.create({
                data: {
                  userId,
                  title: 'Batas Anggaran Terlampaui',
                  message: `Pengeluaran untuk kategori "${budget.category.name}" telah melampaui batas anggaran (Rp${spent.toLocaleString('id-ID')} dari Rp${limit.toLocaleString('id-ID')}).`,
                  type: 'BUDGET_EXCEEDED',
                  link: '/budgets',
                  isRead: false
                }
              })
            }
          } else if (spent >= 0.8 * limit) {
            // Check if already notified warning for this budget in the current month
            const existing = await prisma.notification.findFirst({
              where: {
                userId,
                type: 'BUDGET_WARNING',
                message: { contains: budget.category.name },
                createdAt: { gte: startOfMonth }
              }
            })

            if (!existing) {
              await prisma.notification.create({
                data: {
                  userId,
                  title: 'Peringatan Anggaran Mendekati Batas',
                  message: `Pengeluaran untuk kategori "${budget.category.name}" telah mencapai ${(Math.round((spent / limit) * 100))}% dari batas anggaran bulanan Anda.`,
                  type: 'BUDGET_WARNING',
                  link: '/budgets',
                  isRead: false
                }
              })
            }
          }
        }
      }
    }

    // ── 2. Check Recurring Transactions Due ──────────────────────────────────
    const dueRecurring = await prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        nextRunDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }]
      },
      include: { wallet: true }
    })

    if (dueRecurring.length > 0) {
      // Look back 24 hours to avoid duplicate recurring notifications
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      for (const rec of dueRecurring) {
        const itemDesc = rec.description || 'Transaksi Rutin'
        const existing = await prisma.notification.findFirst({
          where: {
            userId,
            type: 'RECURRING_DUE',
            message: { contains: itemDesc },
            createdAt: { gte: oneDayAgo },
            isRead: false
          }
        })

        if (!existing) {
          const nominal = Number(rec.amount).toLocaleString('id-ID')
          await prisma.notification.create({
            data: {
              userId,
              title: 'Transaksi Rutin Jatuh Tempo',
              message: `Jadwal "${itemDesc}" sebesar Rp${nominal} pada dompet ${rec.wallet.name} telah jatuh tempo dan siap diproses.`,
              type: 'RECURRING_DUE',
              link: '/recurring',
              isRead: false
            }
          })
        }
      }
    }
  } catch (syncError) {
    console.error('[Notification Sync Warning]:', syncError)
  }
}

/**
 * GET /api/notifications
 * Returns list of notifications and total unread count
 */
export async function getNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Autentikasi diperlukan.' })
    return
  }

  try {
    // Run real alert evaluation
    await syncSystemAlerts(userId)

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30
      }),
      prisma.notification.count({
        where: { userId, isRead: false }
      })
    ])

    res.status(200).json({
      notifications,
      unreadCount
    })
  } catch (error) {
    console.error('[Get Notifications Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal mengambil daftar notifikasi.'
    })
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read
 */
export async function markAsRead(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id
  const { id } = req.params

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Autentikasi diperlukan.' })
    return
  }

  try {
    const notification = await prisma.notification.findFirst({
      where: { id, userId }
    })

    if (!notification) {
      res.status(404).json({ error: 'Not Found', message: 'Notifikasi tidak ditemukan.' })
      return
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    })

    res.status(200).json({
      message: 'Notifikasi ditandai sebagai dibaca.',
      notification: updated
    })
  } catch (error) {
    console.error('[Mark Read Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memperbarui status notifikasi.'
    })
  }
}

/**
 * POST /api/notifications/read-all
 * Marks all notifications for current user as read
 */
export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Autentikasi diperlukan.' })
    return
  }

  try {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    })

    res.status(200).json({
      message: 'Semua notifikasi berhasil ditandai sebagai dibaca.'
    })
  } catch (error) {
    console.error('[Mark All Read Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memperbarui status notifikasi.'
    })
  }
}

/**
 * DELETE /api/notifications/:id
 * Deletes a notification belonging to the current user
 */
export async function deleteNotification(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id
  const { id } = req.params

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Autentikasi diperlukan.' })
    return
  }

  try {
    const notification = await prisma.notification.findFirst({
      where: { id, userId }
    })

    if (!notification) {
      res.status(404).json({ error: 'Not Found', message: 'Notifikasi tidak ditemukan.' })
      return
    }

    await prisma.notification.delete({
      where: { id }
    })

    res.status(200).json({
      message: 'Notifikasi berhasil dihapus.'
    })
  } catch (error) {
    console.error('[Delete Notification Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal menghapus notifikasi.'
    })
  }
}
