import React, { useState, useEffect, useCallback } from 'react'
import { categoryApi } from '../services/api'
import type { Category, TransactionType, ApiError } from '../services/types'
import { categoryColor } from '../lib/utils'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconCategory,
  IconAlertCircle,
  IconIncome,
  IconExpense,
} from './Icons'

const PRESET_COLORS = [
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#f59e0b', '#84cc16', '#14b8a6', '#64748b',
]

// ─── Category Form Modal ──────────────────────────────────────────────────────

interface CategoryFormProps {
  initial?: Category
  defaultType?: TransactionType
  onSave: () => void
  onClose: () => void
}

function CategoryForm({ initial, defaultType = 'EXPENSE', onSave, onClose }: CategoryFormProps) {
  const editing = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<TransactionType>(initial?.type ?? defaultType)
  const [color, setColor] = useState<string>(initial?.color ?? '#10b981')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        await categoryApi.update(initial!.id, { name, color })
      } else {
        await categoryApi.create({ name, type, color })
      }
      onSave()
      onClose()
    } catch (err: unknown) {
      const e = err as ApiError
      setError(e.message || 'Gagal menyimpan kategori.')
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
        aria-labelledby="cat-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title" id="cat-modal-title">
            {editing ? 'Edit Kategori' : 'Tambah Kategori Baru'}
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

            <div className="form-group">
              <label className="form-label" htmlFor="cat-name">
                Nama Kategori
              </label>
              <input
                id="cat-name"
                className="form-input"
                type="text"
                required
                placeholder="Contoh: Makanan & Minuman, Transportasi"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {!editing && (
              <div className="form-group">
                <label className="form-label">Jenis Transaksi</label>
                <div className="segmented-control" style={{ width: '100%' }}>
                  <button
                    type="button"
                    className={`segmented-btn${type === 'EXPENSE' ? ' active' : ''}`}
                    style={{ flex: 1 }}
                    onClick={() => setType('EXPENSE')}
                  >
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn${type === 'INCOME' ? ' active' : ''}`}
                    style={{ flex: 1 }}
                    onClick={() => setType('INCOME')}
                  >
                    Pemasukan
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Warna Label</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 'var(--radius-xs)',
                      backgroundColor: c,
                      border: color === c ? '2px solid #ffffff' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'transform 0.1s ease',
                      transform: color === c ? 'scale(1.15)' : 'none',
                    }}
                    aria-label={`Pilih warna ${c}`}
                  />
                ))}
              </div>
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
              disabled={loading}
            >
              {loading ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Kategori'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirmation Modal (Zero window.confirm) ─────────────────────────

interface DeleteConfirmProps {
  category: Category
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function DeleteCategoryConfirmModal({ category, onConfirm, onCancel, loading }: DeleteConfirmProps) {
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
          <div className="modal-title">Hapus Kategori</div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Tutup">
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text)' }}>
            Hapus kategori <strong style={{ color: 'var(--text-h)' }}>{category.name}</strong>?
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Kategori yang sudah terhubung dengan transaksi tidak dapat dihapus demi konsistensi laporan.
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

// ─── Categories Page ──────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await categoryApi.list()
      setCategories(res.categories)
    } catch {
      setError('Gagal memuat kategori.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setActionError(null)
    try {
      await categoryApi.delete(deleteTarget.id)
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err: unknown) {
      const e = err as ApiError
      setActionError(e.message || 'Gagal menghapus kategori.')
      setDeleteTarget(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  const filteredCategories = categories.filter((c) => c.type === activeTab)

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Kategori Keuangan</h2>
          <p>Klasifikasikan pos pemasukan dan pengeluaran secara terstruktur</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          id="add-category-btn"
          onClick={() => {
            setEditTarget(undefined)
            setShowForm(true)
          }}
        >
          <IconPlus size={14} />
          <span>Tambah Kategori</span>
        </button>
      </div>

      {actionError && (
        <div className="alert alert-error" role="alert">
          <IconAlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-btn${activeTab === 'EXPENSE' ? ' active' : ''}`}
            onClick={() => setActiveTab('EXPENSE')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconExpense size={14} /> Pengeluaran ({categories.filter((c) => c.type === 'EXPENSE').length})
            </span>
          </button>
          <button
            type="button"
            className={`segmented-btn${activeTab === 'INCOME' ? ' active' : ''}`}
            onClick={() => setActiveTab('INCOME')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconIncome size={14} /> Pemasukan ({categories.filter((c) => c.type === 'INCOME').length})
            </span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">
          <span className="spinner" style={{ width: 22, height: 22 }} />
          <span>Memuat kategori...</span>
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : filteredCategories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconCategory size={22} />
          </div>
          <div className="empty-state-title">Belum ada kategori {activeTab === 'EXPENSE' ? 'pengeluaran' : 'pemasukan'}</div>
          <div className="empty-state-sub">
            Tambahkan kategori untuk memudahkan pencatatan transaksi Anda.
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
            <IconPlus size={14} /> Tambah Kategori Baru
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {filteredCategories.map((cat) => {
            const colorHex = categoryColor(cat.color)
            const txCount = cat._count?.transactions ?? 0
            return (
              <div
                key={cat.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 'var(--radius-xs)',
                      backgroundColor: colorHex,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: 'var(--text-h)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {cat.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {txCount} transaksi tercatat
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditTarget(cat)
                      setShowForm(true)
                    }}
                    title="Ubah"
                    aria-label={`Ubah kategori ${cat.name}`}
                  >
                    <IconEdit size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--expense)' }}
                    onClick={() => setDeleteTarget(cat)}
                    title="Hapus"
                    aria-label={`Hapus kategori ${cat.name}`}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <CategoryForm
          initial={editTarget}
          defaultType={activeTab}
          onSave={loadCategories}
          onClose={() => setShowForm(false)}
        />
      )}

      {deleteTarget && (
        <DeleteCategoryConfirmModal
          category={deleteTarget}
          onConfirm={handleExecuteDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  )
}
