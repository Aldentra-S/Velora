import { Request, Response } from 'express'
import { Prisma, TransactionType, TransferStatus } from '@prisma/client'
import { prisma } from '../config/db.js'
import { dashboardQuerySchema } from '../validations/finance.validation.js'

const MONTH_NAMES_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

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

/**
 * Returns previous period string "YYYY-MM"
 */
function getPreviousPeriod(period: string): string {
  const [yearStr, monthStr] = period.split('-')
  let year = parseInt(yearStr, 10)
  let month = parseInt(monthStr, 10) - 1
  if (month === 0) {
    month = 12
    year -= 1
  }
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * Returns default period in UTC: "YYYY-MM"
 */
function getDefaultPeriod(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Computes safe percentage change between two Decimal amounts without NaN or Infinity
 */
function calculatePercentageChange(current: Prisma.Decimal, previous: Prisma.Decimal): number {
  if (previous.isZero()) {
    return current.isZero() ? 0 : 100
  }
  const change = current.minus(previous).dividedBy(previous).times(100).toNumber()
  if (isNaN(change) || !isFinite(change)) return 0
  return Math.round(change * 10) / 10
}

/**
 * Computes status of a budget: NORMAL, WARNING, or EXCEEDED
 */
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

/**
 * Generates N months list ending at period: e.g. count=3, period='2026-10' -> ['2026-08', '2026-09', '2026-10']
 */
function getMonthsRange(period: string, count: number): string[] {
  const [yearStr, monthStr] = period.split('-')
  let y = parseInt(yearStr, 10)
  let m = parseInt(monthStr, 10)
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    result.unshift(`${y}-${String(m).padStart(2, '0')}`)
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  return result
}

export async function getFinanceSummary(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id

  try {
    // 1. Wallets & Total Balance
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        balance: true,
        currency: true
      }
    })

    const totalBalance = wallets.reduce(
      (acc, w) => acc.plus(w.balance),
      new Prisma.Decimal(0)
    )

    // 2. All-time aggregate
    const [incomeAgg, expenseAgg] = await prisma.$transaction([
      prisma.transaction.aggregate({
        where: { userId, type: TransactionType.INCOME },
        _sum: { amount: true }
      }),
      prisma.transaction.aggregate({
        where: { userId, type: TransactionType.EXPENSE },
        _sum: { amount: true }
      })
    ])

    const totalIncome = incomeAgg._sum.amount ?? new Prisma.Decimal(0)
    const totalExpense = expenseAgg._sum.amount ?? new Prisma.Decimal(0)
    const netCashflow = totalIncome.minus(totalExpense)

    // 3. Current month aggregate using UTC half-open interval [start, nextStart)
    const defaultPeriod = getDefaultPeriod()
    const { startOfMonth, startOfNextMonth } = getMonthBoundaries(defaultPeriod)

    const [monthIncomeAgg, monthExpenseAgg] = await prisma.$transaction([
      prisma.transaction.aggregate({
        where: {
          userId,
          type: TransactionType.INCOME,
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          type: TransactionType.EXPENSE,
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      })
    ])

    const monthIncome = monthIncomeAgg._sum.amount ?? new Prisma.Decimal(0)
    const monthExpense = monthExpenseAgg._sum.amount ?? new Prisma.Decimal(0)
    const monthCashflow = monthIncome.minus(monthExpense)

    res.status(200).json({
      summary: {
        totalBalance,
        totalIncome,
        totalExpense,
        netCashflow,
        currentMonth: {
          income: monthIncome,
          expense: monthExpense,
          cashflow: monthCashflow,
          period: defaultPeriod
        },
        walletCount: wallets.length,
        wallets
      }
    })
  } catch (error) {
    console.error('[GetFinanceSummary Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat ringkasan keuangan.'
    })
  }
}

export async function getDashboardAnalytics(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = dashboardQuerySchema.safeParse(req.query)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Parameter filter dashboard tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const period = validation.data.period || getDefaultPeriod()
  const range = validation.data.range || 'month'

  const { startOfMonth, startOfNextMonth } = getMonthBoundaries(period)
  const prevPeriod = getPreviousPeriod(period)
  const { startOfMonth: prevStart, startOfNextMonth: prevEnd } = getMonthBoundaries(prevPeriod)

  try {
    // 1. Wallets & Total Balance
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        balance: true,
        currency: true
      },
      orderBy: { createdAt: 'asc' }
    })

    const totalBalance = wallets.reduce(
      (acc, w) => acc.plus(w.balance),
      new Prisma.Decimal(0)
    )

    // 2. Parallel Core Aggregations for Selected Period & Previous Period
    const [
      periodIncomeAgg,
      periodExpenseAgg,
      prevIncomeAgg,
      prevExpenseAgg,
      categoryExpenses,
      budgets,
      recentTxs,
      recentTransfers
    ] = await prisma.$transaction([
      // Current Period Income
      prisma.transaction.aggregate({
        where: {
          userId,
          type: TransactionType.INCOME,
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      // Current Period Expense
      prisma.transaction.aggregate({
        where: {
          userId,
          type: TransactionType.EXPENSE,
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      // Previous Period Income
      prisma.transaction.aggregate({
        where: {
          userId,
          type: TransactionType.INCOME,
          date: { gte: prevStart, lt: prevEnd }
        },
        _sum: { amount: true }
      }),
      // Previous Period Expense
      prisma.transaction.aggregate({
        where: {
          userId,
          type: TransactionType.EXPENSE,
          date: { gte: prevStart, lt: prevEnd }
        },
        _sum: { amount: true }
      }),
      // Category Spending GroupBy (all transactions in this period)
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          userId,
          type: TransactionType.EXPENSE,
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      // Budgets for this period
      prisma.budget.findMany({
        where: { userId, period },
        include: {
          category: {
            select: { id: true, name: true, color: true, icon: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      // Recent Transactions (limit 8)
      prisma.transaction.findMany({
        where: { userId },
        take: 8,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          wallet: {
            select: { id: true, name: true, currency: true }
          },
          category: {
            select: { id: true, name: true, color: true, icon: true }
          }
        }
      }),
      // Recent Transfers (limit 8)
      prisma.transfer.findMany({
        where: { userId },
        take: 8,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          fromWallet: {
            select: { id: true, name: true, currency: true }
          },
          toWallet: {
            select: { id: true, name: true, currency: true }
          }
        }
      })
    ])

    const periodIncome = periodIncomeAgg._sum.amount ?? new Prisma.Decimal(0)
    const periodExpense = periodExpenseAgg._sum.amount ?? new Prisma.Decimal(0)
    const periodCashflow = periodIncome.minus(periodExpense)

    const prevIncome = prevIncomeAgg._sum.amount ?? new Prisma.Decimal(0)
    const prevExpense = prevExpenseAgg._sum.amount ?? new Prisma.Decimal(0)
    const prevCashflow = prevIncome.minus(prevExpense)

    const incomeChangePct = calculatePercentageChange(periodIncome, prevIncome)
    const expenseChangePct = calculatePercentageChange(periodExpense, prevExpense)

    // 3. Category Spending Breakdown (enrich with Category metadata)
    const categoryIds = categoryExpenses.map((c) => c.categoryId)
    const categoriesMeta =
      categoryIds.length > 0
        ? await prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true, color: true, icon: true }
          })
        : []

    const metaMap = new Map(categoriesMeta.map((c) => [c.id, c]))
    const spendingMap = new Map<string, Prisma.Decimal>()

    const categoryBreakdown = categoryExpenses
      .map((c) => {
        const amt = c._sum.amount ?? new Prisma.Decimal(0)
        spendingMap.set(c.categoryId, amt)
        const meta = metaMap.get(c.categoryId)
        const percentage = periodExpense.isZero()
          ? 0
          : Math.round(amt.dividedBy(periodExpense).toNumber() * 100)

        return {
          categoryId: c.categoryId,
          name: meta?.name ?? 'Kategori Dihapus',
          color: meta?.color ?? '#9ca3af',
          icon: meta?.icon ?? null,
          total: amt.toString(),
          percentage
        }
      })
      .sort((a, b) => new Prisma.Decimal(b.total).minus(new Prisma.Decimal(a.total)).toNumber())

    // 4. Budget Overview & Realization Calculation
    let totalLimit = new Prisma.Decimal(0)
    let totalSpent = new Prisma.Decimal(0)
    let exceededCount = 0
    let warningCount = 0

    const budgetItems = budgets.map((b) => {
      const limit = b.amount
      const spent = spendingMap.get(b.categoryId) ?? new Prisma.Decimal(0)
      const { remaining, percentage, status } = calculateBudgetStatus(limit, spent)

      totalLimit = totalLimit.plus(limit)
      totalSpent = totalSpent.plus(spent)

      if (status === 'EXCEEDED') exceededCount++
      else if (status === 'WARNING') warningCount++

      return {
        id: b.id,
        categoryId: b.categoryId,
        name: b.category.name,
        color: b.category.color,
        icon: b.category.icon,
        limit: limit.toString(),
        spent: spent.toString(),
        remaining: remaining.toString(),
        percentage,
        status
      }
    })

    const totalRemaining = totalLimit.minus(totalSpent)
    const overallPercentage = totalLimit.isZero()
      ? 0
      : Math.round(totalSpent.dividedBy(totalLimit).toNumber() * 100)

    let overallStatus: 'NORMAL' | 'WARNING' | 'EXCEEDED' = 'NORMAL'
    if (totalSpent.greaterThan(totalLimit)) {
      overallStatus = 'EXCEEDED'
    } else if (overallPercentage >= 80) {
      overallStatus = 'WARNING'
    }

    const budgetOverview = {
      hasBudgets: budgets.length > 0,
      totalLimit: totalLimit.toString(),
      totalSpent: totalSpent.toString(),
      totalRemaining: totalRemaining.toString(),
      percentage: overallPercentage,
      status: overallStatus,
      budgetCount: budgets.length,
      exceededCount,
      warningCount,
      budgets: budgetItems.slice(0, 4) // Top 4 for widget
    }

    // 5. Time Series Cashflow Chart Data (All transactions in selected range)
    let seriesTxs: { amount: Prisma.Decimal; type: TransactionType; date: Date }[] = []
    let cashflowSeries: { label: string; income: string; expense: string }[] = []

    if (range === 'month') {
      const [yearStr, monthStr] = period.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
      const shortMonth = MONTH_NAMES_ID[month - 1]

      seriesTxs = await prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        select: { amount: true, type: true, date: true }
      })

      const buckets = [
        { label: `01-07 ${shortMonth}`, income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) },
        { label: `08-14 ${shortMonth}`, income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) },
        { label: `15-21 ${shortMonth}`, income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) },
        { label: `22-${daysInMonth} ${shortMonth}`, income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) }
      ]

      seriesTxs.forEach((tx) => {
        const day = tx.date.getUTCDate()
        const idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3
        if (tx.type === TransactionType.INCOME) {
          buckets[idx].income = buckets[idx].income.plus(tx.amount)
        } else {
          buckets[idx].expense = buckets[idx].expense.plus(tx.amount)
        }
      })

      cashflowSeries = buckets.map((b) => ({
        label: b.label,
        income: b.income.toString(),
        expense: b.expense.toString()
      }))
    } else {
      const monthsCount = range === '3m' ? 3 : range === '6m' ? 6 : 12
      const monthList = getMonthsRange(period, monthsCount)
      const seriesStart = getMonthBoundaries(monthList[0]).startOfMonth
      const seriesEnd = startOfNextMonth

      seriesTxs = await prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: seriesStart, lt: seriesEnd }
        },
        select: { amount: true, type: true, date: true }
      })

      const bucketsMap = new Map<string, { label: string; income: Prisma.Decimal; expense: Prisma.Decimal }>()
      monthList.forEach((mStr) => {
        const [y, m] = mStr.split('-').map(Number)
        const label = `${MONTH_NAMES_ID[m - 1]} ${y}`
        bucketsMap.set(mStr, {
          label,
          income: new Prisma.Decimal(0),
          expense: new Prisma.Decimal(0)
        })
      })

      seriesTxs.forEach((tx) => {
        const y = tx.date.getUTCFullYear()
        const m = String(tx.date.getUTCMonth() + 1).padStart(2, '0')
        const key = `${y}-${m}`
        const bucket = bucketsMap.get(key)
        if (bucket) {
          if (tx.type === TransactionType.INCOME) {
            bucket.income = bucket.income.plus(tx.amount)
          } else {
            bucket.expense = bucket.expense.plus(tx.amount)
          }
        }
      })

      cashflowSeries = Array.from(bucketsMap.values()).map((b) => ({
        label: b.label,
        income: b.income.toString(),
        expense: b.expense.toString()
      }))
    }

    // 6. Integrated Recent Activities (Transactions + Transfers)
    interface ActivityItem {
      id: string
      activityType: 'TRANSACTION' | 'TRANSFER'
      type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
      title: string
      amount: string
      walletName: string
      categoryName: string
      categoryColor: string
      status: TransferStatus | null
      date: string
    }

    const txActivities: ActivityItem[] = recentTxs.map((t) => ({
      id: t.id,
      activityType: 'TRANSACTION',
      type: t.type,
      title: t.description || t.category.name,
      amount: t.amount.toString(),
      walletName: t.wallet.name,
      categoryName: t.category.name,
      categoryColor: t.category.color ?? '#6366f1',
      status: null,
      date: t.date.toISOString()
    }))

    const transferActivities: ActivityItem[] = recentTransfers.map((tr) => ({
      id: tr.id,
      activityType: 'TRANSFER',
      type: 'TRANSFER',
      title: tr.notes || 'Transfer Antardompet',
      amount: tr.amount.toString(),
      walletName: `${tr.fromWallet.name} → ${tr.toWallet.name}`,
      categoryName: 'Transfer Antardompet',
      categoryColor: '#64748b',
      status: tr.status,
      date: tr.date.toISOString()
    }))

    const combinedActivities = [...txActivities, ...transferActivities]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)

    res.status(200).json({
      period,
      range,
      summary: {
        totalBalance: totalBalance.toString(),
        periodIncome: periodIncome.toString(),
        periodExpense: periodExpense.toString(),
        periodCashflow: periodCashflow.toString(),
        previousPeriod: {
          period: prevPeriod,
          income: prevIncome.toString(),
          expense: prevExpense.toString(),
          cashflow: prevCashflow.toString(),
          incomeChangePct,
          expenseChangePct
        },
        walletCount: wallets.length,
        wallets: wallets.map((w) => ({
          id: w.id,
          name: w.name,
          type: w.type,
          balance: w.balance.toString(),
          currency: w.currency
        }))
      },
      cashflowSeries,
      categoryBreakdown,
      budgetOverview,
      recentActivities: combinedActivities
    })
  } catch (error) {
    console.error('[GetDashboardAnalytics Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat analitik dashboard.'
    })
  }
}
