import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { recurringApi, walletApi, categoryApi } from '../services/api'
import type {
  RecurringTransaction,
  RecurringFrequency,
  TransactionType,
  Wallet,
  Category,
  ApiError
} from '../services/types'
import { formatCurrency, formatDate } from '../lib/utils'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconAlertCircle,
  IconCheck,
  IconRepeat,
  IconPlay,
  IconPause,
  IconCalendar,
  IconWallet,
  IconFilter,
} from './Icons'

// ─── Recurring Form Modal ─────────────────────────────────────────────────────

interface RecurringFormModalProps {
  initial?: RecurringTransaction
  wallets: Wallet[]
  categories: Category[]
  onSave: () => void
  onClose: () => void
}

function RecurringFormModal({
  initial,
  wallets,
  categories,
  onSave,
  onClose,
}: RecurringFormModalProps) {
  const editing = !!initial
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'EXPENSE')
  const [walletId, setWalletId] = useState(initial?.walletId ?? wallets[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [amount, setAmount] = useState<string>(initial ? String(initial.amount) : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [frequency, setFrequency] = useState<RecurringFrequency>(initial?.frequency ?? 'MONTHLY')
  const [startDate, setStartDate] = useState(
    initial ? initial.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )
  const [endDate, setEndDate] = useState(initial?.endDate ? initial.endDate.slice(0, 10) : '')
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter categories matching selected type
  const availableCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  )

  useEffect(() => {
    if (!editing && availableCategories.length > 0 && !categoryId) {
      setCategoryId(availableCategories[0].id)
    }
  }, [availableCategories, categoryId, editing])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Nominal transaksi harus lebih besar dari 0.')
      setLoading(false)
      return
    }

    if (!walletId) {
      setError('Pilih dompet yang digunakan.')
      setLoading(false)
      return
    }

    if (!categoryId) {
      setError('Pilih kategori transaksi.')
      setLoading(false)
      return
    }

    try {
      if (editing) {
        await recurringApi.update(initial!.id, {
          walletId,
          categoryId,
          type,
          amount: parsedAmount,
          description: description.trim() || null,
          frequency,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : null,
          isActive,
        })
      } else {
        await recurringApi.create({
          walletId,
          categoryId,
          type,
          amount: parsedAmount,
          description: description.trim() || null,
          frequency,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : null,
          isActive,
        })
      }
      onSave()
      onClose()
    } catch (err: unknown) {
      const e = err as ApiError
      setError(e.message || 'Gagal menyimpan jadwal transaksi rutin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title">
            {editing ? 'Edit Jadwal Transaksi Rutin' : 'Tambah Jadwal Transaksi Rutin'}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
            <IconClose size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error" role="alert">
                <IconAlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* Type selector */}
            <div className="form-group">
              <label className="form-label">Tipe Transaksi</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${type === 'EXPENSE' ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => {
                    setType('EXPENSE')
                    setCategoryId('')
                  }}
                >
                  Pengeluaran Rutin
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${type === 'INCOME' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setType('INCOME')
                    setCategoryId('')
                  }}
                >
                  Pemasukan Rutin
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label" htmlFor="rec-desc">
                Nama / Keterangan Jadwal
              </label>
              <input
                id="rec-desc"
                className="form-input"
                type="text"
                required
                placeholder="Contoh: Langganan Internet, Gaji Bulanan, Sewa Kos"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Nominal */}
            <div className="form-group">
              <label className="form-label" htmlFor="rec-amount">
                Nominal (IDR)
              </label>
              <input
                id="rec-amount"
                className="form-input"
                type="number"
                min="1"
                step="1"
                required
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {/* Wallet & Category row */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="rec-wallet">
                  Dompet
                </label>
                <select
                  id="rec-wallet"
                  className="form-select"
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  required
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatCurrency(w.balance, w.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="rec-category">
                  Kategori
                </label>
                <select
                  id="rec-category"
                  className="form-select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                >
                  {availableCategories.length === 0 ? (
                    <option value="">Tidak ada kategori {type.toLowerCase()}</option>
                  ) : (
                    availableCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Frequency */}
            <div className="form-group">
              <label className="form-label" htmlFor="rec-freq">
                Frekuensi Berulang
              </label>
              <select
                id="rec-freq"
                className="form-select"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
              >
                <option value="DAILY">Harian (Setiap Hari)</option>
                <option value="WEEKLY">Mingguan (Setiap 7 Hari)</option>
                <option value="MONTHLY">Bulanan (Tanggal Sama Setiap Bulan)</option>
              </select>
            </div>

            {/* Dates row */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="rec-start">
                  Tanggal Mulai
                </label>
                <input
                  id="rec-start"
                  className="form-input"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="rec-end">
                  Tanggal Berakhir (Opsional)
                </label>
                <input
                  id="rec-end"
                  className="form-input"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Active Status Checkbox */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="rec-is-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="rec-is-active" style={{ fontSize: 13, color: 'var(--text-h)', cursor: 'pointer' }}>
                Jadwal langsung aktif dan siap diproses
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Buat Jadwal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Recurring Confirmation Modal ─────────────────────────────────────

interface DeleteRecurringConfirmProps {
  recurring: RecurringTransaction
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function DeleteRecurringConfirmModal({
  recurring,
  onConfirm,
  onCancel,
  loading,
}: DeleteRecurringConfirmProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title">Hapus Jadwal Rutin</div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Tutup">
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text)' }}>
            Hapus jadwal transaksi rutin{' '}
            <strong style={{ color: 'var(--text-h)' }}>
              {recurring.description || 'Transaksi Rutin'}
            </strong>?
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Transaksi historis yang sudah pernah tercatat sebelumnya tidak akan dihapus.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={loading}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Menghapus...' : 'Ya, Hapus Jadwal'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Recurring Page Component ───────────────────────────────────────────

export default function RecurringPage() {
  const [recurringList, setRecurringList] = useState<RecurringTransaction[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Actions state
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<RecurringTransaction | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<RecurringTransaction | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [recRes, wallRes, catRes] = await Promise.all([
        recurringApi.list(),
        walletApi.list(),
        categoryApi.list(),
      ])
      setRecurringList(recRes.recurring)
      setWallets(wallRes.wallets)
      setCategories(catRes.categories)
    } catch {
      setError('Gagal memuat data transaksi rutin.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Summary counts
  const summary = useMemo(() => {
    const now = new Date()
    const active = recurringList.filter((r) => r.isActive).length
    const due = recurringList.filter(
      (r) => r.isActive && new Date(r.nextRunDate) <= now && (!r.endDate || new Date(r.nextRunDate) <= new Date(r.endDate))
    ).length
    return { total: recurringList.length, active, due }
  }, [recurringList])

  // Filtered list
  const filteredList = useMemo(() => {
    return recurringList.filter((r) => {
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && r.isActive) ||
        (statusFilter === 'PAUSED' && !r.isActive)
      const matchType = typeFilter === 'ALL' || r.type === typeFilter
      return matchStatus && matchType
    })
  }, [recurringList, statusFilter, typeFilter])

  const handleToggle = async (r: RecurringTransaction) => {
    try {
      await recurringApi.toggle(r.id)
      setFeedback({
        type: 'success',
        message: `Jadwal "${r.description || 'Transaksi'}" berhasil ${!r.isActive ? 'diaktifkan' : 'dijeda'}.`,
      })
      loadData()
    } catch (err: unknown) {
      const e = err as ApiError
      setFeedback({ type: 'error', message: e.message || 'Gagal mengubah status.' })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await recurringApi.delete(deleteTarget.id)
      setFeedback({ type: 'success', message: 'Jadwal transaksi rutin berhasil dihapus.' })
      setDeleteTarget(null)
      loadData()
    } catch (err: unknown) {
      const e = err as ApiError
      setFeedback({ type: 'error', message: e.message || 'Gagal menghapus jadwal.' })
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleProcessDue = async () => {
    setProcessing(true)
    try {
      const res = await recurringApi.process()
      if (res.processedCount > 0) {
        setFeedback({
          type: 'success',
          message: `Berhasil memproses ${res.processedCount} transaksi rutin jatuh tempo secara atomik!`,
        })
      } else {
        setFeedback({
          type: 'success',
          message: 'Semua transaksi rutin sudah diproses. Tidak ada yang jatuh tempo saat ini.',
        })
      }
      loadData()
    } catch (err: unknown) {
      const e = err as ApiError
      setFeedback({ type: 'error', message: e.message || 'Gagal memproses transaksi jatuh tempo.' })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h2>Transaksi Rutin & Berulang</h2>
          <p>Otomatisasi pencatatan tagihan, langganan, dan pemasukan berkala</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleProcessDue}
            disabled={processing || summary.due === 0}
            title={summary.due > 0 ? `Terdapat ${summary.due} jadwal jatuh tempo` : 'Tidak ada jadwal jatuh tempo'}
          >
            {processing ? (
              <>
                <span className="spinner" style={{ width: 13, height: 13 }} />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <IconPlay size={14} style={{ color: summary.due > 0 ? 'var(--income)' : undefined }} />
                <span>Proses Jatuh Tempo ({summary.due})</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditTarget(undefined)
              setShowForm(true)
            }}
          >
            <IconPlus size={14} />
            <span>Tambah Jadwal</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-error'}`}
          role="alert"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {feedback.type === 'success' ? (
            <IconCheck size={16} style={{ color: 'var(--income)' }} />
          ) : (
            <IconAlertCircle size={16} />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Explanatory callout banner */}
      <div
        className="card"
        style={{
          marginBottom: 16,
          background: 'rgba(99, 102, 241, 0.05)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconRepeat size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>
            <strong>Mekanisme Eksekusi Aman:</strong> Jadwal transaksi berulang dikelola secara atomik dan idempoten oleh server Velora. Transaksi jatuh tempo dapat dieksekusi secara instan dengan tombol <em>Proses Jatuh Tempo</em> di atas atau melalui trigger server berkala tanpa menduplikasi data pada periode yang sama.
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Jadwal</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-h)', marginTop: 4 }}>
            {summary.total}
          </div>
        </div>
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jadwal Aktif</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
            {summary.active} Berjalan
          </div>
        </div>
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jatuh Tempo Hari Ini</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: summary.due > 0 ? 'var(--income)' : 'var(--text-muted)', marginTop: 4 }}>
            {summary.due} Siap Eksekusi
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconFilter size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            className="form-select"
            style={{ fontSize: 13, padding: '7px 12px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'PAUSED')}
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Hanya Aktif</option>
            <option value="PAUSED">Hanya Dijeda</option>
          </select>
        </div>

        <select
          className="form-select"
          style={{ fontSize: 13, padding: '7px 12px' }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'INCOME' | 'EXPENSE')}
        >
          <option value="ALL">Semua Tipe</option>
          <option value="EXPENSE">Pengeluaran Saja</option>
          <option value="INCOME">Pemasukan Saja</option>
        </select>
      </div>

      {/* Recurring List */}
      {loading ? (
        <div className="page-loading">
          <span className="spinner" style={{ width: 22, height: 22 }} />
          <span>Memuat daftar transaksi rutin...</span>
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : filteredList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconRepeat size={22} />
          </div>
          <div className="empty-state-title">Belum ada transaksi rutin</div>
          <div className="empty-state-sub">
            Buat jadwal transaksi berkala untuk pembayaran otomatis seperti langganan, sewa, atau pemasukan rutin.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => {
              setEditTarget(undefined)
              setShowForm(true)
            }}
          >
            <IconPlus size={14} /> Tambah Jadwal Baru
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredList.map((r) => {
            const isDue = r.isActive && new Date(r.nextRunDate) <= new Date() && (!r.endDate || new Date(r.nextRunDate) <= new Date(r.endDate))
            const isIncome = r.type === 'INCOME'
            return (
              <div
                key={r.id}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  opacity: r.isActive ? 1 : 0.65,
                  borderLeft: `4px solid ${isIncome ? 'var(--income)' : 'var(--expense)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: isIncome ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      color: isIncome ? 'var(--income)' : 'var(--expense)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <IconRepeat size={18} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-h)' }}>
                        {r.description || r.category?.name || 'Transaksi Rutin'}
                      </span>
                      <span
                        className="badge"
                        style={{
                          fontSize: 10,
                          background: r.isActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                          color: r.isActive ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        {r.frequency === 'DAILY' ? 'Harian' : r.frequency === 'WEEKLY' ? 'Mingguan' : 'Bulanan'}
                      </span>
                      {isDue && (
                        <span className="badge badge-status-normal" style={{ fontSize: 10 }}>
                          Jatuh Tempo
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IconWallet size={12} /> {r.wallet?.name || 'Dompet'}
                      </span>
                      <span>•</span>
                      <span>{r.category?.name || 'Kategori'}</span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IconCalendar size={12} /> Jadwal Berikutnya: {formatDate(r.nextRunDate)}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: isIncome ? 'var(--income)' : 'var(--expense)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {isIncome ? '+' : '-'}{formatCurrency(r.amount)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {r.isActive ? 'Status: Aktif' : 'Status: Dijeda'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleToggle(r)}
                      title={r.isActive ? 'Jeda transaksi rutin ini' : 'Aktifkan kembali'}
                    >
                      {r.isActive ? <IconPause size={14} /> : <IconPlay size={14} />}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setEditTarget(r)
                        setShowForm(true)
                      }}
                      title="Ubah jadwal"
                    >
                      <IconEdit size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--expense)' }}
                      onClick={() => setDeleteTarget(r)}
                      title="Hapus jadwal"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <RecurringFormModal
          initial={editTarget}
          wallets={wallets}
          categories={categories}
          onSave={loadData}
          onClose={() => setShowForm(false)}
        />
      )}

      {deleteTarget && (
        <DeleteRecurringConfirmModal
          recurring={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  )
}
