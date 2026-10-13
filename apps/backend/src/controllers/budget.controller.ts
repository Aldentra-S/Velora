import { Request, Response } from 'express'
import { Prisma, TransactionType } from '@prisma/client'
import { prisma } from '../config/db.js'
import {
  createBudgetSchema,
  updateBudgetSchema,
  budgetQuerySchema
} from '../validations/budget.validation.js'

/**
 * Returns UTC boundaries for half-open interval: [startOfMonth, startOfNextMonth)
 */
function getMonthBoundaries(period: string): { startOfMonth: Date; startOfNextMonth: Date } {
  const [yearStr, monthStr] = period.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const startOfNextMonth =
    month === 12
      ? new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0))
      : new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))

  return { startOfMonth, startOfNextMonth }
}

function getDefaultPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function calculateBudgetStatus(
  limit: Prisma.Decimal,
  spent: Prisma.Decimal
): {
  remaining: Prisma.Decimal
  percentage: number
  status: 'NORMAL' | 'WARNING' | 'EXCEEDED'
} {
  const remaining = limit.minus(spent)
  const percentage = limit.isZero() ? 0 : Math.round(spent.dividedBy(limit).toNumber() * 100)

  let status: 'NORMAL' | 'WARNING' | 'EXCEEDED' = 'NORMAL'
  if (spent.greaterThan(limit)) {
    status = 'EXCEEDED'
  } else if (percentage >= 80) {
    status = 'WARNING'
  }

  return { remaining, percentage, status }
}

export async function getBudgets(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = budgetQuerySchema.safeParse(req.query)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Parameter filter periode anggaran tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const period = validation.data.period || getDefaultPeriod()
  const { startOfMonth, startOfNextMonth } = getMonthBoundaries(period)

  try {
    // 1. Fetch all budgets for user in this period
    const budgets = await prisma.budget.findMany({
      where: { userId, period },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true, type: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    if (budgets.length === 0) {
      res.status(200).json({
        period,
        summary: {
          totalLimit: '0',
          totalSpent: '0',
          totalRemaining: '0',
          percentage: 0,
          budgetCount: 0
        },
        budgets: []
      })
      return
    }

    // 2. Fetch spending aggregations in ONE single query (no N+1 query problem)
    const categoryIds = budgets.map((b) => b.categoryId)
    const spendings = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        categoryId: { in: categoryIds },
        type: TransactionType.EXPENSE,
        date: { gte: startOfMonth, lt: startOfNextMonth }
      },
      _sum: { amount: true }
    })

    const spendingMap = new Map<string, Prisma.Decimal>()
    spendings.forEach((s) => {
      spendingMap.set(s.categoryId, s._sum.amount ?? new Prisma.Decimal(0))
    })

    let totalLimit = new Prisma.Decimal(0)
    let totalSpent = new Prisma.Decimal(0)

    const budgetsWithRealization = budgets.map((b) => {
      const limit = b.amount
      const spent = spendingMap.get(b.categoryId) ?? new Prisma.Decimal(0)
      const { remaining, percentage, status } = calculateBudgetStatus(limit, spent)

      totalLimit = totalLimit.plus(limit)
      totalSpent = totalSpent.plus(spent)

      return {
        id: b.id,
        categoryId: b.categoryId,
        period: b.period,
        amount: b.amount.toString(),
        spent: spent.toString(),
        remaining: remaining.toString(),
        percentage,
        status,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        category: b.category
      }
    })

    const totalRemaining = totalLimit.minus(totalSpent)
    const totalPercentage = totalLimit.isZero()
      ? 0
      : Math.round(totalSpent.dividedBy(totalLimit).toNumber() * 100)

    res.status(200).json({
      period,
      summary: {
        totalLimit: totalLimit.toString(),
        totalSpent: totalSpent.toString(),
        totalRemaining: totalRemaining.toString(),
        percentage: totalPercentage,
        budgetCount: budgets.length
      },
      budgets: budgetsWithRealization
    })
  } catch (error) {
    console.error('[GetBudgets Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat daftar anggaran.'
    })
  }
}

export async function getBudgetSummary(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = budgetQuerySchema.safeParse(req.query)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Parameter filter periode tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const period = validation.data.period || getDefaultPeriod()
  const { startOfMonth, startOfNextMonth } = getMonthBoundaries(period)

  try {
    const budgets = await prisma.budget.findMany({
      where: { userId, period },
      select: { categoryId: true, amount: true }
    })

    if (budgets.length === 0) {
      res.status(200).json({
        summary: {
          period,
          totalLimit: '0',
          totalSpent: '0',
          totalRemaining: '0',
          percentage: 0,
          budgetCount: 0,
          exceededCount: 0,
          warningCount: 0
        }
      })
      return
    }

    const categoryIds = budgets.map((b) => b.categoryId)
    const spendings = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        categoryId: { in: categoryIds },
        type: TransactionType.EXPENSE,
        date: { gte: startOfMonth, lt: startOfNextMonth }
      },
      _sum: { amount: true }
    })

    const spendingMap = new Map<string, Prisma.Decimal>()
    spendings.forEach((s) => {
      spendingMap.set(s.categoryId, s._sum.amount ?? new Prisma.Decimal(0))
    })

    let totalLimit = new Prisma.Decimal(0)
    let totalSpent = new Prisma.Decimal(0)
    let exceededCount = 0
    let warningCount = 0

    budgets.forEach((b) => {
      const limit = b.amount
      const spent = spendingMap.get(b.categoryId) ?? new Prisma.Decimal(0)
      const { status } = calculateBudgetStatus(limit, spent)

      totalLimit = totalLimit.plus(limit)
      totalSpent = totalSpent.plus(spent)

      if (status === 'EXCEEDED') exceededCount++
      else if (status === 'WARNING') warningCount++
    })

    const totalRemaining = totalLimit.minus(totalSpent)
    const percentage = totalLimit.isZero()
      ? 0
      : Math.round(totalSpent.dividedBy(totalLimit).toNumber() * 100)

    res.status(200).json({
      summary: {
        period,
        totalLimit: totalLimit.toString(),
        totalSpent: totalSpent.toString(),
        totalRemaining: totalRemaining.toString(),
        percentage,
        budgetCount: budgets.length,
        exceededCount,
        warningCount
      }
    })
  } catch (error) {
    console.error('[GetBudgetSummary Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat ringkasan anggaran.'
    })
  }
}

export async function getBudgetById(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const budget = await prisma.budget.findFirst({
      where: { id, userId },
      include: {
        category: true
      }
    })

    if (!budget) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Anggaran tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    const { startOfMonth, startOfNextMonth } = getMonthBoundaries(budget.period)

    // Fetch contributing transactions and spent aggregation
    const [spendingAgg, transactions] = await prisma.$transaction([
      prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: budget.categoryId,
          type: TransactionType.EXPENSE,
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          categoryId: budget.categoryId,
          type: TransactionType.EXPENSE,
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        orderBy: { date: 'desc' },
        include: {
          wallet: { select: { id: true, name: true, type: true, currency: true } }
        }
      })
    ])

    const spent = spendingAgg._sum.amount ?? new Prisma.Decimal(0)
    const { remaining, percentage, status } = calculateBudgetStatus(budget.amount, spent)

    res.status(200).json({
      budget: {
        id: budget.id,
        categoryId: budget.categoryId,
        period: budget.period,
        amount: budget.amount.toString(),
        spent: spent.toString(),
        remaining: remaining.toString(),
        percentage,
        status,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
        category: budget.category,
        transactions
      }
    })
  } catch (error) {
    console.error('[GetBudgetById Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat detail anggaran.'
    })
  }
}

export async function createBudget(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = createBudgetSchema.safeParse(req.body)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data anggaran tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { categoryId, period, amount } = validation.data

  try {
    // 1. Verify Category ownership and EXPENSE type
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

    if (category.type !== TransactionType.EXPENSE) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Kategori '${category.name}' adalah tipe ${category.type}. Anggaran hanya dapat dibuat untuk kategori pengeluaran (EXPENSE).`
      })
      return
    }

    // 2. Check for duplicate budget in the same period
    const existingBudget = await prisma.budget.findFirst({
      where: { userId, categoryId, period }
    })

    if (existingBudget) {
      res.status(409).json({
        error: 'Conflict',
        message: `Anggaran untuk kategori '${category.name}' pada periode ${period} sudah ada.`
      })
      return
    }

    // 3. Create budget record
    const decimalAmount = new Prisma.Decimal(amount)
    const newBudget = await prisma.budget.create({
      data: {
        userId,
        categoryId,
        period,
        amount: decimalAmount
      },
      include: {
        category: true
      }
    })

    // Calculate current realization
    const { startOfMonth, startOfNextMonth } = getMonthBoundaries(period)
    const spendingAgg = await prisma.transaction.aggregate({
      where: {
        userId,
        categoryId,
        type: TransactionType.EXPENSE,
        date: { gte: startOfMonth, lt: startOfNextMonth }
      },
      _sum: { amount: true }
    })

    const spent = spendingAgg._sum.amount ?? new Prisma.Decimal(0)
    const { remaining, percentage, status } = calculateBudgetStatus(decimalAmount, spent)

    res.status(201).json({
      message: 'Anggaran berhasil dibuat.',
      budget: {
        id: newBudget.id,
        categoryId: newBudget.categoryId,
        period: newBudget.period,
        amount: newBudget.amount.toString(),
        spent: spent.toString(),
        remaining: remaining.toString(),
        percentage,
        status,
        createdAt: newBudget.createdAt,
        updatedAt: newBudget.updatedAt,
        category: newBudget.category
      }
    })
  } catch (error: unknown) {
    // Handle Prisma unique constraint violation code P2002
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      res.status(409).json({
        error: 'Conflict',
        message: `Anggaran untuk kategori dan periode tersebut sudah terdaftar.`
      })
      return
    }

    console.error('[CreateBudget Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal membuat anggaran.'
    })
  }
}

export async function updateBudget(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params
  const validation = updateBudgetSchema.safeParse(req.body)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data pembaruan anggaran tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { amount } = validation.data
  const decimalAmount = new Prisma.Decimal(amount)

  try {
    const existingBudget = await prisma.budget.findFirst({
      where: { id, userId },
      include: { category: true }
    })

    if (!existingBudget) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Anggaran tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    const updatedBudget = await prisma.budget.update({
      where: { id },
      data: {
        amount: decimalAmount
      },
      include: {
        category: true
      }
    })

    // Calculate updated realization
    const { startOfMonth, startOfNextMonth } = getMonthBoundaries(existingBudget.period)
    const spendingAgg = await prisma.transaction.aggregate({
      where: {
        userId,
        categoryId: existingBudget.categoryId,
        type: TransactionType.EXPENSE,
        date: { gte: startOfMonth, lt: startOfNextMonth }
      },
      _sum: { amount: true }
    })

    const spent = spendingAgg._sum.amount ?? new Prisma.Decimal(0)
    const { remaining, percentage, status } = calculateBudgetStatus(decimalAmount, spent)

    res.status(200).json({
      message: 'Batas anggaran berhasil diperbarui.',
      budget: {
        id: updatedBudget.id,
        categoryId: updatedBudget.categoryId,
        period: updatedBudget.period,
        amount: updatedBudget.amount.toString(),
        spent: spent.toString(),
        remaining: remaining.toString(),
        percentage,
        status,
        createdAt: updatedBudget.createdAt,
        updatedAt: updatedBudget.updatedAt,
        category: updatedBudget.category
      }
    })
  } catch (error) {
    console.error('[UpdateBudget Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memperbarui batas anggaran.'
    })
  }
}

export async function deleteBudget(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const existingBudget = await prisma.budget.findFirst({
      where: { id, userId }
    })

    if (!existingBudget) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Anggaran tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    // Delete budget record only (Leaves transactions and wallet balances completely untouched)
    await prisma.budget.delete({
      where: { id }
    })

    res.status(200).json({
      message: 'Anggaran berhasil dihapus.'
    })
  } catch (error) {
    console.error('[DeleteBudget Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal menghapus anggaran.'
    })
  }
}
