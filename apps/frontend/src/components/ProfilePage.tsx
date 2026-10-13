import React, { useState, useEffect } from 'react'
import { userApi } from '../services/api'
import type { UserProfile, UserAccountProfile, UserPreferences } from '../services/types'
import { getInitials, formatDate } from '../lib/utils'
import {
  IconUser,
  IconShield,
  IconKey,
  IconSettings,
  IconCheck,
  IconAlertCircle,
  IconInfo,
  IconWallet,
  IconTransaction,
  IconBudget,
  IconTarget,
  IconRepeat
} from './Icons'

interface ProfilePageProps {
  currentUser: UserProfile
  onUserUpdated: (updated: UserProfile) => void
}

type Tab = 'profile' | 'security' | 'preferences'

export default function ProfilePage({ currentUser, onUserUpdated }: ProfilePageProps) {
  const [tab, setTab] = useState<Tab>('profile')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserAccountProfile | null>(null)
  const [preferences, setPreferences] = useState<UserPreferences>({
    currencyFormat: 'IDR',
    compactView: false
  })

  // Edit Name State
  const [name, setName] = useState(currentUser.name)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Preferences State
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [prefMessage, setPrefMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function loadProfileData() {
      setLoading(true)
      try {
        const [profRes, prefRes] = await Promise.all([
          userApi.getProfile(),
          userApi.getPreferences()
        ])
        setProfile(profRes.profile)
        setName(profRes.profile.name)
        setPreferences(prefRes.preferences)
      } catch {
        // Fallback with current user
        setName(currentUser.name)
      } finally {
        setLoading(false)
      }
    }
    loadProfileData()
  }, [currentUser])

  // Save Name / Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileMessage(null)
    if (!name.trim() || name.trim().length < 2) {
      setProfileMessage({ type: 'error', text: 'Nama minimal terdiri dari 2 karakter.' })
      return
    }

    setSavingProfile(true)
    try {
      const res = await userApi.updateProfile({ name: name.trim() })
      setProfileMessage({ type: 'success', text: res.message || 'Profil berhasil diperbarui.' })
      onUserUpdated(res.user)
      if (profile) {
        setProfile({ ...profile, name: res.user.name })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui profil.'
      setProfileMessage({ type: 'error', text: msg })
    } finally {
      setSavingProfile(false)
    }
  }

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage(null)

    if (!currentPassword) {
      setPasswordMessage({ type: 'error', text: 'Password saat ini wajib diisi.' })
      return
    }

    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password baru minimal harus 8 karakter.' })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Konfirmasi password baru tidak cocok.' })
      return
    }

    setSavingPassword(true)
    try {
      const res = await userApi.changePassword({ currentPassword, newPassword })
      setPasswordMessage({ type: 'success', text: res.message || 'Password berhasil diperbarui.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah password.'
      setPasswordMessage({ type: 'error', text: msg })
    } finally {
      setSavingPassword(false)
    }
  }

  // Save Preferences
  const handleSavePreferences = async (newPref: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...newPref }
    setPreferences(updated)
    setPrefMessage(null)
    setSavingPreferences(true)

    try {
      const res = await userApi.updatePreferences(updated)
      setPreferences(res.preferences)
      setPrefMessage({ type: 'success', text: 'Pengaturan preferensi antarmuka disimpan.' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan preferensi.'
      setPrefMessage({ type: 'error', text: msg })
    } finally {
      setSavingPreferences(false)
    }
  }

  if (loading && !profile) {
    return (
      <div className="page" style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', padding: '60px 0' }}>
        <span className="spinner" style={{ width: 22, height: 22, marginBottom: 12 }} />
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Memuat informasi profil dan keamanan...</div>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h2>Profil & Pengaturan Akun</h2>
          <p>Kelola identitas, keamanan kata sandi, preferensi antarmuka, dan sesi</p>
        </div>
      </div>

      {/* Account Identity Card */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          padding: '20px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent) 0%, #4338ca 100%)',
              color: '#ffffff',
              fontSize: 22,
              fontWeight: 700,
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
              flexShrink: 0,
            }}
          >
            {getInitials(currentUser.name)}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-h)' }}>
                {currentUser.name}
              </span>
              <span
                className="badge"
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--income)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                ● Akun Aktif
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {currentUser.email}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Bergabung sejak: {profile ? formatDate(profile.createdAt) : '-'} • Sesi aktif: {profile?.activeSessionsCount || 1} perangkat
            </div>
          </div>
        </div>

        {/* Quick financial stats footprint */}
        {profile?.metrics && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: 8,
              marginTop: 18,
              paddingTop: 16,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ textAlign: 'center', padding: '6px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 11 }}>
                <IconWallet size={12} /> Dompet
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', marginTop: 2 }}>
                {profile.metrics.wallets}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 11 }}>
                <IconTransaction size={12} /> Transaksi
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', marginTop: 2 }}>
                {profile.metrics.transactions}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 11 }}>
                <IconBudget size={12} /> Anggaran
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', marginTop: 2 }}>
                {profile.metrics.budgets}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 11 }}>
                <IconTarget size={12} /> Target
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', marginTop: 2 }}>
                {profile.metrics.goals}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 11 }}>
                <IconRepeat size={12} /> Rutin
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', marginTop: 2 }}>
                {profile.metrics.recurringTransactions}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--border)',
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          className={`btn btn-sm ${tab === 'profile' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setTab('profile')}
        >
          <IconUser size={15} />
          <span>Informasi Profil</span>
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'security' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setTab('security')}
        >
          <IconShield size={15} />
          <span>Keamanan & Password</span>
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'preferences' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setTab('preferences')}
        >
          <IconSettings size={15} />
          <span>Preferensi Tampilan</span>
        </button>
      </div>

      {/* ── TAB 1: Profil Pengguna ─────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="card">
          <div className="card-header-row" style={{ marginBottom: 16 }}>
            <div>
              <h3>Informasi Pribadi</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Perbarui nama tampilan akun Anda. Alamat email terdaftar bersifat permanen untuk keamanan.
              </p>
            </div>
          </div>

          {profileMessage && (
            <div
              className={`alert ${profileMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}
              role="alert"
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}
            >
              {profileMessage.type === 'success' ? (
                <IconCheck size={16} style={{ color: 'var(--income)' }} />
              ) : (
                <IconAlertCircle size={16} />
              )}
              <span>{profileMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" htmlFor="user-display-name">
                Nama Lengkap / Tampilan
              </label>
              <input
                id="user-display-name"
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Anda"
                required
                minLength={2}
                maxLength={100}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" htmlFor="user-email-readonly">
                Alamat Email (Akun Utama)
              </label>
              <input
                id="user-email-readonly"
                className="form-input"
                type="email"
                value={currentUser.email}
                disabled
                style={{ opacity: 0.7, cursor: 'not-allowed', background: 'var(--surface-2)' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Email terverifikasi digunakan sebagai identitas login tunggal Anda.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={savingProfile || name.trim() === currentUser.name}
              >
                {savingProfile ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  'Simpan Perubahan Nama'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 2: Keamanan & Password ─────────────────────────────────────── */}
      {tab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header-row" style={{ marginBottom: 16 }}>
              <div>
                <h3>Ubah Kata Sandi (Password)</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Gunakan minimal 8 karakter kombinasi huruf dan angka untuk perlindungan maksimal.
                </p>
              </div>
            </div>

            {passwordMessage && (
              <div
                className={`alert ${passwordMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}
                role="alert"
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}
              >
                {passwordMessage.type === 'success' ? (
                  <IconCheck size={16} style={{ color: 'var(--income)' }} />
                ) : (
                  <IconAlertCircle size={16} />
                )}
                <span>{passwordMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" htmlFor="current-pwd">
                  Password Saat Ini
                </label>
                <input
                  id="current-pwd"
                  className="form-input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan password lama"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" htmlFor="new-pwd">
                  Password Baru
                </label>
                <input
                  id="new-pwd"
                  className="form-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  required
                  minLength={8}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" htmlFor="confirm-pwd">
                  Konfirmasi Password Baru
                </label>
                <input
                  id="confirm-pwd"
                  className="form-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru"
                  required
                  minLength={8}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                >
                  {savingPassword ? (
                    <>
                      <span className="spinner" style={{ width: 14, height: 14 }} />
                      <span>Memproses Enkripsi...</span>
                    </>
                  ) : (
                    'Perbarui Password'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Security Hygiene & Audit Card */}
          <div
            className="card"
            style={{
              background: 'rgba(99, 102, 241, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <IconKey size={20} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-h)' }}>
                  Kebijakan Keamanan & Perlindungan Sesi
                </h4>
                <ul style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8, paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>Password Anda di-hash dengan algoritma <strong>Bcrypt Salted Hashing</strong>.</li>
                  <li>Token sesi menggunakan <strong>HttpOnly & SameSite Lax Cookie</strong> terlindung dari akses skrip XSS.</li>
                  <li>Setiap perubahan password secara otomatis <strong>mencabut sesi di perangkat lain</strong>.</li>
                  <li>Proteksi <strong>In-Memory Rate Limiting</strong> aktif pada seluruh endpoint login dan registrasi.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Preferensi Antarmuka ───────────────────────────────────── */}
      {tab === 'preferences' && (
        <div className="card">
          <div className="card-header-row" style={{ marginBottom: 16 }}>
            <div>
              <h3>Preferensi Tampilan Antarmuka</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Atur format visual sistem sesuai kenyamanan penggunaan harian Anda.
              </p>
            </div>
          </div>

          {prefMessage && (
            <div
              className={`alert ${prefMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}
              role="alert"
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}
            >
              {prefMessage.type === 'success' ? (
                <IconCheck size={16} style={{ color: 'var(--income)' }} />
              ) : (
                <IconAlertCircle size={16} />
              )}
              <span>{prefMessage.text}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Format Mata Uang */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 16,
                borderBottom: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-h)' }}>
                  Format Mata Uang Standar Tampilan
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Mengatur simbol format default di ringkasan (Catatan: saldo dompet tetap mengikuti mata uang asli dompet).
                </div>
              </div>

              <select
                className="form-select"
                style={{ width: 'auto', minWidth: 140, fontSize: 13 }}
                value={preferences.currencyFormat}
                onChange={(e) => handleSavePreferences({ currencyFormat: e.target.value as 'IDR' | 'USD' | 'EUR' | 'SGD' | 'JPY' })}
                disabled={savingPreferences}
              >
                <option value="IDR">IDR (Rp - Rupiah)</option>
                <option value="USD">USD ($ - Dollar)</option>
                <option value="EUR">EUR (€ - Euro)</option>
                <option value="SGD">SGD (S$ - Dollar)</option>
                <option value="JPY">JPY (¥ - Yen)</option>
              </select>
            </div>

            {/* Compact View Mode */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 16,
                borderBottom: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-h)' }}>
                  Tampilan Padat (Compact Mode)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Mengurangi padding kartu dan tabel agar lebih banyak informasi muat di layar Anda.
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={preferences.compactView}
                  onChange={(e) => handleSavePreferences({ compactView: e.target.checked })}
                  disabled={savingPreferences}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-h)' }}>
                  {preferences.compactView ? 'Aktif' : 'Nonaktif'}
                </span>
              </label>
            </div>

            {/* Design System Integrity Notice */}
            <div
              style={{
                background: 'var(--surface-2)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              <IconInfo size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div>
                <strong>Integritas Nilai Keuangan:</strong> Seluruh mutasi transaksi dan saldo riil dompet tetap dihitung secara presisi berbasis mata uang per akun. Perubahan pengaturan tampilan tidak mengubah atau mengonversi nilai saldo tanpa kurs riil.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
