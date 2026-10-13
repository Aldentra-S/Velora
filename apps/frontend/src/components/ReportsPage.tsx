import { useState, useEffect, useCallback, useMemo } from 'react'
import { reportApi, walletApi, categoryApi } from '../services/api'
import type {
  FinancialReportData,
  ReportPeriodType,
  Wallet,
  Category,
  TransactionType,
  ApiError,
} from '../services/types'
import { formatCurrency, formatDate } from '../lib/utils'
import {
  IconDownload,
  IconPrinter,
  IconWallet,
  IconCategory,
  IconIncome,
  IconExpense,
  IconChevronLeft,
  IconChevronRight,
} from './Icons'

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

export default function ReportsPage() {
  const now = new Date()
  const [periodType, setPeriodType] = useState<ReportPeriodType>('monthly')
  const [year, setYear] = useState<number>(now.getUTCFullYear())
  const [month, setMonth] = useState<number>(now.getUTCMonth() + 1)
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  )
  const [endDate, setEndDate] = useState<string>(now.toISOString().slice(0, 10))

  const [walletId, setWalletId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [type, setType] = useState<TransactionType | ''>('')
  const [page, setPage] = useState<number>(1)

  // Data states
  const [reportData, setReportData] = useState<FinancialReportData | null>(null)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [exportingCsv, setExportingCsv] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Load auxiliary options
  useEffect(() => {
    async function loadAux() {
      try {
        const [wRes, cRes] = await Promise.all([walletApi.list(), categoryApi.list()])
        setWallets(wRes.wallets)
        setCategories(cRes.categories)
      } catch {
        // ignore
      }
    }
    loadAux()
  }, [])

  // Load report analytics
  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await reportApi.getAnalytics({
        periodType,
        year: periodType !== 'custom' ? year : undefined,
        month: periodType === 'monthly' ? month : undefined,
        startDate: periodType === 'custom' ? startDate : undefined,
        endDate: periodType === 'custom' ? endDate : undefined,
        walletId: walletId || undefined,
        categoryId: categoryId || undefined,
        type: type || undefined,
        page,
        limit: 25,
      })
      setReportData(res)
    } catch (err: unknown) {
      const e = err as ApiError
      setError(e.message || 'Gagal memuat laporan keuangan.')
    } finally {
      setLoading(false)
    }
  }, [periodType, year, month, startDate, endDate, walletId, categoryId, type, page])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const handleExportCsv = async () => {
    setExportingCsv(true)
    try {
      await reportApi.downloadCsv({
        periodType,
        year: periodType !== 'custom' ? year : undefined,
        month: periodType === 'monthly' ? month : undefined,
        startDate: periodType === 'custom' ? startDate : undefined,
        endDate: periodType === 'custom' ? endDate : undefined,
        walletId: walletId || undefined,
        categoryId: categoryId || undefined,
        type: type || undefined,
      })
    } catch (err: unknown) {
      const e = err as ApiError
      alert(e.message || 'Gagal mengunduh CSV.')
    } finally {
      setExportingCsv(false)
    }
  }

  const handlePrintPdf = () => {
    window.print()
  }

  // Filtered categories according to selected type if any
  const availableCategories = useMemo(() => {
    if (!type) return categories
    return categories.filter((c) => c.type === type)
  }, [categories, type])

  return (
    <div className="page reports-container">
      {/* ── Screen-only Header & Actions ───────────────────────────────────── */}
      <div className="page-header no-print">
        <div className="page-header-text">
          <h2>Laporan Keuangan Eksekutif</h2>
          <p>Analisis komprehensif arus kas, anggaran, dan distribusi pos pengeluaran</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCsv}
            disabled={exportingCsv || !reportData}
            title="Unduh laporan dalam format CSV (Aman formula injection)"
          >
            {exportingCsv ? (
              <>
                <span className="spinner" style={{ width: 13, height: 13 }} />
                <span>Mengekspor...</span>
              </>
            ) : (
              <>
                <IconDownload size={14} />
                <span>Ekspor CSV</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handlePrintPdf}
            disabled={!reportData}
            title="Cetak laporan atau simpan sebagai dokumen PDF"
          >
            <IconPrinter size={14} />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* ── Print Header (Only visible on Print / PDF) ─────────────────────── */}
      <div className="print-only" style={{ display: 'none', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#0f172a' }}>VELORA — LAPORAN KEUANGAN</h1>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
              Periode: <strong>{reportData?.period.label}</strong>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
            Dicetak pada: {new Date().toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* ── Filter Bar (Hidden on print) ──────────────────────────────────── */}
      <div className="card no-print" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Row 1: Period Type Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn${periodType === 'monthly' ? ' active' : ''}`}
                onClick={() => {
                  setPeriodType('monthly')
                  setPage(1)
                }}
              >
                Laporan Bulanan
              </button>
              <button
                type="button"
                className={`segmented-btn${periodType === 'yearly' ? ' active' : ''}`}
                onClick={() => {
                  setPeriodType('yearly')
                  setPage(1)
                }}
              >
                Laporan Tahunan
              </button>
              <button
                type="button"
                className={`segmented-btn${periodType === 'custom' ? ' active' : ''}`}
                onClick={() => {
                  setPeriodType('custom')
                  setPage(1)
                }}
              >
                Rentang Kustom
              </button>
            </div>

            {/* Period date selectors */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {periodType === 'monthly' && (
                <>
                  <select
                    className="form-select"
                    style={{ fontSize: 13 }}
                    value={month}
                    onChange={(e) => {
                      setMonth(Number(e.target.value))
                      setPage(1)
                    }}
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    className="form-select"
                    style={{ fontSize: 13 }}
                    value={year}
                    onChange={(e) => {
                      setYear(Number(e.target.value))
                      setPage(1)
                    }}
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {periodType === 'yearly' && (
                <select
                  className="form-select"
                  style={{ fontSize: 13 }}
                  value={year}
                  onChange={(e) => {
                    setYear(Number(e.target.value))
                    setPage(1)
                  }}
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      Tahun {y}
                    </option>
                  ))}
                </select>
              )}

              {periodType === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="date"
                    className="form-input"
                    style={{ fontSize: 12, padding: '6px 10px' }}
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setPage(1)
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>s/d</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ fontSize: 12, padding: '6px 10px' }}
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setPage(1)
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Entity Filters (Wallet, Category, Type) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconWallet size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                className="form-select"
                style={{ fontSize: 12, padding: '6px 10px' }}
                value={walletId}
                onChange={(e) => {
                  setWalletId(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Semua Dompet</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconCategory size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                className="form-select"
                style={{ fontSize: 12, padding: '6px 10px' }}
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Semua Kategori</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <select
              className="form-select"
              style={{ fontSize: 12, padding: '6px 10px' }}
              value={type}
              onChange={(e) => {
                setType(e.target.value as TransactionType | '')
                setCategoryId('')
                setPage(1)
              }}
            >
              <option value="">Semua Tipe Transaksi</option>
              <option value="INCOME">Hanya Pemasukan</option>
              <option value="EXPENSE">Hanya Pengeluaran</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && !reportData ? (
        <div className="page-loading">
          <span className="spinner" style={{ width: 22, height: 22 }} />
          <span>Menyusun laporan keuangan...</span>
        </div>
      ) : reportData ? (
        <>
          {/* ── Key Financial KPI Cards ───────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
            {/* Total Income Card */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Pemasukan</span>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: 'var(--income)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <IconIncome size={15} />
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-h)', marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(reportData.summary.totalIncome)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11.5 }}>
                <span
                  style={{
                    color: reportData.summary.comparison.incomeChangePct >= 0 ? 'var(--income)' : 'var(--expense)',
                    fontWeight: 600,
                  }}
                >
                  {reportData.summary.comparison.incomeChangePct >= 0 ? '+' : ''}
                  {reportData.summary.comparison.incomeChangePct}%
                </span>
                <span style={{ color: 'var(--text-muted)' }}>vs periode lalu ({formatCurrency(reportData.summary.comparison.prevIncome)})</span>
              </div>
            </div>

            {/* Total Expense Card */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Pengeluaran</span>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: 'var(--expense)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <IconExpense size={15} />
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-h)', marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(reportData.summary.totalExpense)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11.5 }}>
                <span
                  style={{
                    color: reportData.summary.comparison.expenseChangePct <= 0 ? 'var(--income)' : 'var(--expense)',
                    fontWeight: 600,
                  }}
                >
                  {reportData.summary.comparison.expenseChangePct >= 0 ? '+' : ''}
                  {reportData.summary.comparison.expenseChangePct}%
                </span>
                <span style={{ color: 'var(--text-muted)' }}>vs periode lalu ({formatCurrency(reportData.summary.comparison.prevExpense)})</span>
              </div>
            </div>

            {/* Net Cashflow Card */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Net Cashflow (Arus Kas Bersih)</span>
                <span
                  className="badge"
                  style={{
                    fontSize: 10,
                    background: reportData.summary.netCashflow >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: reportData.summary.netCashflow >= 0 ? 'var(--income)' : 'var(--expense)',
                  }}
                >
                  {reportData.summary.netCashflow >= 0 ? 'Surplus' : 'Defisit'}
                </span>
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: reportData.summary.netCashflow >= 0 ? 'var(--income)' : 'var(--expense)',
                  marginTop: 8,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {reportData.summary.netCashflow >= 0 ? '+' : ''}
                {formatCurrency(reportData.summary.netCashflow)}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                Netral terhadap mutasi transfer antardompet
              </div>
            </div>

            {/* Savings Rate Card */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tingkat Tabungan (Savings Rate)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                  {reportData.summary.savingsRate}%
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="budget-progress-track">
                  <div
                    className="budget-progress-bar"
                    style={{
                      width: `${Math.min(reportData.summary.savingsRate, 100)}%`,
                      backgroundColor: 'var(--accent)',
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
                {reportData.summary.savingsRate >= 20 ? 'Kondisi tabungan sangat sehat (≥20%)' : 'Perlu evaluasi pos pengeluaran'}
              </div>
            </div>
          </div>

          {/* ── Category Breakdown Section ─────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header-row">
              <h3>Distribusi Pengeluaran Berdasarkan Kategori</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {reportData.categoryBreakdown.length} Pos Pengeluaran
              </span>
            </div>

            {reportData.categoryBreakdown.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Tidak ada pengeluaran tercatat pada periode ini.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {reportData.categoryBreakdown.map((cat) => (
                  <div key={cat.categoryId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: cat.categoryColor,
                            display: 'inline-block',
                          }}
                        />
                        <span style={{ fontWeight: 500, color: 'var(--text-h)' }}>{cat.categoryName}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({cat.count} transaksi)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-h)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(cat.amount)}
                        </span>
                        <span className="badge" style={{ fontSize: 11, minWidth: 40, textAlign: 'center' }}>
                          {cat.percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="budget-progress-track">
                      <div
                        className="budget-progress-bar"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: cat.categoryColor,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Budget Summary Section (if monthly) ───────────────────────── */}
          {reportData.budgetsSummary && reportData.budgetsSummary.items.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header-row">
                <h3>Evaluasi Realisasi Anggaran Bulanan</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Total Pagu: {formatCurrency(reportData.budgetsSummary.totalLimit)} • Terpakai: {formatCurrency(reportData.budgetsSummary.totalSpent)}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kategori</th>
                      <th style={{ textAlign: 'right' }}>Batas Pagu</th>
                      <th style={{ textAlign: 'right' }}>Realisasi Pengeluaran</th>
                      <th style={{ textAlign: 'right' }}>Sisa Dana</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.budgetsSummary.items.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-h)' }}>{b.categoryName}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(b.limit)}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatCurrency(b.spent)}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: b.limit - b.spent < 0 ? 'var(--expense)' : 'var(--income)' }}>
                          {formatCurrency(b.limit - b.spent)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${
                              b.status === 'EXCEEDED'
                                ? 'badge-status-exceeded'
                                : b.status === 'WARNING'
                                ? 'badge-status-warning'
                                : 'badge-status-normal'
                            }`}
                          >
                            {b.status === 'EXCEEDED' ? 'Melampaui Pagu' : b.status === 'WARNING' ? 'Peringatan (≥80%)' : 'Aman (Normal)'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Supporting Transactions Table ─────────────────────────────── */}
          <div className="card">
            <div className="card-header-row">
              <h3>Rincian Transaksi Pendukung Laporan</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Menampilkan {reportData.transactions.items.length} dari {reportData.transactions.pagination.total} transaksi
              </span>
            </div>

            {reportData.transactions.items.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Tidak ada transaksi pendukung pada kriteria filter ini.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Tipe</th>
                      <th>Kategori</th>
                      <th>Dompet</th>
                      <th>Deskripsi</th>
                      <th style={{ textAlign: 'right' }}>Nominal (IDR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.transactions.items.map((tx) => {
                      const isInc = tx.type === 'INCOME'
                      return (
                        <tr key={tx.id}>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDate(tx.date)}
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                fontSize: 10,
                                background: isInc ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: isInc ? 'var(--income)' : 'var(--expense)',
                              }}
                            >
                              {isInc ? 'Pemasukan' : 'Pengeluaran'}
                            </span>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-h)' }}>{tx.category?.name}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tx.wallet?.name}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.description || '—'}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              fontVariantNumeric: 'tabular-nums',
                              color: isInc ? 'var(--income)' : 'var(--expense)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isInc ? '+' : '-'}{formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls (hidden on print) */}
            {reportData.transactions.pagination.totalPages > 1 && (
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Halaman {reportData.transactions.pagination.page} dari {reportData.transactions.pagination.totalPages}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  >
                    <IconChevronLeft size={14} /> Sebelumnya
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={page >= reportData.transactions.pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Berikutnya <IconChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Embedded Print CSS for clean browser PDF export */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: sans-serif !important;
          }
          .sidebar, .topbar, .no-print, .btn, .segmented-control {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .app-shell, .main-content, .page, .reports-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          .card {
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            color: #0f172a !important;
            page-break-inside: avoid;
            margin-bottom: 16px !important;
          }
          .data-table {
            color: #0f172a !important;
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .data-table th, .data-table td {
            border: 1px solid #e2e8f0 !important;
            color: #0f172a !important;
            padding: 6px 8px !important;
          }
          .badge {
            border: 1px solid #94a3b8 !important;
          }
        }
      `}</style>
    </div>
  )
}
