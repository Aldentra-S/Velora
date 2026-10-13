import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { transactionApi, walletApi, categoryApi } from '../services/api'
import type {
  Transaction,
  Wallet,
  Category,
  TransactionType,
  Pagination,
  ApiError,
} from '../services/types'
import { formatCurrency, formatDate, categoryColor } from '../lib/utils'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconTransaction,
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconIncome,
  IconExpense,
  IconTransfer,
  IconCheck,
  IconSearch,
  IconRefresh,
  IconEye,
} from './Icons'
import { TransferModal } from './TransferModal'

// ─── Transaction Detail Modal ─────────────────────────────────────────────────

interface TxDetailProps {
  transaction: Transaction
  onClose: () => void
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}

function TransactionDetailModal({ transaction, onClose, onEdit, onDelete }: TxDetailProps) {
  const isIncome = transaction.type === 'INCOME'
  const catColor = categoryColor(transaction.category?.color)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="tx-detail-title">
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" id="tx-detail-title">
            Detail Transaksi
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup detail">
            <IconClose size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Hero Amount Display */}
          <div
            style={{
              padding: '18px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isIncome ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${isIncome ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              textAlign: 'center',
            }}
          >
            <span
              className="badge"
              style={{
                marginBottom: 8,
                backgroundColor: isIncome ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isIncome ? 'var(--income)' : 'var(--expense)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {isIncome ? <IconIncome size={13} /> : <IconExpense size={13} />}
              {isIncome ? 'Pemasukan' : 'Pengeluaran'}
            </span>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: isIncome ? 'var(--income)' : 'var(--expense)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {isIncome ? '+' : '-'}{formatCurrency(transaction.amount, transaction.wallet?.currency)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {transaction.description || 'Tidak ada catatan'}
            </div>
          </div>

          {/* Key-Value Details Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-subtle)',
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Waktu Transaksi</span>
              <span style={{ fontWeight: 500, color: 'var(--text-h)' }}>
                {new Date(transaction.date).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-subtle)',
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Kategori</span>
              <span
                className="badge"
                style={{
                  backgroundColor: `${catColor}18`,
                  color: catColor,
                  border: `1px solid ${catColor}35`,
                }}
              >
                {transaction.category?.name || 'Tanpa Kategori'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-subtle)',
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Dompet / Rekening</span>
              <span style={{ fontWeight: 500, color: 'var(--text-h)' }}>
                {transaction.wallet?.name} ({transaction.wallet?.currency || 'IDR'})
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-subtle)',
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>ID Transaksi</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                {transaction.id}
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              onClose()
              onDelete(transaction)
            }}
          >
            <IconTrash size={14} /> Hapus
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Tutup
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                onClose()
                onEdit(transaction)
              }}
            >
              <IconEdit size={14} /> Ubah
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Transaction Form Modal ───────────────────────────────────────────────────

interface TxFormProps {
  initial?: Transaction
  wallets: Wallet[]
  categories: Category[]
  onSave: () => void
  onClose: () => void
}

function TransactionForm({ initial, wallets, categories, onSave, onClose }: TxFormProps) {
  const editing = !!initial
  const [walletId, setWalletId] = useState(initial?.walletId ?? (wallets[0]?.id ?? ''))
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'EXPENSE')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [amount, setAmount] = useState(initial ? parseFloat(initial.amount).toString() : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [date, setDate] = useState(
    initial
      ? new Date(initial.date).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredCategories = categories.filter((c) => c.type === type)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!filteredCategories.find((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0]?.id ?? '')
    }
  }, [type, filteredCategories, categoryId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Nominal harus berupa angka lebih besar dari 0.')
      setLoading(false)
      return
    }

    if (!walletId) {
      setError('Pilih dompet tujuan.')
      setLoading(false)
      return
    }

    if (!categoryId) {
      setError('Pilih kategori yang sesuai.')
      setLoading(false)
      return
    }

    try {
      const body = {
        walletId,
        categoryId,
        type,
        amount: parsedAmount,
        description: description.trim() || undefined,
        date: new Date(date).toISOString(),
      }
      if (editing) {
        await transactionApi.update(initial!.id, body)
      } else {
        await transactionApi.create(body)
      }
      onSave()
      onClose()
    } catch (err: unknown) {
      const e = err as ApiError
      setError(e.message || 'Gagal menyimpan transaksi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title" id="tx-modal-title">
            {editing ? 'Edit Transaksi' : 'Catat Transaksi'}
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

            {/* Type toggle */}
            <div className="form-group">
              <label className="form-label">Jenis Arus Kas</label>
              <div className="segmented-control" style={{ width: '100%' }}>
                <button
                  type="button"
                  className={`segmented-btn${type === 'EXPENSE' ? ' active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setType('EXPENSE')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <IconExpense size={14} /> Pengeluaran
                  </span>
                </button>
                <button
                  type="button"
                  className={`segmented-btn${type === 'INCOME' ? ' active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setType('INCOME')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <IconIncome size={14} /> Pemasukan
                  </span>
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="form-group">
              <label className="form-label" htmlFor="tx-amount">
                Nominal (Rp)
              </label>
              <input
                id="tx-amount"
                className="form-input"
                type="number"
                min="1"
                step="1"
                required
                placeholder="Contoh: 50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {/* Wallet & Category */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="tx-wallet">
                  Dompet
                </label>
                <select
                  id="tx-wallet"
                  className="form-select"
                  required
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="tx-category">
                  Kategori
                </label>
                <select
                  id="tx-category"
                  className="form-select"
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {filteredCategories.length === 0 ? (
                    <option value="">Tidak ada kategori {type}</option>
                  ) : (
                    filteredCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label" htmlFor="tx-desc">
                Keterangan / Catatan
              </label>
              <input
                id="tx-desc"
                className="form-input"
                type="text"
                placeholder="Contoh: Makan siang bersama tim"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Date */}
            <div className="form-group">
              <label className="form-label" htmlFor="tx-date">
                Waktu Transaksi
              </label>
              <input
                id="tx-date"
                className="form-input"
                type="datetime-local"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={loading || !walletId || !categoryId}
            >
              {loading ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Catat Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

interface DeleteTxConfirmProps {
  transaction: Transaction
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function DeleteTxConfirmModal({ transaction, onConfirm, onCancel, loading }: DeleteTxConfirmProps) {
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
        style={{ maxWidth: 400 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title">Hapus Transaksi</div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Tutup">
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text)' }}>
            Hapus catatan transaksi{' '}
            <strong style={{ color: 'var(--text-h)' }}>{transaction.description || 'ini'}</strong>{' '}
            senilai{' '}
            <strong style={{ color: 'var(--text-h)' }}>
              {formatCurrency(transaction.amount, transaction.wallet?.currency)}
            </strong>
            ?
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Saldo dompet terkait akan disesuaikan kembali secara otomatis dan aman.
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
            {loading ? 'Menghapus...' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Transactions Page Component ──────────────────────────────────────────────

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Search & Sort
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<TransactionType | ''>('')
  const [filterWallet, setFilterWallet] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [datePreset, setDatePreset] = useState<'ALL' | 'THIS_MONTH' | 'LAST_7D' | 'LAST_30D' | 'CUSTOM'>('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'createdAt'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modals & UI States
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Transaction | undefined>()
  const [detailTarget, setDetailTarget] = useState<Transaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)

  // Auto-dismiss success notification
  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [actionSuccess])

  // Load auxiliary data
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

  // Calculate actual date boundaries based on preset
  const computedDateRange = useMemo(() => {
    if (datePreset === 'ALL') return { start: undefined, end: undefined }
    const now = new Date()

    if (datePreset === 'THIS_MONTH') {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString()
      return { start, end }
    }

    if (datePreset === 'LAST_7D') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      return { start, end: now.toISOString() }
    }

    if (datePreset === 'LAST_30D') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      return { start, end: now.toISOString() }
    }

    if (datePreset === 'CUSTOM') {
      return {
        start: startDate ? `${startDate}T00:00:00.000Z` : undefined,
        end: endDate ? `${endDate}T23:59:59.999Z` : undefined,
      }
    }

    return { start: undefined, end: undefined }
  }, [datePreset, startDate, endDate])

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await transactionApi.list({
        page,
        limit: 15,
        type: filterType || undefined,
        walletId: filterWallet || undefined,
        categoryId: filterCategory || undefined,
        search: search.trim() || undefined,
        startDate: computedDateRange.start,
        endDate: computedDateRange.end,
        sortBy,
        sortOrder,
      })
      setTransactions(res.transactions)
      setPagination(res.pagination)
    } catch {
      setError('Gagal memuat daftar transaksi. Pastikan server backend aktif.')
    } finally {
      setLoading(false)
    }
  }, [page, filterType, filterWallet, filterCategory, search, computedDateRange, sortBy, sortOrder])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setActionError(null)
    try {
      await transactionApi.delete(deleteTarget.id)
      setActionSuccess('Transaksi berhasil dihapus dan saldo dompet telah disesuaikan.')
      setDeleteTarget(null)
      loadTransactions()
    } catch (err: unknown) {
      const e = err as ApiError
      setActionError(e.message || 'Gagal menghapus transaksi.')
      setDeleteTarget(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleResetFilters = () => {
    setSearch('')
    setFilterType('')
    setFilterWallet('')
    setFilterCategory('')
    setDatePreset('ALL')
    setStartDate('')
    setEndDate('')
    setSortBy('date')
    setSortOrder('desc')
    setPage(1)
  }

  const isFilterActive =
    search.trim() !== '' ||
    filterType !== '' ||
    filterWallet !== '' ||
    filterCategory !== '' ||
    datePreset !== 'ALL' ||
    sortBy !== 'date' ||
    sortOrder !== 'desc'

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-text">
          <h2>Buku Transaksi</h2>
          <p>Catatan arus kas pemasukan dan pengeluaran dengan pencarian & filter komprehensif</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            id="tx-open-transfer-btn"
            onClick={() => setShowTransferModal(true)}
            disabled={wallets.length < 2}
            title={wallets.length < 2 ? 'Minimal diperlukan 2 dompet' : 'Transfer Antardompet'}
          >
            <IconTransfer size={14} />
            <span>Transfer Saldo</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            id="add-tx-btn"
            onClick={() => {
              setEditTarget(undefined)
              setShowForm(true)
            }}
          >
            <IconPlus size={14} />
            <span>Catat Transaksi</span>
          </button>
        </div>
      </div>

      {/* ── Notifications ────────────────────────────────────────────────────── */}
      {actionSuccess && (
        <div className="alert alert-success" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCheck size={16} style={{ color: 'var(--income)' }} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconAlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* ── Filter Bar & Search ──────────────────────────────────────────────── */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '14px 16px',
        }}
      >
        {/* Row 1: Search & Type Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <span
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              <IconSearch size={15} />
            </span>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 32, paddingRight: search ? 30 : 12, fontSize: 13 }}
              placeholder="Cari transaksi, kategori, dompet..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              aria-label="Pencarian transaksi"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setPage(1)
                }}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                }}
                aria-label="Hapus kata kunci"
              >
                <IconClose size={13} />
              </button>
            )}
          </div>

          {/* Type Segmented Filter */}
          <div className="segmented-control" style={{ flexShrink: 0 }}>
            <button
              type="button"
              className={`segmented-btn${filterType === '' ? ' active' : ''}`}
              onClick={() => {
                setFilterType('')
                setPage(1)
              }}
            >
              Semua
            </button>
            <button
              type="button"
              className={`segmented-btn${filterType === 'EXPENSE' ? ' active' : ''}`}
              onClick={() => {
                setFilterType('EXPENSE')
                setPage(1)
              }}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              className={`segmented-btn${filterType === 'INCOME' ? ' active' : ''}`}
              onClick={() => {
                setFilterType('INCOME')
                setPage(1)
              }}
            >
              Pemasukan
            </button>
          </div>
        </div>

        {/* Row 2: Dropdown Filters & Sorting */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Wallet filter */}
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 130, fontSize: 12.5 }}
            value={filterWallet}
            onChange={(e) => {
              setFilterWallet(e.target.value)
              setPage(1)
            }}
            aria-label="Filter dompet"
          >
            <option value="">Semua Dompet</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          {/* Category filter */}
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 140, fontSize: 12.5 }}
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value)
              setPage(1)
            }}
            aria-label="Filter kategori"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type === 'INCOME' ? 'Masuk' : 'Keluar'})
              </option>
            ))}
          </select>

          {/* Date range preset */}
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 130, fontSize: 12.5 }}
            value={datePreset}
            onChange={(e) => {
              setDatePreset(e.target.value as any)
              setPage(1)
            }}
            aria-label="Filter rentang tanggal"
          >
            <option value="ALL">Semua Waktu</option>
            <option value="THIS_MONTH">Bulan Berjalan</option>
            <option value="LAST_7D">7 Hari Terakhir</option>
            <option value="LAST_30D">30 Hari Terakhir</option>
            <option value="CUSTOM">Kustom Tanggal...</option>
          </select>

          {/* Custom Date Inputs if CUSTOM selected */}
          {datePreset === 'CUSTOM' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
                title="Tanggal awal"
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>s/d</span>
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPage(1)
                }}
                title="Tanggal akhir"
              />
            </div>
          )}

          {/* Sorting control */}
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 150, fontSize: 12.5, marginLeft: 'auto' }}
            value={`${sortBy}_${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split('_') as [any, any]
              setSortBy(sb)
              setSortOrder(so)
              setPage(1)
            }}
            aria-label="Urutan transaksi"
          >
            <option value="date_desc">Tanggal Terbaru</option>
            <option value="date_asc">Tanggal Terlama</option>
            <option value="amount_desc">Nominal Tertinggi</option>
            <option value="amount_asc">Nominal Terendah</option>
          </select>

          {/* Reset Filters Button */}
          {isFilterActive && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleResetFilters}
              title="Reset semua filter"
              style={{ fontSize: 12, color: 'var(--accent)' }}
            >
              <IconRefresh size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Transactions Data Display ────────────────────────────────────────── */}
      {loading ? (
        <div className="page-loading">
          <span className="spinner" style={{ width: 22, height: 22 }} />
          <span>Memuat transaksi...</span>
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconTransaction size={22} />
          </div>
          <div className="empty-state-title">
            {isFilterActive ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi tercatat'}
          </div>
          <div className="empty-state-sub">
            {isFilterActive
              ? 'Coba sesuaikan kata kunci pencarian, filter kategori, atau rentang tanggal.'
              : 'Mulai kelola keuangan Anda dengan mencatat transaksi pemasukan atau pengeluaran pertama.'}
          </div>
          {isFilterActive ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 8 }}
              onClick={handleResetFilters}
            >
              <IconRefresh size={14} /> Reset Filter
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                setEditTarget(undefined)
                setShowForm(true)
              }}
            >
              <IconPlus size={14} /> Catat Transaksi Baru
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          {/* Header Info */}
          <div
            style={{
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: 12.5,
              color: 'var(--text-muted)',
            }}
          >
            <div>
              Menampilkan {transactions.length} dari {pagination?.total ?? transactions.length} transaksi
            </div>
            {isFilterActive && (
              <span className="badge badge-status-normal" style={{ fontSize: 11 }}>
                Filter Aktif
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th>Kategori</th>
                  <th>Dompet</th>
                  <th style={{ textAlign: 'right' }}>Nominal</th>
                  <th style={{ textAlign: 'center', width: 110 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isIncome = tx.type === 'INCOME'
                  const catColor = categoryColor(tx.category?.color)
                  return (
                    <tr
                      key={tx.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setDetailTarget(tx)}
                      title="Klik untuk melihat detail lengkap"
                    >
                      <td style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatDate(tx.date)}
                      </td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--text-h)', fontWeight: 500 }}>
                          {tx.description || 'Transaksi'}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: `${catColor}18`,
                            color: catColor,
                            border: `1px solid ${catColor}35`,
                          }}
                        >
                          {tx.category?.name || 'Tanpa Kategori'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {tx.wallet?.name}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          color: isIncome ? 'var(--income)' : 'var(--expense)',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isIncome ? '+' : '-'}{formatCurrency(tx.amount, tx.wallet?.currency)}
                      </td>
                      <td
                        style={{ textAlign: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDetailTarget(tx)}
                            title="Lihat Detail"
                            aria-label="Lihat detail transaksi"
                          >
                            <IconEye size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setEditTarget(tx)
                              setShowForm(true)
                            }}
                            title="Ubah"
                            aria-label="Ubah transaksi"
                          >
                            <IconEdit size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--expense)' }}
                            onClick={() => setDeleteTarget(tx)}
                            title="Hapus"
                            aria-label="Hapus transaksi"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {pagination && pagination.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: 12.5,
              }}
            >
              <div style={{ color: 'var(--text-muted)' }}>
                Halaman {pagination.page} dari {pagination.totalPages}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  aria-label="Halaman sebelumnya"
                >
                  <IconChevronLeft size={14} />
                  <span>Sebelumnya</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Halaman berikutnya"
                >
                  <span>Berikutnya</span>
                  <IconChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {showForm && (
        <TransactionForm
          initial={editTarget}
          wallets={wallets}
          categories={categories}
          onSave={() => {
            setActionSuccess(editTarget ? 'Perubahan transaksi berhasil disimpan.' : 'Transaksi baru berhasil dicatat.')
            loadTransactions()
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      {detailTarget && (
        <TransactionDetailModal
          transaction={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={(tx) => {
            setDetailTarget(null)
            setEditTarget(tx)
            setShowForm(true)
          }}
          onDelete={(tx) => {
            setDetailTarget(null)
            setDeleteTarget(tx)
          }}
        />
      )}

      {deleteTarget && (
        <DeleteTxConfirmModal
          transaction={deleteTarget}
          onConfirm={handleExecuteDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {showTransferModal && (
        <TransferModal
          wallets={wallets}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => {
            setActionSuccess('Transfer antardompet berhasil dicatat.')
            loadTransactions()
          }}
        />
      )}
    </div>
  )
}
