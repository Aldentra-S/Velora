import { Request, Response } from 'express'
import { Prisma, TransactionType } from '@prisma/client'
import { prisma } from '../config/db.js'
import { reportQuerySchema } from '../validations/report.validation.js'

function getReportDateRanges(query: {
  periodType: 'monthly' | 'yearly' | 'custom'
  year?: number
  month?: number
  startDate?: string
  endDate?: string
}) {
  const now = new Date()
  const defaultYear = now.getUTCFullYear()
  const defaultMonth = now.getUTCMonth() + 1

  let currentStart: Date
  let currentEnd: Date
  let prevStart: Date
  let prevEnd: Date
  let periodLabel = ''

  if (query.periodType === 'monthly') {
    const y = query.year ?? defaultYear
    const m = query.month ?? defaultMonth
    currentStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
    currentEnd = m === 12 ? new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0)) : new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))

    const prevY = m === 1 ? y - 1 : y
    const prevM = m === 1 ? 12 : m - 1
    prevStart = new Date(Date.UTC(prevY, prevM - 1, 1, 0, 0, 0, 0))
    prevEnd = currentStart

    const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    periodLabel = `${MONTH_NAMES[m - 1]} ${y}`
  } else if (query.periodType === 'yearly') {
    const y = query.year ?? defaultYear
    currentStart = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0))
    currentEnd = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0))

    prevStart = new Date(Date.UTC(y - 1, 0, 1, 0, 0, 0, 0))
    prevEnd = currentStart
    periodLabel = `Tahun ${y}`
  } else {
    // Custom
    currentStart = query.startDate ? new Date(query.startDate) : new Date(Date.UTC(defaultYear, defaultMonth - 1, 1))
    currentEnd = query.endDate ? new Date(query.endDate) : new Date(Date.UTC(defaultYear, defaultMonth, 1))

    const spanMs = currentEnd.getTime() - currentStart.getTime()
    prevEnd = new Date(currentStart)
    prevStart = new Date(currentStart.getTime() - spanMs)
    periodLabel = `${currentStart.toISOString().slice(0, 10)} s/d ${currentEnd.toISOString().slice(0, 10)}`
  }

  return { currentStart, currentEnd, prevStart, prevEnd, periodLabel }
}

/**
 * Escapes CSV values and neutralizes potential Formula Injection (=, +, -, @)
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""'
  let str = String(value)

  // Prevent CSV Formula Injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }

  // Escape double quotes
  str = str.replace(/"/g, '""')
  return `"${str}"`
}

export async function getFinancialReport(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = reportQuerySchema.safeParse(req.query)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Parameter laporan keuangan tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { periodType, year, month, startDate, endDate, walletId, categoryId, type, page, limit } =
    validation.data

  const { currentStart, currentEnd, prevStart, prevEnd, periodLabel } = getReportDateRanges({
    periodType,
    year,
    month,
    startDate,
    endDate
  })

  try {
    // Common filters (transfers are strictly NOT in transactions table, so transfer neutrality is preserved)
    const baseWhere: Prisma.TransactionWhereInput = {
      userId,
      date: { gte: currentStart, lt: currentEnd }
    }
    if (walletId) baseWhere.walletId = walletId
    if (categoryId) baseWhere.categoryId = categoryId
    if (type) baseWhere.type = type

    // 1. Current Period Aggregations
    const incomeAgg = await prisma.transaction.aggregate({
      where: { ...baseWhere, type: TransactionType.INCOME },
      _sum: { amount: true },
      _count: true
    })

    const expenseAgg = await prisma.transaction.aggregate({
      where: { ...baseWhere, type: TransactionType.EXPENSE },
      _sum: { amount: true },
      _count: true
    })

    const totalIncome = incomeAgg._sum.amount ?? new Prisma.Decimal(0)
    const totalExpense = expenseAgg._sum.amount ?? new Prisma.Decimal(0)
    const netCashflow = totalIncome.minus(totalExpense)
    const savingsRate = totalIncome.isZero()
      ? 0
      : Math.max(Math.round(netCashflow.dividedBy(totalIncome).toNumber() * 100), 0)

    // 2. Previous Period Aggregations (for period comparison)
    const prevWhere: Prisma.TransactionWhereInput = {
      userId,
      date: { gte: prevStart, lt: prevEnd }
    }
    if (walletId) prevWhere.walletId = walletId
    if (categoryId) prevWhere.categoryId = categoryId
    if (type) prevWhere.type = type

    const prevIncomeAgg = await prisma.transaction.aggregate({
      where: { ...prevWhere, type: TransactionType.INCOME },
      _sum: { amount: true }
    })
    const prevExpenseAgg = await prisma.transaction.aggregate({
      where: { ...prevWhere, type: TransactionType.EXPENSE },
      _sum: { amount: true }
    })

    const prevTotalIncome = prevIncomeAgg._sum.amount ?? new Prisma.Decimal(0)
    const prevTotalExpense = prevExpenseAgg._sum.amount ?? new Prisma.Decimal(0)

    const incomeChangePct = prevTotalIncome.isZero()
      ? totalIncome.isZero() ? 0 : 100
      : Math.round(totalIncome.minus(prevTotalIncome).dividedBy(prevTotalIncome).times(100).toNumber() * 10) / 10

    const expenseChangePct = prevTotalExpense.isZero()
      ? totalExpense.isZero() ? 0 : 100
      : Math.round(totalExpense.minus(prevTotalExpense).dividedBy(prevTotalExpense).times(100).toNumber() * 10) / 10

    // 3. Category Breakdown (Expenses)
    const categoryGroup = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { ...baseWhere, type: TransactionType.EXPENSE },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } }
    })

    const categoryDetails = await prisma.category.findMany({
      where: { id: { in: categoryGroup.map((c) => c.categoryId) } }
    })
    const catMap = new Map(categoryDetails.map((c) => [c.id, c]))

    const categoryBreakdown = categoryGroup.map((cg) => {
      const cat = catMap.get(cg.categoryId)
      const amount = cg._sum.amount ?? new Prisma.Decimal(0)
      const percentage = totalExpense.isZero()
        ? 0
        : Math.round(amount.dividedBy(totalExpense).toNumber() * 100)

      return {
        categoryId: cg.categoryId,
        categoryName: cat?.name ?? 'Kategori Lain',
        categoryColor: cat?.color ?? '#94a3b8',
        categoryIcon: cat?.icon ?? null,
        amount: amount.toNumber(),
        count: cg._count,
        percentage
      }
    })

    // 4. Budget vs Actual Summary (if monthly)
    let budgetsSummary = null
    if (periodType === 'monthly') {
      const y = year ?? new Date().getUTCFullYear()
      const m = month ?? new Date().getUTCMonth() + 1
      const periodStr = `${y}-${String(m).padStart(2, '0')}`

      const budgets = await prisma.budget.findMany({
        where: { userId, period: periodStr },
        include: { category: true }
      })

      if (budgets.length > 0) {
        let totalBudgetLimit = new Prisma.Decimal(0)
        let totalBudgetSpent = new Prisma.Decimal(0)

        const budgetDetails = budgets.map((b) => {
          totalBudgetLimit = totalBudgetLimit.plus(b.amount)
          const catExpense = categoryGroup.find((cg) => cg.categoryId === b.categoryId)
          const spent = catExpense?._sum.amount ?? new Prisma.Decimal(0)
          totalBudgetSpent = totalBudgetSpent.plus(spent)

          const pct = b.amount.isZero() ? 0 : Math.round(spent.dividedBy(b.amount).toNumber() * 100)
          return {
            id: b.id,
            categoryName: b.category.name,
            limit: b.amount.toNumber(),
            spent: spent.toNumber(),
            percentage: pct,
            status: spent.greaterThan(b.amount) ? 'EXCEEDED' : pct >= 80 ? 'WARNING' : 'NORMAL'
          }
        })

        budgetsSummary = {
          totalLimit: totalBudgetLimit.toNumber(),
          totalSpent: totalBudgetSpent.toNumber(),
          remaining: totalBudgetLimit.minus(totalBudgetSpent).toNumber(),
          items: budgetDetails
        }
      }
    }

    // 5. Supporting Transactions with Pagination
    const totalTxCount = await prisma.transaction.count({ where: baseWhere })
    const transactions = await prisma.transaction.findMany({
      where: baseWhere,
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        wallet: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, color: true } }
      }
    })

    res.status(200).json({
      period: {
        type: periodType,
        label: periodLabel,
        startDate: currentStart.toISOString(),
        endDate: currentEnd.toISOString()
      },
      summary: {
        totalIncome: totalIncome.toNumber(),
        totalExpense: totalExpense.toNumber(),
        netCashflow: netCashflow.toNumber(),
        savingsRate,
        incomeCount: incomeAgg._count,
        expenseCount: expenseAgg._count,
        comparison: {
          prevIncome: prevTotalIncome.toNumber(),
          prevExpense: prevTotalExpense.toNumber(),
          incomeChangePct,
          expenseChangePct
        }
      },
      categoryBreakdown,
      budgetsSummary,
      transactions: {
        items: transactions,
        pagination: {
          total: totalTxCount,
          page,
          limit,
          totalPages: Math.ceil(totalTxCount / limit) || 1
        }
      }
    })
  } catch (error) {
    console.error('[GetFinancialReport Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal menyusun laporan keuangan.'
    })
  }
}

export async function exportReportCsv(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = reportQuerySchema.safeParse(req.query)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Parameter filter ekspor CSV tidak valid.'
    })
    return
  }

  const { periodType, year, month, startDate, endDate, walletId, categoryId, type } =
    validation.data

  const { currentStart, currentEnd, periodLabel } = getReportDateRanges({
    periodType,
    year,
    month,
    startDate,
    endDate
  })

  try {
    const baseWhere: Prisma.TransactionWhereInput = {
      userId,
      date: { gte: currentStart, lt: currentEnd }
    }
    if (walletId) baseWhere.walletId = walletId
    if (categoryId) baseWhere.categoryId = categoryId
    if (type) baseWhere.type = type

    const transactions = await prisma.transaction.findMany({
      where: baseWhere,
      orderBy: { date: 'asc' },
      include: {
        wallet: { select: { name: true } },
        category: { select: { name: true } }
      }
    })

    const rows: string[] = []
    // UTF-8 BOM
    const BOM = '\uFEFF'

    // CSV Headers
    rows.push(['Tanggal', 'Tipe', 'Kategori', 'Dompet', 'Nominal (IDR)', 'Deskripsi'].join(','))

    transactions.forEach((tx) => {
      const dateStr = new Date(tx.date).toISOString().slice(0, 10)
      const typeStr = tx.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'
      const catStr = tx.category.name
      const walletStr = tx.wallet.name
      const amountStr = tx.amount.toString()
      const descStr = tx.description || '-'

      rows.push(
        [
          sanitizeCsvCell(dateStr),
          sanitizeCsvCell(typeStr),
          sanitizeCsvCell(catStr),
          sanitizeCsvCell(walletStr),
          sanitizeCsvCell(amountStr),
          sanitizeCsvCell(descStr)
        ].join(',')
      )
    })

    const csvContent = BOM + rows.join('\r\n')
    const filename = `Laporan_Velora_${periodLabel.replace(/\s+/g, '_')}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.status(200).send(csvContent)
  } catch (error) {
    console.error('[ExportReportCsv Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal mengekspor laporan keuangan ke CSV.'
    })
  }
}
