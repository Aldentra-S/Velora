import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { budgetApi, categoryApi, goalApi } from '../services/api'
import type {
  Budget,
  BudgetSummary,
  Category,
  ApiError,
  UserProfile,
  FinancialGoal,
} from '../services/types'
import {
  formatCurrency,
  formatMonthLabel,
  categoryColor,
  getCurrentPeriod,
  shiftPeriod,
  clamp,
} from '../lib/utils'
import {
  IconBudget,
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconChevronLeft,
  IconChevronRight,
  IconAlertCircle,
  IconRefresh,
  IconTarget,
  IconCalendar,
  IconCheck,
} from './Icons'

// ─── Status Badge Component ───────────────────────────────────────────────────

function BudgetStatusBadge({ status, percentage }: { status: Budget['status']; percentage: number }) {
  if (status === 'EXCEEDED') {
    return <span className="badge badge-status-exceeded">Terlampaui ({percentage}%)</span>
  }
  if (status === 'WARNING') {
    return <span className="badge badge-status-warning">Waspada ({percentage}%)</span>
  }
  return <span className="badge badge-status-normal">Aman ({percentage}%)</span>
}

// ─── Create Budget Modal ──────────────────────────────────────────────────────

interface CreateModalProps {
  period: string
  categories: Category[]
  existingCategoryIds: Set<string>
  onClose: () => void
  onSuccess: () => void
}

function CreateBudgetModal({
  period,
  categories,
  existingCategoryIds,
  onClose,
  onSuccess,
}: CreateModalProps) {
  const availableCategories = useMemo(
    () => categories.filter((c) => c.type === 'EXPENSE' && !existingCategoryIds.has(c.id)),
    [categories, existingCategoryIds]
  )

  const [categoryId, setCategoryId] = useState(availableCategories[0]?.id || '')
  const [amountStr, setAmountStr] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const parsedAmount = parseFloat(amountStr) || 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoryId) {
      setError('Pilih kategori pengeluaran terlebih dahulu.')
      return
    }
    if (parsedAmount <= 0) {
      setError('Nominal batas anggaran harus lebih besar dari Rp 0.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await budgetApi.create({
        categoryId,
        period,
        amount: parsedAmount,
      })
      onSuccess()
    } catch (err: unknown) {
      const e = err as ApiError
      setError(e.message || 'Gagal membuat anggaran baru.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="create-budget-title">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title" id="create-budget-title">
            Buat Anggaran Baru ({formatMonthLabel(period)})
          </span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup modal">
            <IconClose size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error" role="alert">
                <IconAlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {availableCategories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)' }}>
                Semua kategori pengeluaran Anda sudah memiliki anggaran untuk periode {formatMonthLabel(period)}.
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="budget-category-select">
                    Kategori Pengeluaran
                  </label>
                  <select
                    id="budget-category-select"
                    className="form-select"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                  >
                    {availableCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" htmlFor="budget-amount-input">
                      Batas Anggaran Bulanan
                    </label>
                    {parsedAmount > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                        {formatCurrency(parsedAmount)}
                      </span>
                    )}
                  </div>
                  <input
                    id="budget-amount-input"
                    className="form-input"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Contoh: 1500000"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    required
                    autoFocus
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Batas pengeluaran yang diizinkan untuk periode {formatMonthLabel(period)}.
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Batal
            </button>
            {availableCategories.length > 0 && (
              <button type="submit" className="btn btn-primary" disabled={loading || parsedAmount <= 0}>
                {loading ? 'Menyimpan...' : 'Simpan Anggaran'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Budget Modal ────────────────────────────────────────────────────────

interface EditModalProps {
  budget: Budget
  onClose: () => void
  onSuccess: () => void
}

function EditBudgetModal({ budget, onClose, onSuccess }: EditModalProps) {
  const [amountStr, setAmountStr] = useState(() => {
    const num = parseFloat(budget.amount)
    return isNaN(num) ? '' : String(Math.round(num))
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const parsedAmount = parseFloat(amountStr) || 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (parsedAmount <= 0) {
      setError('Nominal batas anggaran harus lebih besar dari Rp 0.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await budgetApi.update(budget.id, { amount: parsedAmount })
      onSuccess()
    } catch (err: unknown) {
      const e = err as ApiError
      setError(e.message || 'Gagal memperbarui batas anggaran.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="edit-budget-title">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title" id="edit-budget-title">
            Ubah Batas Anggaran — {budget.category.name}
          </span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup modal">
            <IconClose size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error" role="alert">
                <IconAlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Realisasi Pengeluaran Terkini</div>
              <div style={{ fontWeight: 600, color: 'var(--text-h)', marginTop: 2 }}>
                {formatCurrency(budget.spent)}
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="edit-budget-amount">
                  Batas Anggaran Baru
                </label>
                {parsedAmount > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                    {formatCurrency(parsedAmount)}
                  </span>
                )}
              </div>
              <input
                id="edit-budget-amount"
                className="form-input"
                type="number"
                min="1"
                step="1"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || parsedAmount <= 0}>
              {loading ? 'Memperbarui...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Budget Confirmation Modal ─────────────────────────────────────────

interface DeleteModalProps {
  budget: Budget
  onClose: () => void
  onSuccess: () => void
}

function DeleteBudgetConfirmModal({ budget, onClose, onSuccess }: DeleteModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    try {
      await budgetApi.delete(budget.id)
      onSuccess()
    } catch (err: unknown) {
      const e = err as ApiError
      setError(e.message || 'Gagal menghapus anggaran.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="delete-budget-title">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title" id="delete-budget-title" style={{ color: 'var(--expense)' }}>
            Hapus Anggaran
          </span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup modal">
            <IconClose size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-error" role="alert">
              <IconAlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <p style={{ color: 'var(--text)', fontSize: 14 }}>
            Apakah Anda yakin ingin menghapus target anggaran untuk kategori{' '}
            <strong>{budget.category.name}</strong> pada periode {formatMonthLabel(budget.period)}?
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
            Transaksi pengeluaran dan saldo dompet Anda tidak akan terhapus.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Batal
          </button>
          <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={loading}>
            {loading ? 'Menghapus...' : 'Ya, Hapus Anggaran'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Financial Goal Modals ────────────────────────────────────────────────────

interface CreateGoalModalProps {
  onClose: () => void
  onSave: (goal: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>) => void
}

function CreateGoalModal({ onClose, onSave }: CreateGoalModalProps) {
  const [name, setName] = useState('')
  const [targetAmountStr, setTargetAmountStr] = useState('')
  const [currentAmountStr, setCurrentAmountStr] = useState('0')
  const [deadline, setDeadline] = useState('')
  const [category, setCategory] = useState('Tabungan')
  const [color, setColor] = useState('#10b981')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const targetAmount = parseFloat(targetAmountStr) || 0
  const currentAmount = parseFloat(currentAmountStr) || 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Nama target keuangan wajib diisi.')
      return
    }
    if (targetAmount <= 0) {
      setError('Nominal target tabungan harus lebih besar dari Rp 0.')
      return
    }
    if (currentAmount < 0) {
      setError('Nominal terkumpul saat ini tidak boleh negatif.')
      return
    }

    onSave({
      name: name.trim(),
      targetAmount,
      currentAmount,
      deadline: deadline || null,
      category,
      color,
      notes: notes.trim() || null,
    })
    onClose()
  }

  const PALETTE = ['#10b981', '#6366f1', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6']

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="goal-create-title">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" id="goal-create-title">
            Buat Target Keuangan Baru
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
            <IconClose size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div className="alert alert-error" role="alert">
                <IconAlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="goal-name">
                Nama Target / Impian
              </label>
              <input
                id="goal-name"
                className="form-input"
                type="text"
                required
                placeholder="Contoh: Dana Darurat, Liburan Jepang, Beli Rumah"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="goal-target-amount">
                  Nominal Target (Rp)
                </label>
                <input
                  id="goal-target-amount"
                  className="form-input"
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="Contoh: 10000000"
                  value={targetAmountStr}
                  onChange={(e) => setTargetAmountStr(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="goal-current-amount">
                  Terkumpul Saat Ini (Rp)
                </label>
                <input
                  id="goal-current-amount"
                  className="form-input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={currentAmountStr}
                  onChange={(e) => setCurrentAmountStr(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="goal-category">
                  Kategori Impian
                </label>
                <select
                  id="goal-category"
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Tabungan">Tabungan Mandiri</option>
                  <option value="Dana Darurat">Dana Darurat</option>
                  <option value="Investasi">Investasi / Masa Depan</option>
                  <option value="Liburan">Liburan & Hiburan</option>
                  <option value="Properti">Rumah & Properti</option>
                  <option value="Kendaraan">Kendaraan</option>
                  <option value="Pendidikan">Pendidikan</option>
                  <option value="Lainnya">Lain-lain</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="goal-deadline">
                  Tenggat Waktu (Opsional)
                </label>
                <input
                  id="goal-deadline"
                  className="form-input"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>

            {/* Color Palette */}
            <div className="form-group">
              <label className="form-label">Warna Aksen</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      backgroundColor: c,
                      border: color === c ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: color === c ? '0 0 0 2px var(--accent)' : 'none',
                      cursor: 'pointer',
                    }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="goal-notes">
                Catatan Rencana
              </label>
              <input
                id="goal-notes"
                className="form-input"
                type="text"
                placeholder="Rencana menabung Rp500.000 per bulan"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Buat Target
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface DepositGoalModalProps {
  goal: FinancialGoal
  onClose: () => void
  onSave: (goalId: string, addedAmount: number) => void
}

function DepositGoalModal({ goal, onClose, onSave }: DepositGoalModalProps) {
  const [addAmountStr, setAddAmountStr] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const addAmount = parseFloat(addAmountStr) || 0
  const newTotal = goal.currentAmount + addAmount
  const newPercent = Math.min(Math.round((newTotal / goal.targetAmount) * 100), 100)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (addAmount <= 0) {
      setError('Nominal setor tabungan harus lebih besar dari Rp 0.')
      return
    }
    onSave(goal.id, addAmount)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="goal-deposit-title">
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" id="goal-deposit-title">
            Setor Tabungan — {goal.name}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
            <IconClose size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div className="alert alert-error" role="alert">
                <IconAlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>Posisi Tabungan Saat Ini</span>
                <span>Target: {formatCurrency(goal.targetAmount)}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-h)', marginTop: 4 }}>
                {formatCurrency(goal.currentAmount)}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="deposit-amount">
                Tambah Nominal Tabungan (Rp)
              </label>
              <input
                id="deposit-amount"
                className="form-input"
                type="number"
                min="1"
                step="1"
                required
                autoFocus
                placeholder="Contoh: 500000"
                value={addAmountStr}
                onChange={(e) => setAddAmountStr(e.target.value)}
              />
            </div>

            {addAmount > 0 && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  fontSize: 12.5,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Saldo Baru Setelah Setor:</span>
                <span style={{ fontWeight: 600, color: 'var(--income)' }}>
                  {formatCurrency(newTotal)} ({newPercent}%)
                </span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={addAmount <= 0}>
              Simpan Setoran
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface DeleteGoalModalProps {
  goal: FinancialGoal
  onClose: () => void
  onConfirm: () => void
}

function DeleteGoalConfirmModal({ goal, onClose, onConfirm }: DeleteGoalModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ color: 'var(--expense)' }}>
            Hapus Target Keuangan
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text)', fontSize: 13.5 }}>
            Apakah Anda yakin ingin menghapus target <strong>{goal.name}</strong> dengan capaian saat ini{' '}
            <strong>{formatCurrency(goal.currentAmount)}</strong>?
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
            Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            Ya, Hapus Target
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Budgets & Goals Page Component ──────────────────────────────────────

interface BudgetsPageProps {
  user?: UserProfile | null
}

export default function BudgetsPage({ user }: BudgetsPageProps) {
  // Navigation between Budgets vs Financial Goals
  const [activeTab, setActiveTab] = useState<'BUDGETS' | 'GOALS'>('BUDGETS')

  // ── Budgets State ──────────────────────────────────────────────────────────
  const [period, setPeriod] = useState<string>(getCurrentPeriod())
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [summary, setSummary] = useState<BudgetSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null)

  // ── Goals State (PostgreSQL Persistent via goalApi) ───────────────────────
  const [goals, setGoals] = useState<FinancialGoal[]>([])
  const [goalsLoading, setGoalsLoading] = useState(false)

  const loadGoalsData = useCallback(async () => {
    setGoalsLoading(true)
    try {
      // 1. One-time safe migration from localStorage if existing
      const localKey = `velora_goals_${user?.id || 'default'}`
      const localSaved = localStorage.getItem(localKey)
      if (localSaved) {
        try {
          const parsed = JSON.parse(localSaved)
          if (Array.isArray(parsed) && parsed.length > 0) {
            await goalApi.batchImport(parsed)
            localStorage.removeItem(localKey) // Cleanly migrated!
          }
        } catch {
          // ignore parsing error
        }
      }

      // 2. Fetch fresh data from PostgreSQL
      const res = await goalApi.list()
      const normalized = res.goals.map((g) => ({
        ...g,
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount),
      }))
      setGoals(normalized)
    } catch {
      // ignore
    } finally {
      setGoalsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadGoalsData()
  }, [loadGoalsData])

  const [createGoalOpen, setCreateGoalOpen] = useState(false)
  const [depositGoalTarget, setDepositGoalTarget] = useState<FinancialGoal | null>(null)
  const [deleteGoalTarget, setDeleteGoalTarget] = useState<FinancialGoal | null>(null)
  const [goalFeedback, setGoalFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (goalFeedback) {
      const timer = setTimeout(() => setGoalFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [goalFeedback])

  // Load auxiliary categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await categoryApi.list()
        setCategories(res.categories)
      } catch {
        // ignore
      }
    }
    loadCategories()
  }, [])

  // Load budgets for active period
  const loadBudgetsData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await budgetApi.list(period)
      setBudgets(res.budgets)
      setSummary(res.summary)
    } catch {
      setError('Gagal memuat data anggaran. Pastikan backend aktif.')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadBudgetsData()
  }, [loadBudgetsData])

  const existingCategoryIds = useMemo(
    () => new Set(budgets.map((b) => b.categoryId)),
    [budgets]
  )

  const isCurrentMonth = period === getCurrentPeriod()

  // ── Goals Calculations ─────────────────────────────────────────────────────
  const goalsSummary = useMemo(() => {
    let totalTarget = 0
    let totalSaved = 0
    let completedCount = 0

    goals.forEach((g) => {
      totalTarget += g.targetAmount
      totalSaved += g.currentAmount
      if (g.currentAmount >= g.targetAmount) completedCount++
    })

    const overallPct = totalTarget > 0 ? Math.min(Math.round((totalSaved / totalTarget) * 100), 100) : 0
    return {
      totalTarget,
      totalSaved,
      overallPct,
      totalGoals: goals.length,
      completedCount,
      activeCount: goals.length - completedCount,
    }
  }, [goals])

  const handleCreateGoal = async (goalData: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await goalApi.create(goalData)
      await loadGoalsData()
      setGoalFeedback(`Target "${goalData.name}" berhasil disimpan ke database!`)
    } catch (err: unknown) {
      const e = err as ApiError
      setGoalFeedback(e.message || 'Gagal menyimpan target keuangan.')
    }
  }

  const handleDepositGoal = async (goalId: string, added: number) => {
    try {
      await goalApi.deposit(goalId, added)
      await loadGoalsData()
      setGoalFeedback(`Berhasil menyetor ${formatCurrency(added)} ke target tabungan!`)
    } catch (err: unknown) {
      const e = err as ApiError
      setGoalFeedback(e.message || 'Gagal menyetor ke target tabungan.')
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await goalApi.delete(goalId)
      await loadGoalsData()
      setGoalFeedback('Target keuangan berhasil dihapus dari database.')
    } catch (err: unknown) {
      const e = err as ApiError
      setGoalFeedback(e.message || 'Gagal menghapus target keuangan.')
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Top Header Bar with Tab Toggle ─────────────────────────────────── */}
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
            {activeTab === 'BUDGETS' ? 'Anggaran Bulanan' : 'Target Keuangan (Financial Goals)'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {activeTab === 'BUDGETS'
              ? 'Kontrol batas pengeluaran per kategori untuk menjaga stabilitas finansial'
              : 'Rencanakan tabungan masa depan, dana darurat, dan impian finansial Anda'}
          </p>
        </div>

        {/* Global Module Switcher Tabs */}
        <div className="segmented-control" role="tablist" aria-label="Pilih Modul Anggaran atau Target">
          <button
            type="button"
            className={`segmented-btn${activeTab === 'BUDGETS' ? ' active' : ''}`}
            onClick={() => setActiveTab('BUDGETS')}
            role="tab"
            aria-selected={activeTab === 'BUDGETS'}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconBudget size={14} /> Anggaran Kategori
            </span>
          </button>
          <button
            type="button"
            className={`segmented-btn${activeTab === 'GOALS' ? ' active' : ''}`}
            onClick={() => setActiveTab('GOALS')}
            role="tab"
            aria-selected={activeTab === 'GOALS'}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconTarget size={14} /> Target Finansial ({goals.length})
            </span>
          </button>
        </div>
      </div>

      {goalFeedback && (
        <div className="alert alert-success" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCheck size={16} style={{ color: 'var(--income)' }} />
          <span>{goalFeedback}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 1: ANGGARAN KATEGORI (MONTHLY BUDGETS)
          ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'BUDGETS' && (
        <>
          {/* Sub Navigation Bar for Period */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isCurrentMonth && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPeriod(getCurrentPeriod())}
                >
                  Bulan Ini
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setCreateModalOpen(true)}
                id="create-budget-btn"
              >
                <IconPlus size={15} />
                <span>Tambah Anggaran</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconAlertCircle size={16} />
                <span>{error}</span>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={loadBudgetsData}>
                <IconRefresh size={14} /> Coba Lagi
              </button>
            </div>
          )}

          {loading ? (
            <div className="page-loading">
              <span className="spinner" style={{ width: 22, height: 22 }} />
              <span>Memuat data anggaran {formatMonthLabel(period)}...</span>
            </div>
          ) : (
            <>
              {/* Summary Banner */}
              {summary && budgets.length > 0 && (
                <section className="budget-hero-banner" aria-label="Ringkasan Total Anggaran">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                        Total Anggaran Dialokasikan ({summary.budgetCount} Kategori)
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-h)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(summary.totalLimit)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Total Pengeluaran</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--expense)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                          {formatCurrency(summary.totalSpent)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Sisa Anggaran</div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: parseFloat(summary.totalRemaining) < 0 ? 'var(--expense)' : 'var(--income)',
                            fontVariantNumeric: 'tabular-nums',
                            marginTop: 2,
                          }}
                        >
                          {formatCurrency(summary.totalRemaining)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      <span>Tingkat Pemakaian Keseluruhan</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>
                        {summary.percentage}%
                      </span>
                    </div>
                    <div className="budget-progress-track">
                      <div
                        className={`budget-progress-bar ${
                          summary.percentage > 100 ? 'exceeded' : summary.percentage >= 80 ? 'warning' : 'normal'
                        }`}
                        style={{ width: `${clamp(summary.percentage, 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* Empty State */}
              {budgets.length === 0 ? (
                <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <div className="empty-state">
                    <div className="empty-state-icon" style={{ width: 48, height: 48 }}>
                      <IconBudget size={24} />
                    </div>
                    <div className="empty-state-title" style={{ fontSize: 16 }}>
                      Belum Ada Anggaran untuk {formatMonthLabel(period)}
                    </div>
                    <div className="empty-state-sub" style={{ maxWidth: 360 }}>
                      Tetapkan batas pengeluaran untuk kategori favorit Anda agar keuangan tetap terkendali dan tidak boros.
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ marginTop: 12 }}
                      onClick={() => setCreateModalOpen(true)}
                    >
                      <IconPlus size={16} /> Buat Anggaran Pertama
                    </button>
                  </div>
                </div>
              ) : (
                /* Budgets Grid */
                <div className="budget-grid">
                  {budgets.map((b) => {
                    const isExceeded = b.status === 'EXCEEDED'
                    const catColor = categoryColor(b.category.color)
                    const spentNum = parseFloat(b.spent)
                    const limitNum = parseFloat(b.amount)
                    const remainingNum = parseFloat(b.remaining)

                    return (
                      <div key={b.id} className={`budget-card${isExceeded ? ' status-exceeded' : ''}`}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  backgroundColor: catColor,
                                  display: 'inline-block',
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-h)' }}>
                                {b.category.name}
                              </span>
                            </div>
                            <BudgetStatusBadge status={b.status} percentage={b.percentage} />
                          </div>

                          <div className="budget-progress-track" style={{ marginTop: 12, marginBottom: 8 }}>
                            <div
                              className={`budget-progress-bar ${
                                b.status === 'EXCEEDED' ? 'exceeded' : b.status === 'WARNING' ? 'warning' : 'normal'
                              }`}
                              style={{ width: `${clamp(b.percentage, 0, 100)}%` }}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Terpakai</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-h)', fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(spentNum)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Batas Anggaran</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-h)', fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(limitNum)}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: 12,
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: isExceeded ? 'var(--expense-subtle)' : 'var(--bg-subtle)',
                              border: `1px solid ${isExceeded ? 'var(--expense-border)' : 'var(--border-subtle)'}`,
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span style={{ color: isExceeded ? 'var(--expense)' : 'var(--text-muted)' }}>
                              {isExceeded ? 'Kelebihan Pengeluaran' : 'Sisa Alokasi'}
                            </span>
                            <span
                              style={{
                                fontWeight: 600,
                                color: isExceeded ? 'var(--expense)' : 'var(--income)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {formatCurrency(Math.abs(remainingNum))}
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 8,
                            paddingTop: 12,
                            borderTop: '1px solid var(--border-subtle)',
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEditingBudget(b)}
                            title="Ubah batas anggaran"
                          >
                            <IconEdit size={14} />
                            <span>Ubah Batas</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--expense)' }}
                            onClick={() => setDeletingBudget(b)}
                            title="Hapus anggaran"
                          >
                            <IconTrash size={14} />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Budget Modals */}
          {createModalOpen && (
            <CreateBudgetModal
              period={period}
              categories={categories}
              existingCategoryIds={existingCategoryIds}
              onClose={() => setCreateModalOpen(false)}
              onSuccess={() => {
                setCreateModalOpen(false)
                loadBudgetsData()
              }}
            />
          )}

          {editingBudget && (
            <EditBudgetModal
              budget={editingBudget}
              onClose={() => setEditingBudget(null)}
              onSuccess={() => {
                setEditingBudget(null)
                loadBudgetsData()
              }}
            />
          )}

          {deletingBudget && (
            <DeleteBudgetConfirmModal
              budget={deletingBudget}
              onClose={() => setDeletingBudget(null)}
              onSuccess={() => {
                setDeletingBudget(null)
                loadBudgetsData()
              }}
            />
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 2: TARGET KEUANGAN (FINANCIAL GOALS)
          ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'GOALS' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCreateGoalOpen(true)}
              id="add-goal-btn"
            >
              <IconPlus size={15} />
              <span>Buat Target Baru</span>
            </button>
          </div>

          {/* Goals Hero Summary */}
          {goals.length > 0 && (
            <section className="budget-hero-banner" aria-label="Ringkasan Target Finansial">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    Total Tabungan Terkumpul ({goalsSummary.completedCount}/{goalsSummary.totalGoals} Target Selesai)
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-h)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(goalsSummary.totalSaved)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Dari total target kebutuhan {formatCurrency(goalsSummary.totalTarget)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Sisa Dana Dibutuhkan</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                      {formatCurrency(Math.max(goalsSummary.totalTarget - goalsSummary.totalSaved, 0))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Target Aktif</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--income)', marginTop: 2 }}>
                      {goalsSummary.activeCount} Berjalan
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>Progres Kumulatif Target Finansial</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>
                    {goalsSummary.overallPct}%
                  </span>
                </div>
                <div className="budget-progress-track">
                  <div
                    className="budget-progress-bar normal"
                    style={{
                      width: `${clamp(goalsSummary.overallPct, 0, 100)}%`,
                      backgroundColor: goalsSummary.overallPct >= 100 ? 'var(--income)' : 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Goals Loading or Empty State */}
          {goalsLoading ? (
            <div className="page-loading" style={{ padding: '60px 20px' }}>
              <span className="spinner" style={{ width: 22, height: 22 }} />
              <span>Memuat target finansial dari database...</span>
            </div>
          ) : goals.length === 0 ? (
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div className="empty-state">
                <div className="empty-state-icon" style={{ width: 48, height: 48 }}>
                  <IconTarget size={24} />
                </div>
                <div className="empty-state-title" style={{ fontSize: 16 }}>
                  Belum Ada Target Finansial
                </div>
                <div className="empty-state-sub" style={{ maxWidth: 400 }}>
                  Wujudkan impian Anda dengan target tabungan terarah. Tetapkan nominal tujuan, pantau progres setoran, dan rayakan pencapaian Anda.
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={() => setCreateGoalOpen(true)}
                >
                  <IconPlus size={16} /> Buat Target Keuangan Pertama
                </button>
              </div>
            </div>
          ) : (
            /* Goals Grid */
            <div className="budget-grid">
              {goals.map((g) => {
                const isCompleted = g.currentAmount >= g.targetAmount
                const percentage = g.targetAmount > 0 ? Math.min(Math.round((g.currentAmount / g.targetAmount) * 100), 100) : 0
                const remaining = Math.max(g.targetAmount - g.currentAmount, 0)
                const accent = g.color || '#10b981'

                // Deadline calculation
                let deadlineBadge: { label: string; overdue: boolean } | null = null
                if (g.deadline) {
                  const targetDate = new Date(g.deadline)
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

                  if (diffDays < 0) {
                    deadlineBadge = { label: `Tenggat terlewat (${Math.abs(diffDays)}h lalu)`, overdue: true }
                  } else if (diffDays === 0) {
                    deadlineBadge = { label: 'Tenggat hari ini', overdue: false }
                  } else {
                    deadlineBadge = { label: `Sisa ${diffDays} hari lagi`, overdue: false }
                  }
                }

                return (
                  <div
                    key={g.id}
                    className="budget-card"
                    style={{
                      borderColor: isCompleted ? 'rgba(16, 185, 129, 0.4)' : undefined,
                    }}
                  >
                    <div>
                      {/* Top Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              backgroundColor: accent,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {g.category || 'Tabungan'}
                          </span>
                        </div>
                        {isCompleted ? (
                          <span className="badge badge-status-normal" style={{ fontSize: 11 }}>
                            Tercapai 🎉
                          </span>
                        ) : (
                          <span className="badge" style={{ backgroundColor: `${accent}18`, color: accent, fontSize: 11 }}>
                            {percentage}%
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-h)', marginBottom: 8 }}>
                        {g.name}
                      </h3>

                      {/* Progress Track */}
                      <div className="budget-progress-track" style={{ marginTop: 8, marginBottom: 8 }}>
                        <div
                          className="budget-progress-bar"
                          style={{
                            width: `${clamp(percentage, 0, 100)}%`,
                            backgroundColor: isCompleted ? 'var(--income)' : accent,
                          }}
                        />
                      </div>

                      {/* Amounts Display */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Terkumpul</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-h)', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(g.currentAmount)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target Kebutuhan</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(g.targetAmount)}
                          </div>
                        </div>
                      </div>

                      {/* Remaining / Completed Tag */}
                      <div
                        style={{
                          marginTop: 10,
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-subtle)',
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ color: isCompleted ? 'var(--income)' : 'var(--text-muted)' }}>
                          {isCompleted ? 'Target Finansial Terpenuhi!' : 'Sisa yang Dibutuhkan:'}
                        </span>
                        <span style={{ fontWeight: 600, color: isCompleted ? 'var(--income)' : 'var(--text-h)' }}>
                          {isCompleted ? '100% Selesai' : formatCurrency(remaining)}
                        </span>
                      </div>

                      {/* Deadline info */}
                      {deadlineBadge && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            marginTop: 8,
                            fontSize: 11.5,
                            color: deadlineBadge.overdue ? 'var(--expense)' : 'var(--text-muted)',
                          }}
                        >
                          <IconCalendar size={13} />
                          <span>{deadlineBadge.label} ({g.deadline})</span>
                        </div>
                      )}

                      {g.notes && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                          "{g.notes}"
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 12,
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 12 }}
                        onClick={() => setDepositGoalTarget(g)}
                        title="Setor / Tambah tabungan"
                      >
                        <IconPlus size={13} />
                        <span>Setor</span>
                      </button>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--expense)', padding: '4px 8px' }}
                          onClick={() => setDeleteGoalTarget(g)}
                          title="Hapus target"
                          aria-label="Hapus target"
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

          {/* Goal Modals */}
          {createGoalOpen && (
            <CreateGoalModal
              onClose={() => setCreateGoalOpen(false)}
              onSave={handleCreateGoal}
            />
          )}

          {depositGoalTarget && (
            <DepositGoalModal
              goal={depositGoalTarget}
              onClose={() => setDepositGoalTarget(null)}
              onSave={handleDepositGoal}
            />
          )}

          {deleteGoalTarget && (
            <DeleteGoalConfirmModal
              goal={deleteGoalTarget}
              onClose={() => setDeleteGoalTarget(null)}
              onConfirm={() => handleDeleteGoal(deleteGoalTarget.id)}
            />
          )}
        </>
      )}
    </div>
  )
}
