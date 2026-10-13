import React, { useState, useEffect } from 'react'
import type { Wallet, ApiError } from '../services/types'
import { transferApi } from '../services/api'
import { formatCurrency } from '../lib/utils'
import { IconClose, IconAlertCircle, IconTransfer, IconCheck } from './Icons'

interface TransferModalProps {
  wallets: Wallet[]
  defaultFromWalletId?: string
  onClose: () => void
  onSuccess: () => void
}

export function TransferModal({
  wallets,
  defaultFromWalletId,
  onClose,
  onSuccess,
}: TransferModalProps) {
  const initialFrom =
    defaultFromWalletId && wallets.some((w) => w.id === defaultFromWalletId)
      ? defaultFromWalletId
      : wallets[0]?.id ?? ''

  const availableTargets = wallets.filter((w) => w.id !== initialFrom)
  const initialTo = availableTargets[0]?.id ?? ''

  const [fromWalletId, setFromWalletId] = useState(initialFrom)
  const [toWalletId, setToWalletId] = useState(initialTo)
  const [amountStr, setAmountStr] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConfirm) setShowConfirm(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, showConfirm])

  // When fromWalletId changes, ensure toWalletId is not the same
  const handleFromChange = (newFromId: string) => {
    setFromWalletId(newFromId)
    if (toWalletId === newFromId) {
      const remaining = wallets.filter((w) => w.id !== newFromId)
      setToWalletId(remaining[0]?.id ?? '')
    }
  }

  const fromWallet = wallets.find((w) => w.id === fromWalletId)
  const toWallet = wallets.find((w) => w.id === toWalletId)

  const parsedAmount = Math.round(parseFloat(amountStr)) || 0
  const fromBalance = parseFloat(fromWallet?.balance || '0')
  const toBalance = parseFloat(toWallet?.balance || '0')
  const isInsufficient = parsedAmount > fromBalance
  const projectedFrom = Math.max(0, fromBalance - parsedAmount)
  const projectedTo = toBalance + parsedAmount

  const isFormValid =
    fromWalletId &&
    toWalletId &&
    fromWalletId !== toWalletId &&
    parsedAmount > 0 &&
    !isInsufficient

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return
    setError(null)
    setShowConfirm(true)
  }

  const handleExecuteTransfer = async () => {
    setLoading(true)
    setError(null)

    try {
      await transferApi.create({
        fromWalletId,
        toWalletId,
        amount: parsedAmount,
        notes: notes.trim() || undefined,
        date: date ? new Date(date).toISOString() : undefined,
      })

      onSuccess()
      onClose()
    } catch (err: unknown) {
      const e = err as ApiError
      setError(e.message || 'Gagal melakukan transfer.')
      setShowConfirm(false)
    } finally {
      setLoading(false)
    }
  }

  if (wallets.length < 2) {
    return (
      <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
          <div className="modal-header">
            <div className="modal-title">Transfer Antardompet</div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
              <IconClose size={18} />
            </button>
          </div>
          <div className="modal-body" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              Anda memerlukan minimal 2 dompet untuk dapat melakukan transfer antardompet. Silakan buat dompet tambahan terlebih dahulu.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
              Mengerti
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!showConfirm) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, width: '100%' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconTransfer size={18} style={{ color: 'var(--accent)' }} />
            <span className="modal-title" id="transfer-modal-title">
              Transfer Antardompet
            </span>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Tutup dialog"
            disabled={loading}
          >
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

            {/* Wallet Selection Row */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" htmlFor="from-wallet-select">
                  Dompet Asal (Pengirim)
                </label>
                <select
                  id="from-wallet-select"
                  className="form-select"
                  value={fromWalletId}
                  onChange={(e) => handleFromChange(e.target.value)}
                  disabled={loading || showConfirm}
                  required
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatCurrency(w.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" htmlFor="to-wallet-select">
                  Dompet Tujuan (Penerima)
                </label>
                <select
                  id="to-wallet-select"
                  className="form-select"
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                  disabled={loading || showConfirm}
                  required
                >
                  {wallets
                    .filter((w) => w.id !== fromWalletId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatCurrency(w.balance)})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Amount input */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="transfer-amount-input">
                  Nominal Transfer (Rp)
                </label>
                {parsedAmount > 0 && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: isInsufficient ? 'var(--expense)' : 'var(--accent)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCurrency(parsedAmount)}
                  </span>
                )}
              </div>
              <input
                id="transfer-amount-input"
                className="form-input"
                type="number"
                min="1"
                step="1"
                placeholder="Contoh: 250000"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                disabled={loading || showConfirm}
                required
                autoFocus
              />
              {isInsufficient && (
                <span style={{ fontSize: 11.5, color: 'var(--expense)', marginTop: 4, display: 'block' }}>
                  Saldo dompet asal ({formatCurrency(fromBalance)}) tidak mencukupi untuk nominal ini.
                </span>
              )}
            </div>

            {/* Date & Notes Row */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" htmlFor="transfer-date">
                  Waktu Transfer
                </label>
                <input
                  id="transfer-date"
                  className="form-input"
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={loading || showConfirm}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" htmlFor="transfer-notes">
                  Catatan (Opsional)
                </label>
                <input
                  id="transfer-notes"
                  className="form-input"
                  type="text"
                  placeholder="Misal: Top up saldo e-wallet"
                  maxLength={255}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading || showConfirm}
                />
              </div>
            </div>

            {/* Live Balance Impact Card */}
            {fromWallet && toWallet && (
              <div
                style={{
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  border: '1px solid var(--border-subtle)',
                  marginTop: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: 8,
                  }}
                >
                  Simulasi Perubahan Saldo
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {fromWallet.name} (Asal)
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-h)', marginTop: 2 }}>
                      {formatCurrency(fromBalance)}{' '}
                      {parsedAmount > 0 && (
                        <span
                          style={{
                            color: isInsufficient ? 'var(--expense)' : 'var(--text-muted)',
                            fontWeight: 500,
                          }}
                        >
                          → {formatCurrency(projectedFrom)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {toWallet.name} (Tujuan)
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-h)', marginTop: 2 }}>
                      {formatCurrency(toBalance)}{' '}
                      {parsedAmount > 0 && !isInsufficient && (
                        <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                          → {formatCurrency(projectedTo)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 8,
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <IconCheck size={13} style={{ color: 'var(--income)' }} />
                  <span>Total saldo seluruh dompet Anda tetap sama (Rp 0 perubahan kas ekosistem).</span>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isFormValid || loading}
            >
              Lanjutkan Transfer
            </button>
          </div>
        </form>

        {/* Custom React Confirmation Dialog */}
        {showConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(10, 15, 29, 0.9)',
              backdropFilter: 'blur(4px)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24,
              textAlign: 'center',
              zIndex: 10,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.12)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <IconTransfer size={22} />
            </div>

            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-h)', marginBottom: 8 }}>
              Konfirmasi Transfer Antardompet
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Pindahkan <strong style={{ color: 'var(--text-h)' }}>{formatCurrency(parsedAmount)}</strong> dari{' '}
              <strong style={{ color: 'var(--text-h)' }}>{fromWallet?.name}</strong> ke{' '}
              <strong style={{ color: 'var(--text-h)' }}>{toWallet?.name}</strong>?
            </p>

            <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 320 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleExecuteTransfer}
                disabled={loading}
              >
                {loading ? 'Memproses...' : 'Ya, Kirim Transfer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
