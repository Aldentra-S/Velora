import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { walletApi, transferApi } from '../services/api'
import type { Wallet, WalletType, ApiError, Transfer, Transaction } from '../services/types'
import { formatCurrency, walletTypeLabel, formatDate } from '../lib/utils'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconWallet,
  IconAlertCircle,
  IconTransfer,
  IconCheck,
  IconHistory,
  IconSearch,
  IconFilter,
} from './Icons'
import { TransferModal } from './TransferModal'

// ─── Wallet Form Modal ────────────────────────────────────────────────────────

interface WalletFormProps {
  initial?: Wallet
  onSave: () => void
  onClose: () => void
}

const WALLET_TYPES: WalletType[] = ['CASH', 'BANK', 'E_WALLET', 'INVESTMENT', 'OTHER']

function WalletForm({ initial, onSave, onClose }: WalletFormProps) {
  const editing = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<WalletType>(initial?.type ?? 'CASH')
  const [initialBalance, setInitialBalance] = useState<string>(editing ? '' : '0')
  const [currency, setCurrency] = useState(initial?.currency ?? 'IDR')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keyboard accessibility: Escape key closes modal (R-32)
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
    try {
      if (editing) {
        await walletApi.update(initial!.id, {
          name,
          type,
          description: description.trim() || undefined,
        })
      } else {
        const parsedInit = parseFloat(initialBalance) || 0
        if (parsedInit < 0) {
          setError('Saldo awal tidak boleh negatif.')
          setLoading(false)
          return
        }
        await walletApi.create({
          name,
          type,
          initialBalance: parsedInit,
          currency,
          description: description.trim() || undefined,
        })
      }
      onSave()
      onClose()
    } catch (err: unknown) {
      const e = err as ApiError
      setError(e.message || 'Gagal menyimpan dompet.')
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
        aria-labelledby="wallet-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title" id="wallet-modal-title">
            {editing ? 'Edit Dompet' : 'Tambah Dompet Baru'}
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Tutup dialog"
          >
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

            <div className="form-group">
              <label className="form-label" htmlFor="wallet-name">
                Nama Dompet
              </label>
              <input
                id="wallet-name"
                className="form-input"
                type="text"
                required
                placeholder="Contoh: Rekening BCA, Dompet Tunai"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="wallet-type">
                Tipe Dompet
              </label>
              <select
                id="wallet-type"
                className="form-select"
                value={type}
                onChange={(e) => setType(e.target.value as WalletType)}
              >
                {WALLET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {walletTypeLabel(t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="wallet-desc">
                Deskripsi / Catatan (Opsional)
              </label>
              <input
                id="wallet-desc"
                className="form-input"
                type="text"
                placeholder="Contoh: Rekening penerimaan gaji utama"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {!editing && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="wallet-balance">
                    Saldo Awal (Nominal)
                  </label>
                  <input
                    id="wallet-balance"
                    className="form-input"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="wallet-currency">
                    Mata Uang
                  </label>
                  <select
                    id="wallet-currency"
                    className="form-select"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="IDR">IDR (Rupiah)</option>
                    <option value="USD">USD (Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>
              </div>
            )}
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
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 12, height: 12 }} />
                  <span>Menyimpan...</span>
                </>
              ) : editing ? (
                'Simpan Perubahan'
              ) : (
                'Tambah Dompet'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirmation Modal (Zero window.confirm) ─────────────────────────

interface DeleteConfirmProps {
  wallet: Wallet
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function DeleteConfirmModal({ wallet, onConfirm, onCancel, loading }: DeleteConfirmProps) {
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
          <div className="modal-title">Hapus Dompet</div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Tutup">
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text)' }}>
            Apakah Anda yakin ingin menghapus dompet{' '}
            <strong style={{ color: 'var(--text-h)' }}>{wallet.name}</strong>?
          </p>
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: 'var(--expense)' }}>Perlindungan Integritas:</strong> Dompet yang memiliki riwayat transaksi, transfer antardompet, atau jadwal transaksi rutin aktif tidak dapat dihapus.
          </div>
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
            {loading ? 'Menghapus...' : 'Ya, Hapus Dompet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Cancel Transfer Confirmation Modal ──────────────────────────────────────

interface CancelTransferConfirmProps {
  transfer: Transfer
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function CancelTransferConfirmModal({
  transfer,
  onConfirm,
  onCancel,
  loading,
}: CancelTransferConfirmProps) {
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
          <div className="modal-title">Batalkan Transfer Antardompet</div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Tutup">
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
            Apakah Anda yakin ingin membatalkan transfer berikut?
          </p>
          <div
            style={{
              background: 'var(--surface-2)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <strong>Aliran:</strong> {transfer.fromWallet.name} → {transfer.toWallet.name}
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Nominal:</strong> {formatCurrency(transfer.amount)}
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Saldo dompet asal akan dikembalikan, dan saldo dompet tujuan akan dikurangi secara atomik.
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
            {loading ? 'Membatalkan...' : 'Ya, Batalkan Transfer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Per-Wallet History Modal (Transactions & Transfers) ─────────────────────

interface WalletHistoryModalProps {
  wallet: Wallet
  onClose: () => void
}

function WalletHistoryModal({ wallet, onClose }: WalletHistoryModalProps) {
  const [tab, setTab] = useState<'transactions' | 'transfers'>('transactions')
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true)
      try {
        const res = await walletApi.getHistory(wallet.id)
        setTransactions(res.transactions)
        setTransfers(res.transfers)
      } catch {
        setError('Gagal memuat riwayat mutasi dompet.')
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [wallet.id])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 650, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconHistory size={18} style={{ color: 'var(--accent)' }} />
              <span>Riwayat Mutasi: {wallet.name}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Saldo saat ini: <strong style={{ color: 'var(--text-h)' }}>{formatCurrency(wallet.balance, wallet.currency)}</strong> ({walletTypeLabel(wallet.type)})
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
            <IconClose size={16} />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0', borderBottom: '1px solid var(--border)' }}>
          <button
            type="button"
            className={`btn btn-sm ${tab === 'transactions' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: '6px 6px 0 0', fontSize: 12 }}
            onClick={() => setTab('transactions')}
          >
            Transaksi ({transactions.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${tab === 'transfers' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: '6px 6px 0 0', fontSize: 12 }}
            onClick={() => setTab('transfers')}
          >
            Transfer Antardompet ({transfers.length})
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
          {error && <div className="alert alert-error">{error}</div>}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              <span className="spinner" style={{ width: 18, height: 18, marginBottom: 8 }} />
              <div>Memuat riwayat transaksi...</div>
            </div>
          ) : tab === 'transactions' ? (
            transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Belum ada transaksi tercatat untuk dompet ini.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-h)' }}>
                        {tx.description || tx.category?.name || 'Transaksi'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {formatDate(tx.date)} • {tx.category?.name}
                      </div>
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        fontVariantNumeric: 'tabular-nums',
                        color: tx.type === 'INCOME' ? 'var(--income)' : 'var(--expense)',
                      }}
                    >
                      {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : transfers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Belum ada mutasi transfer yang melibatkan dompet ini.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {transfers.map((tr) => {
                const isOut = tr.fromWalletId === wallet.id
                return (
                  <div
                    key={tr.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-h)' }}>
                        {isOut ? `Transfer keluar ke ${tr.toWallet.name}` : `Transfer masuk dari ${tr.fromWallet.name}`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {formatDate(tr.date)} {tr.notes ? `• ${tr.notes}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          fontVariantNumeric: 'tabular-nums',
                          color: isOut ? 'var(--expense)' : 'var(--income)',
                        }}
                      >
                        {isOut ? '-' : '+'}{formatCurrency(tr.amount)}
                      </div>
                      {tr.status === 'CANCELLED' && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                          Dibatalkan
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Wallets Page ────────────────────────────────────────────────────────

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Wallet | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Wallet | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Wallet | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')

  // Transfer state
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [transfersLoading, setTransfersLoading] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [selectedTransferFrom, setSelectedTransferFrom] = useState<string | undefined>()
  const [cancelTarget, setCancelTarget] = useState<Transfer | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  const loadWallets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await walletApi.list()
      setWallets(res.wallets)
    } catch {
      setError('Gagal memuat daftar dompet.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTransfers = useCallback(async () => {
    setTransfersLoading(true)
    try {
      const res = await transferApi.list({ limit: 15 })
      setTransfers(res.transfers)
    } catch {
      // Keep previous list if any
    } finally {
      setTransfersLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWallets()
    loadTransfers()
  }, [loadWallets, loadTransfers])

  // Filtered wallets
  const filteredWallets = useMemo(() => {
    return wallets.filter((w) => {
      const matchSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (w.description && w.description.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchType = typeFilter === 'ALL' || w.type === typeFilter
      return matchSearch && matchType
    })
  }, [wallets, searchQuery, typeFilter])

  // Total balance grouped by currency to avoid illegal currency mixing
  const balanceByCurrency = useMemo(() => {
    const summary: Record<string, number> = {}
    wallets.forEach((w) => {
      const curr = w.currency || 'IDR'
      const bal = parseFloat(w.balance) || 0
      summary[curr] = (summary[curr] || 0) + bal
    })
    return summary
  }, [wallets])

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await walletApi.delete(deleteTarget.id)
      setWallets((prev) => prev.filter((w) => w.id !== deleteTarget.id))
      setDeleteTarget(null)
      setActionSuccess('Dompet berhasil dihapus.')
    } catch (err: unknown) {
      const e = err as ApiError
      setActionError(e.message || 'Gagal menghapus dompet.')
      setDeleteTarget(null)
    } finally {
      setDeleteLoading(false)
    }
  };

  const handleExecuteCancelTransfer = async () => {
    if (!cancelTarget) return
    setCancelLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await transferApi.cancel(cancelTarget.id)
      setActionSuccess('Transfer berhasil dibatalkan dan saldo telah dikembalikan.')
      setCancelTarget(null)
      await Promise.all([loadWallets(), loadTransfers()])
    } catch (err: unknown) {
      const e = err as ApiError
      setActionError(e.message || 'Gagal membatalkan transfer.')
      setCancelTarget(null)
    } finally {
      setCancelLoading(false)
    }
  }

  const handleTransferSuccess = () => {
    setActionSuccess('Transfer antardompet berhasil dicatat.')
    loadWallets()
    loadTransfers()
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h2>Dompet & Rekening Keuangan</h2>
          <p>Kelola rekening bank, e-wallet, dan pos kas penyimpanan Anda</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            id="open-transfer-btn"
            onClick={() => {
              setSelectedTransferFrom(undefined)
              setShowTransferModal(true)
            }}
            disabled={wallets.length < 2}
            title={wallets.length < 2 ? 'Minimal diperlukan 2 dompet untuk transfer' : 'Transfer Antardompet'}
          >
            <IconTransfer size={14} />
            <span>Transfer Saldo</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            id="add-wallet-btn"
            onClick={() => {
              setEditTarget(undefined)
              setShowForm(true)
            }}
          >
            <IconPlus size={14} />
            <span>Tambah Dompet</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="alert alert-success" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCheck size={16} style={{ color: 'var(--income)' }} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="alert alert-error" role="alert">
          <IconAlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* ── Total Balance Overview Banner ─────────────────────────────────── */}
      {wallets.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Total Likuiditas Seluruh Dompet
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
                {Object.entries(balanceByCurrency).map(([curr, total]) => (
                  <div key={curr}>
                    <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-h)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(total, curr)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ padding: '8px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jumlah Dompet</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-h)', marginTop: 2 }}>{wallets.length} Akun</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Search & Filter Controls ────────────────────────────────────────── */}
      {wallets.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <IconSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Cari nama dompet atau catatan..."
              style={{ paddingLeft: 30, fontSize: 13 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconFilter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              className="form-select"
              style={{ fontSize: 13, padding: '7px 12px' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">Semua Tipe Dompet</option>
              {WALLET_TYPES.map((t) => (
                <option key={t} value={t}>{walletTypeLabel(t)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Wallet Cards Grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="page-loading">
          <span className="spinner" style={{ width: 22, height: 22 }} />
          <span>Memuat daftar dompet...</span>
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : wallets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconWallet size={22} />
          </div>
          <div className="empty-state-title">Belum ada dompet dibuat</div>
          <div className="empty-state-sub">
            Buat dompet pertama Anda untuk mulai mencatat dan memisahkan saldo.
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
            <IconPlus size={14} /> Tambah Dompet
          </button>
        </div>
      ) : filteredWallets.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
          Tidak ada dompet yang sesuai dengan filter pencarian.
        </div>
      ) : (
        <div className="wallet-grid">
          {filteredWallets.map((w) => (
            <div key={w.id} className="wallet-card">
              <div className="wallet-card-header">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="wallet-card-name">{w.name}</div>
                  <div className="wallet-card-type">{walletTypeLabel(w.type)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 6px', height: 28, minHeight: 28 }}
                    onClick={() => {
                      setEditTarget(w)
                      setShowForm(true)
                    }}
                    title="Ubah Dompet"
                    aria-label={`Ubah dompet ${w.name}`}
                  >
                    <IconEdit size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 6px', height: 28, minHeight: 28, color: 'var(--expense)' }}
                    onClick={() => setDeleteTarget(w)}
                    title="Hapus Dompet"
                    aria-label={`Hapus dompet ${w.name}`}
                  >
                    <IconTrash size={14} />
                  </button>
                  <div className="wallet-card-icon" style={{ marginLeft: 2 }}>
                    <IconWallet size={16} />
                  </div>
                </div>
              </div>

              {w.description && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic', wordBreak: 'break-word', lineHeight: 1.4 }}>
                  {w.description}
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saldo Terkini</div>
                <div className="wallet-card-balance">
                  {formatCurrency(w.balance, w.currency)}
                </div>
              </div>

              <div className="wallet-card-footer">
                <div className="wallet-card-stat">
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {w._count?.transactions || 0} transaksi tercatat
                  </span>
                  <span className="badge badge-default" style={{ fontSize: 10, padding: '2px 7px' }}>
                    {w.currency || 'IDR'}
                  </span>
                </div>
                <div className="wallet-card-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setHistoryTarget(w)}
                    title="Lihat riwayat transaksi dompet ini"
                  >
                    <IconHistory size={13} />
                    <span>Riwayat</span>
                  </button>
                  {wallets.length >= 2 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => {
                        setSelectedTransferFrom(w.id)
                        setShowTransferModal(true)
                      }}
                      title="Transfer dari dompet ini"
                    >
                      <IconTransfer size={13} />
                      <span>Transfer</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Riwayat Transfer Antardompet Card ──────────────────────────────── */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconTransfer size={16} style={{ color: 'var(--accent)' }} />
            <h3>Riwayat Transfer Antardompet</h3>
          </div>
          {transfers.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {transfers.length} transfer tercatat
            </span>
          )}
        </div>

        {transfersLoading && transfers.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Memuat riwayat transfer...
          </div>
        ) : transfers.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Belum ada mutasi transfer antardompet</div>
            <div style={{ fontSize: 12 }}>
              Pindahkan saldo antarrekening atau e-wallet tanpa memengaruhi laporan pemasukan dan pengeluaran.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aliran Transfer</th>
                  <th>Catatan</th>
                  <th style={{ textAlign: 'right' }}>Nominal</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => {
                  const isCancelled = t.status === 'CANCELLED'
                  return (
                    <tr key={t.id} style={{ opacity: isCancelled ? 0.65 : 1 }}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatDate(t.date)}
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
                          <span style={{ color: 'var(--text-h)' }}>{t.fromWallet.name}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>
                          <span style={{ color: 'var(--text-h)' }}>{t.toWallet.name}</span>
                        </div>
                      </td>
                      <td
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: 12,
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.notes || '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color: isCancelled ? 'var(--text-muted)' : 'var(--text-h)',
                          textDecoration: isCancelled ? 'line-through' : 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatCurrency(t.amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: isCancelled ? 'rgba(239, 68, 68, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                            color: isCancelled ? 'var(--expense)' : 'var(--accent)',
                            border: `1px solid ${isCancelled ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)'}`,
                          }}
                        >
                          {isCancelled ? 'Dibatalkan' : 'Berhasil'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {!isCancelled ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--expense)', fontSize: 12, padding: '3px 8px' }}
                            onClick={() => setCancelTarget(t)}
                            title="Batalkan transfer ini"
                          >
                            Batalkan
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <WalletForm
          initial={editTarget}
          onSave={loadWallets}
          onClose={() => setShowForm(false)}
        />
      )}

      {showTransferModal && (
        <TransferModal
          wallets={wallets}
          defaultFromWalletId={selectedTransferFrom}
          onClose={() => setShowTransferModal(false)}
          onSuccess={handleTransferSuccess}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          wallet={deleteTarget}
          onConfirm={handleExecuteDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {cancelTarget && (
        <CancelTransferConfirmModal
          transfer={cancelTarget}
          onConfirm={handleExecuteCancelTransfer}
          onCancel={() => setCancelTarget(null)}
          loading={cancelLoading}
        />
      )}

      {historyTarget && (
        <WalletHistoryModal
          wallet={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  )
}
