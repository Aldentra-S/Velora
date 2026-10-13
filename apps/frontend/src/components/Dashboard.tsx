import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { financeApi } from '../services/api'
import type {
  DashboardAnalytics,
  DashboardSummary,
  CashflowPoint,
  CategorySpending,
  DashboardBudgetOverview,
  DashboardActivity,
} from '../services/types'
import {
  formatCurrency,
  formatCurrencyShort,
  formatDate,
  formatMonthLabel,
  categoryColor,
  getCurrentPeriod,
  shiftPeriod,
  clamp,
} from '../lib/utils'
import {
  IconIncome,
  IconExpense,
  IconTrendingUp,
  IconPlus,
  IconRefresh,
  IconTransaction,
  IconWallet,
  IconCategory,
  IconBudget,
  IconTransfer,
  IconChevronLeft,
  IconChevronRight,
  IconAlertCircle,
  IconTarget,
} from './Icons'
import { goalApi } from '../services/api'
import type { FinancialGoal, GoalsSummary } from '../services/types'

// ─── Loading State ────────────────────────────────────────────────────────────

function DashboardLoading() {
  return (
    <div className="page-loading">
      <span className="spinner" style={{ width: 22, height: 22 }} />
      <span>Memuat analitik keuangan...</span>
    </div>
  )
}

// ─── Balance Hero Module ──────────────────────────────────────────────────────

interface BalanceHeroProps {
  summary: DashboardSummary
  period: string
  onAddTransaction: () => void
  onAddWallet: () => void
}

function BalanceHero({ summary, period, onAddTransaction, onAddWallet }: BalanceHeroProps) {
  const monthLabel = formatMonthLabel(period)
  const cashflowNum = parseFloat(summary.periodCashflow) || 0
  const isSurplus = cashflowNum >= 0

  const incTrend = summary.previousPeriod.incomeChangePct
  const expTrend = summary.previousPeriod.expenseChangePct

  return (
    <section className="hero-balance-banner" aria-label="Ringkasan Saldo dan Metrik Utama">
      <div className="hero-balance-top">
        <div>
          <div className="hero-balance-meta">
            <span>Total Saldo Bersih</span>
            <span>•</span>
            <span>{summary.walletCount} Dompet Aktif</span>
          </div>
          <div className="hero-balance-amount">
            {formatCurrency(summary.totalBalance)}
          </div>
          <div className="hero-balance-sub">
            Akumulasi saldo riil di seluruh akun dan dompet aktif Anda
          </div>
        </div>

        <div className="hero-balance-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onAddWallet}
            id="hero-add-wallet-btn"
          >
            <IconWallet size={14} />
            Kelola Dompet
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onAddTransaction}
            id="hero-add-tx-btn"
          >
            <IconPlus size={14} />
            Catat Transaksi
          </button>
        </div>
      </div>

      <div className="hero-metrics-bar">
        {/* Income */}
        <div className="metric-item">
          <div className="metric-header">
            <IconIncome size={15} style={{ color: 'var(--income)' }} />
            <span>Pemasukan ({monthLabel})</span>
          </div>
          <div className="metric-value income">
            +{formatCurrency(summary.periodIncome)}
          </div>
          {incTrend !== 0 && (
            <div className={`trend-tag ${incTrend > 0 ? 'positive' : 'negative'}`}>
              {incTrend > 0 ? '+' : ''}{incTrend}% vs bln lalu
            </div>
          )}
        </div>

        {/* Expense */}
        <div className="metric-item">
          <div className="metric-header">
            <IconExpense size={15} style={{ color: 'var(--expense)' }} />
            <span>Pengeluaran ({monthLabel})</span>
          </div>
          <div className="metric-value expense">
            -{formatCurrency(summary.periodExpense)}
          </div>
          {expTrend !== 0 && (
            <div className={`trend-tag ${expTrend < 0 ? 'positive' : 'negative'}`}>
              {expTrend > 0 ? '+' : ''}{expTrend}% vs bln lalu
            </div>
          )}
        </div>

        {/* Cashflow */}
        <div className="metric-item">
          <div className="metric-header">
            <IconTrendingUp size={15} style={{ color: isSurplus ? 'var(--income)' : 'var(--expense)' }} />
            <span>Net Cashflow ({monthLabel})</span>
          </div>
          <div className="metric-value" style={{ color: isSurplus ? 'var(--income)' : 'var(--expense)' }}>
            {isSurplus ? '+' : ''}{formatCurrency(summary.periodCashflow)}
          </div>
          <div className={`metric-status-badge ${isSurplus ? 'surplus' : 'deficit'}`}>
            {isSurplus ? 'Surplus Finansial' : 'Defisit Periode Ini'}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Cashflow Bar Chart ───────────────────────────────────────────────────────

interface CashflowChartProps {
  series: CashflowPoint[]
  range: 'month' | '3m' | '6m' | '12m'
  period: string
  onRangeChange: (r: 'month' | '3m' | '6m' | '12m') => void
  onAddTransaction: () => void
}

function CashflowChart({
  series,
  range,
  period,
  onRangeChange,
  onAddTransaction,
}: CashflowChartProps) {
  const hasData = series.some((p) => parseFloat(p.income) > 0 || parseFloat(p.expense) > 0)

  const maxVal = useMemo(() => {
    let m = 1
    series.forEach((p) => {
      const inc = parseFloat(p.income) || 0
      const exp = parseFloat(p.expense) || 0
      if (inc > m) m = inc
      if (exp > m) m = exp
    })
    return m
  }, [series])

  const barH = (valStr: string) => {
    const v = parseFloat(valStr) || 0
    if (v <= 0) return '0%'
    return `${clamp((v / maxVal) * 100, 4, 100)}%`
  }

  const rangeLabels: Record<string, string> = {
    month: 'Bulan Ini',
    '3m': '3 Bulan',
    '6m': '6 Bulan',
    '12m': '12 Bulan',
  }

  return (
    <div className="cashflow-chart-wrap">
      <div className="chart-header" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="chart-title">Tren Arus Kas</div>
          <div className="chart-period">
            {range === 'month'
              ? `Distribusi mingguan (${formatMonthLabel(period)})`
              : `Arus kas berkala ${rangeLabels[range]}`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="segmented-control" role="tablist" aria-label="Rentang Waktu Grafik">
            {(['month', '3m', '6m', '12m'] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={`segmented-btn${range === r ? ' active' : ''}`}
                onClick={() => onRangeChange(r)}
                role="tab"
                aria-selected={range === r}
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>

          {hasData && (
            <div className="chart-legend" style={{ margin: 0 }}>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: 'var(--income)' }} />
                <span>Masuk</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: 'var(--expense)' }} />
                <span>Keluar</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="empty-state" style={{ padding: '36px 16px' }}>
          <div className="empty-state-icon">
            <IconTransaction size={20} />
          </div>
          <div className="empty-state-title">Belum ada transaksi pada rentang ini</div>
          <div className="empty-state-sub">
            Catat transaksi pemasukan atau pengeluaran untuk melihat visualisasi arus kas.
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 8 }}
            onClick={onAddTransaction}
          >
            <IconPlus size={14} /> Catat Sekarang
          </button>
        </div>
      ) : (
        <div className="bar-chart" style={{ minHeight: 140 }}>
          {series.map((p) => (
            <div key={p.label} className="bar-group">
              <div className="bar-stack">
                <div
                  className="bar income"
                  style={{ height: barH(p.income) }}
                  title={`Pemasukan ${p.label}: ${formatCurrency(p.income)}`}
                />
                <div
                  className="bar expense"
                  style={{ height: barH(p.expense) }}
                  title={`Pengeluaran ${p.label}: ${formatCurrency(p.expense)}`}
                />
              </div>
              <span className="bar-label">{p.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Category Breakdown ───────────────────────────────────────────────────────

interface CategoryBreakdownProps {
  categories: CategorySpending[]
  totalExpense: string
}

function CategoryBreakdown({ categories, totalExpense }: CategoryBreakdownProps) {
  const expenseNum = parseFloat(totalExpense) || 0

  return (
    <div className="breakdown-card">
      <div className="breakdown-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Distribusi Pengeluaran</span>
        {expenseNum > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
            Total: {formatCurrency(totalExpense)}
          </span>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="empty-state" style={{ padding: '36px 16px' }}>
          <div className="empty-state-icon">
            <IconCategory size={20} />
          </div>
          <div className="empty-state-title">Belum ada pengeluaran</div>
          <div className="empty-state-sub">
            Pengeluaran yang tercatat di database akan otomatis dikelompokkan di sini secara komprehensif.
          </div>
        </div>
      ) : (
        <div className="breakdown-list">
          {categories.slice(0, 5).map((item) => (
            <div key={item.categoryId} className="breakdown-row">
              <div className="breakdown-meta">
                <div className="breakdown-name-wrap">
                  <span className="breakdown-dot" style={{ backgroundColor: item.color }} />
                  <span className="breakdown-name">{item.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.percentage}%</span>
                  <span className="breakdown-amount">-{formatCurrencyShort(item.total)}</span>
                </div>
              </div>
              <div className="breakdown-bar-bg">
                <div
                  className="breakdown-bar-fill"
                  style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Budget Health Widget ─────────────────────────────────────────────────────

interface BudgetHealthProps {
  overview: DashboardBudgetOverview
  onManageBudgets: () => void
}

function BudgetHealthWidget({ overview, onManageBudgets }: BudgetHealthProps) {
  const statusLabels: Record<string, string> = {
    NORMAL: 'Aman',
    WARNING: 'Waspada (≥80%)',
    EXCEEDED: 'Terlampaui',
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconBudget size={18} style={{ color: 'var(--accent)' }} />
          <h3>Kesehatan Anggaran</h3>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onManageBudgets}>
          Buka Anggaran
        </button>
      </div>

      {!overview.hasBudgets ? (
        <div className="empty-state" style={{ padding: '24px 12px' }}>
          <div className="empty-state-icon">
            <IconBudget size={18} />
          </div>
          <div className="empty-state-title">Belum ada target anggaran</div>
          <div className="empty-state-sub">
            Tetapkan batas pengeluaran untuk menjaga kontrol finansial Anda bulan ini.
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 8 }}
            onClick={onManageBudgets}
          >
            <IconPlus size={13} /> Buat Target Anggaran
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Overview Progress Card */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Realisasi Pengeluaran</span>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-h)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(overview.totalSpent)} / {formatCurrency(overview.totalLimit)}
                </div>
              </div>
              <span className={`badge badge-status-${overview.status.toLowerCase()}`}>
                {statusLabels[overview.status] || overview.status}
              </span>
            </div>

            <div className="breakdown-bar-bg" style={{ height: 6 }}>
              <div
                className="breakdown-bar-fill"
                style={{
                  width: `${clamp(overview.percentage, 0, 100)}%`,
                  backgroundColor:
                    overview.status === 'EXCEEDED'
                      ? 'var(--expense)'
                      : overview.status === 'WARNING'
                      ? 'var(--warning)'
                      : 'var(--income)',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>{overview.percentage}% terpakai</span>
              <span>Sisa: {formatCurrency(overview.totalRemaining)}</span>
            </div>
          </div>

          {/* Quick list of budget categories */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {overview.budgets.map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--surface-raised)',
                  fontSize: 12.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 2,
                      backgroundColor: categoryColor(b.color),
                    }}
                  />
                  <span style={{ fontWeight: 500, color: 'var(--text-h)' }}>{b.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrencyShort(b.spent)} / {formatCurrencyShort(b.limit)}
                  </span>
                  <span className={`badge badge-status-${b.status.toLowerCase()}`} style={{ fontSize: 10, padding: '1px 5px' }}>
                    {b.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Recent Activity Feed (Transactions + Transfers) ─────────────────────────

interface RecentActivitiesProps {
  activities: DashboardActivity[]
  onViewAll: () => void
  onAddTransaction: () => void
}

function RecentActivitiesFeed({ activities, onViewAll, onAddTransaction }: RecentActivitiesProps) {
  return (
    <div className="table-wrap">
      <div
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconTransaction size={17} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-h)' }}>
            Aktivitas Terkini
          </span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onViewAll}>
          Lihat Semua
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="empty-state" style={{ padding: '36px 16px' }}>
          <div className="empty-state-icon">
            <IconTransaction size={20} />
          </div>
          <div className="empty-state-title">Belum ada aktivitas finansial</div>
          <div className="empty-state-sub">
            Catatan transaksi dan riwayat transfer antardompet Anda akan muncul di sini.
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 8 }}
            onClick={onAddTransaction}
          >
            <IconPlus size={14} /> Catat Transaksi
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Aktivitas</th>
                <th>Kategori / Tipe</th>
                <th>Dompet</th>
                <th style={{ textAlign: 'right' }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((item) => {
                const isTransfer = item.activityType === 'TRANSFER'
                const isCancelled = item.status === 'CANCELLED'
                const isIncome = item.type === 'INCOME'

                return (
                  <tr key={item.id} style={{ opacity: isCancelled ? 0.65 : 1 }}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDate(item.date)}
                    </td>
                    <td style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text-h)', fontWeight: 500 }}>
                        {item.title}
                      </span>
                      {isCancelled && (
                        <span style={{ fontSize: 10, color: 'var(--expense)', marginLeft: 6, fontWeight: 600 }}>
                          [DIBATALKAN]
                        </span>
                      )}
                    </td>
                    <td>
                      {isTransfer ? (
                        <span
                          className="badge"
                          style={{
                            backgroundColor: 'rgba(99, 102, 241, 0.12)',
                            color: '#818cf8',
                            border: '1px solid rgba(99, 102, 241, 0.28)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <IconTransfer size={11} /> Transfer
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            backgroundColor: `${categoryColor(item.categoryColor)}18`,
                            color: categoryColor(item.categoryColor),
                            border: `1px solid ${categoryColor(item.categoryColor)}35`,
                          }}
                        >
                          {item.categoryName}
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {item.walletName}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        color: isCancelled
                          ? 'var(--text-muted)'
                          : isTransfer
                          ? 'var(--text-h)'
                          : isIncome
                          ? 'var(--income)'
                          : 'var(--expense)',
                        textDecoration: isCancelled ? 'line-through' : 'none',
                      }}
                    >
                      {isCancelled
                        ? formatCurrency(item.amount)
                        : isTransfer
                        ? formatCurrency(item.amount)
                        : isIncome
                        ? `+${formatCurrency(item.amount)}`
                        : `-${formatCurrency(item.amount)}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Wallet Summary List ──────────────────────────────────────────────────────

interface WalletSummaryProps {
  wallets: DashboardSummary['wallets']
  onViewWallets: () => void
}

function WalletSummaryPanel({ wallets, onViewWallets }: WalletSummaryProps) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header-row">
        <h3>Ringkasan Dompet</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onViewWallets}>
          Kelola
        </button>
      </div>

      {wallets.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 12px' }}>
          <div className="empty-state-icon">
            <IconWallet size={18} />
          </div>
          <div className="empty-state-title">Belum ada dompet</div>
          <div className="empty-state-sub">Buat dompet untuk mengelola saldo keuangan Anda.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {wallets.map((w) => (
            <div
              key={w.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-h)' }}>
                  {w.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {w.currency}
                </div>
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: 'var(--text-h)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCurrency(w.balance, w.currency)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Financial Goals Widget ───────────────────────────────────────────────────

interface FinancialGoalsWidgetProps {
  onManageGoals: () => void
}

function FinancialGoalsWidget({ onManageGoals }: FinancialGoalsWidgetProps) {
  const [goals, setGoals] = useState<FinancialGoal[]>([])
  const [summary, setSummary] = useState<GoalsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    goalApi
      .list()
      .then((res) => {
        setGoals(res.goals)
        setSummary(res.summary)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconTarget size={16} style={{ color: 'var(--accent)' }} />
          <h3>Target Finansial (Goals)</h3>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onManageGoals}>
          Kelola
        </button>
      </div>

      {!summary || goals.length === 0 ? (
        <div className="empty-state" style={{ padding: '20px 12px' }}>
          <div className="empty-state-icon">
            <IconTarget size={18} />
          </div>
          <div className="empty-state-title" style={{ fontSize: 13 }}>Belum ada target dibuat</div>
          <div className="empty-state-sub" style={{ fontSize: 11.5 }}>
            Buat target tabungan untuk rencana liburan, dana darurat, atau aset.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Terkumpul ({summary.completedCount}/{summary.totalGoals} Target Selesai)
              </span>
              <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>{summary.overallPct}%</span>
            </div>
            <div className="budget-progress-track">
              <div
                className="budget-progress-bar"
                style={{
                  width: `${clamp(summary.overallPct, 0, 100)}%`,
                  backgroundColor: summary.overallPct >= 100 ? 'var(--income)' : 'var(--accent)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {goals.slice(0, 3).map((g) => {
              const current = Number(g.currentAmount)
              const target = Number(g.targetAmount)
              const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0
              return (
                <div
                  key={g.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--text-h)' }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatCurrency(current)} / {formatCurrency(target)}
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{
                      fontSize: 10,
                      background: pct >= 100 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                      color: pct >= 100 ? 'var(--income)' : 'var(--accent)',
                    }}
                  >
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard Component ─────────────────────────────────────────────────

interface DashboardProps {
  onNavigate: (page: 'wallets' | 'transactions' | 'budgets' | 'categories' | 'recurring' | 'reports') => void
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [period, setPeriod] = useState<string>(getCurrentPeriod())
  const [range, setRange] = useState<'month' | '3m' | '6m' | '12m'>('month')
  const [data, setData] = useState<DashboardAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reqIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const loadData = useCallback(() => {
    // Abort previous in-flight request if active
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    const requestId = ++reqIdRef.current

    setLoading(true)
    setError(null)

    financeApi
      .dashboard({ period, range }, { signal: controller.signal })
      .then((res) => {
        // Only accept response if this is still the active request and wasn't aborted
        if (
          requestId === reqIdRef.current &&
          !controller.signal.aborted &&
          res.period === period &&
          res.range === range
        ) {
          setData(res)
          setError(null)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        const isAbort =
          controller.signal.aborted ||
          (err instanceof Error &&
            (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'))) ||
          (typeof err === 'object' &&
            err !== null &&
            'name' in err &&
            (err as { name: string }).name === 'AbortError')

        // If request is stale or was intentionally aborted, ignore silently
        if (requestId !== reqIdRef.current || isAbort) {
          return
        }

        setError('Gagal memuat analitik dashboard. Pastikan backend aktif.')
        setLoading(false)
      })
  }, [period, range])

  useEffect(() => {
    loadData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [loadData])

  const isCurrentMonth = period === getCurrentPeriod()

  if (loading && !data) return <DashboardLoading />

  if (error && !data) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="alert alert-error">
          <IconAlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={loadData}>
            <IconRefresh size={14} /> Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && (
        <div
          className="alert alert-error"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconAlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadData}>
            <IconRefresh size={13} /> Coba Lagi
          </button>
        </div>
      )}
      {/* ── Top Header Bar with Period Navigator ───────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-h)', letterSpacing: '-0.02em' }}>
            Dashboard & Analitik
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Ikhtisar arus kas menyeluruh, posisi saldo riil, dan kesehatan anggaran
          </p>
        </div>

        {/* Global Period Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '3px 6px',
              gap: 4,
            }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: 6, minWidth: 32 }}
              onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
              title="Bulan sebelumnya"
              aria-label="Pilih bulan sebelumnya"
            >
              <IconChevronLeft size={16} />
            </button>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-h)',
                minWidth: 120,
                textAlign: 'center',
              }}
            >
              {formatMonthLabel(period)}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: 6, minWidth: 32 }}
              onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
              title="Bulan berikutnya"
              aria-label="Pilih bulan berikutnya"
            >
              <IconChevronRight size={16} />
            </button>
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPeriod(getCurrentPeriod())}
              title="Kembali ke bulan berjalan"
            >
              Bulan Ini
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            title="Perbarui data"
            id="dashboard-refresh-btn"
          >
            <IconRefresh size={14} className={loading ? 'spinner' : ''} />
            <span>Perbarui</span>
          </button>
        </div>
      </div>

      {/* ── Balance Hero & Metric Performance ──────────────────────────────── */}
      <BalanceHero
        summary={data.summary}
        period={period}
        onAddTransaction={() => onNavigate('transactions')}
        onAddWallet={() => onNavigate('wallets')}
      />

      {/* ── Cashflow Chart & Category Breakdown ────────────────────────────── */}
      <div className="chart-section">
        <CashflowChart
          series={data.cashflowSeries}
          range={range}
          period={period}
          onRangeChange={(newRange) => setRange(newRange)}
          onAddTransaction={() => onNavigate('transactions')}
        />
        <CategoryBreakdown
          categories={data.categoryBreakdown}
          totalExpense={data.summary.periodExpense}
        />
      </div>

      {/* ── Budget Health, Goals & Wallets Overview ────────────────────────── */}
      <div className="recent-section" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <BudgetHealthWidget
          overview={data.budgetOverview}
          onManageBudgets={() => onNavigate('budgets')}
        />
        <FinancialGoalsWidget
          onManageGoals={() => onNavigate('budgets')}
        />
        <WalletSummaryPanel
          wallets={data.summary.wallets}
          onViewWallets={() => onNavigate('wallets')}
        />
      </div>

      {/* ── Integrated Recent Activity Feed ─────────────────────────────────── */}
      <RecentActivitiesFeed
        activities={data.recentActivities}
        onViewAll={() => onNavigate('transactions')}
        onAddTransaction={() => onNavigate('transactions')}
      />
    </div>
  )
}
