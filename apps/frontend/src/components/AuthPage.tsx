import React, { useState, useEffect, useRef } from 'react'
import { authApi } from '../services/api'
import type { UserProfile, ApiError } from '../services/types'
import {
  IconLogo,
  IconWallet,
  IconChartBar,
  IconTarget,
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconArrowRight,
  IconUser,
  IconAlertCircle,
  IconInfo,
  IconClose,
} from './Icons'

interface AuthPageProps {
  onLogin: (user: UserProfile) => void
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  // Listen for OAuth errors in URL query params if returning from Google callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('oauth_error')
    if (oauthError) {
      if (oauthError === 'ACCOUNT_EXISTS_PASSWORD_REQUIRED') {
        setError(
          'Akun dengan email ini sudah terdaftar menggunakan password. Silakan masuk terlebih dahulu dengan password Anda.'
        )
      } else if (oauthError === 'GOOGLE_NOT_CONFIGURED') {
        setError('Konfigurasi Google OAuth belum disetel di server backend. Hubungi administrator.')
      } else if (oauthError === 'GOOGLE_AUTH_FAILED') {
        setError('Autentikasi dengan Google dibatalkan atau gagal. Silakan coba lagi.')
      } else {
        setError('Terjadi kendala saat login dengan Google. Silakan coba lagi.')
      }
    }
  }, [])

  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setError(null)
    setInfoMessage(null)
    setTimeout(() => {
      if (m === 'register') {
        nameInputRef.current?.focus()
      } else {
        emailInputRef.current?.focus()
      }
    }, 50)
  }

  const handleForgotPassword = () => {
    setInfoMessage(
      'Untuk mereset kata sandi akun Velora Anda, silakan hubungi tim administrator sistem atau gunakan catatan kredensial Anda.'
    )
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfoMessage(null)

    // Periksa validitas input HTML5 sebelum kirim ke backend
    if (mode === 'register' && nameInputRef.current && !nameInputRef.current.checkValidity()) {
      nameInputRef.current.reportValidity()
      return
    }

    if (emailInputRef.current && !emailInputRef.current.checkValidity()) {
      emailInputRef.current.reportValidity()
      return
    }

    if (passwordInputRef.current && !passwordInputRef.current.checkValidity()) {
      passwordInputRef.current.reportValidity()
      return
    }

    const trimmedEmail = email.trim()
    setLoading(true)
    try {
      if (mode === 'login') {
        const res = await authApi.login({ email: trimmedEmail, password })
        onLogin(res.user)
      } else {
        const res = await authApi.register({ name: name.trim(), email: trimmedEmail, password })
        onLogin(res.user)
      }
    } catch (err: unknown) {
      const e = err as ApiError
      setError(e.message || 'Terjadi kesalahan sistem. Silakan periksa koneksi dan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      {/* ── PANEL KIRI: Branding Velora (56-58% lebar) ── */}
      <aside className="auth-branding-panel" aria-label="Branding Velora">
        <div className="auth-branding-content">
          {/* Header Brand: Logo + Velora Text */}
          <div className="auth-brand-header">
            <IconLogo size={36} />
            <span className="auth-brand-title">Velora</span>
          </div>

          {/* Hero Section */}
          <div className="auth-hero-section">
            <h1 className="auth-hero-headline">
              Kelola Keuanganmu
              <span className="auth-hero-gradient">Raih Masa Depan yang Lebih Baik</span>
            </h1>
            <p className="auth-hero-desc">
              Velora membantu kamu mengelola keuangan dengan lebih mudah, cerdas, dan terarah. Semua yang kamu
              butuhkan untuk mencapai tujuan finansial, dalam satu aplikasi.
            </p>
          </div>

          {/* 3 Fitur Unggulan */}
          <div className="auth-features-list">
            {/* Fitur 1: Manajemen Keuangan */}
            <div className="auth-feature-item">
              <div className="auth-feature-badge cyan" aria-hidden="true">
                <IconWallet size={20} />
              </div>
              <div className="auth-feature-text">
                <div className="auth-feature-title">Manajemen Keuangan</div>
                <div className="auth-feature-desc">
                  Catat pemasukan dan pengeluaran dengan mudah di semua dompetmu.
                </div>
              </div>
            </div>

            {/* Fitur 2: Analisis dan Insight Finansial */}
            <div className="auth-feature-item">
              <div className="auth-feature-badge blue" aria-hidden="true">
                <IconChartBar size={20} />
              </div>
              <div className="auth-feature-text">
                <div className="auth-feature-title">Analisis dan Insight Finansial</div>
                <div className="auth-feature-desc">
                  Dapatkan laporan dan insight untuk keputusan keuangan yang lebih baik.
                </div>
              </div>
            </div>

            {/* Fitur 3: Target dan Perencanaan Keuangan */}
            <div className="auth-feature-item">
              <div className="auth-feature-badge cyan" aria-hidden="true">
                <IconTarget size={21} />
              </div>
              <div className="auth-feature-text">
                <div className="auth-feature-title">Target dan Perencanaan Keuangan</div>
                <div className="auth-feature-desc">
                  Wujudkan tujuan finansialmu dengan perencanaan yang terukur dan fleksibel.
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Tagline */}
          <div className="auth-branding-tagline-bottom">
            SMARTER MONEY &nbsp;×&nbsp; BRIGHTER FUTURE
          </div>
        </div>
      </aside>

      {/* ── PANEL KANAN: Form Autentikasi (42-44% lebar) ── */}
      <main className="auth-form-panel">
        <div className="auth-form-card">
          {/* Form Heading */}
          <div className="auth-form-header">
            <h2 className="auth-form-title">
              {mode === 'login' ? 'Selamat Datang Kembali' : 'Buat Akun Baru'}
            </h2>
            <p className="auth-form-subtitle">
              {mode === 'login'
                ? 'Masuk ke akun Velora untuk melanjutkan perjalanan finansialmu.'
                : 'Daftar sekarang untuk mulai mengelola keuangan pribadimu.'}
            </p>
          </div>

          {/* Alert Error */}
          {error && (
            <div className="auth-alert error" role="alert">
              <IconAlertCircle size={18} className="auth-alert-icon" />
              <div className="auth-alert-text">{error}</div>
              <button
                type="button"
                className="auth-alert-close"
                onClick={() => setError(null)}
                aria-label="Tutup pesan error"
              >
                <IconClose size={14} />
              </button>
            </div>
          )}

          {/* Alert Info */}
          {infoMessage && (
            <div className="auth-alert info" role="status">
              <IconInfo size={18} className="auth-alert-icon" />
              <div className="auth-alert-text">{infoMessage}</div>
              <button
                type="button"
                className="auth-alert-close"
                onClick={() => setInfoMessage(null)}
                aria-label="Tutup pesan informasi"
              >
                <IconClose size={14} />
              </button>
            </div>
          )}

          {/* Form Inputs */}
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-name">
                  Nama Lengkap
                </label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon-left" aria-hidden="true">
                    <IconUser size={18} />
                  </span>
                  <input
                    ref={nameInputRef}
                    id="auth-name"
                    className="auth-input"
                    type="text"
                    required
                    minLength={2}
                    autoComplete="name"
                    placeholder="Masukkan nama lengkap"
                    value={name}
                    disabled={loading}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (error) setError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (!name.trim()) {
                          if (nameInputRef.current) {
                            nameInputRef.current.value = ''
                            setName('')
                            nameInputRef.current.reportValidity()
                          }
                          return
                        }
                        if (!nameInputRef.current?.checkValidity()) {
                          nameInputRef.current?.reportValidity()
                          return
                        }
                        emailInputRef.current?.focus()
                      }
                    }}
                  />
                </div>
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-email">
                Alamat Email
              </label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon-left" aria-hidden="true">
                  <IconMail size={18} />
                </span>
                <input
                  ref={emailInputRef}
                  id="auth-email"
                  className="auth-input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={email}
                  disabled={loading}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error) setError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (!email.trim()) {
                        if (emailInputRef.current) {
                          emailInputRef.current.value = ''
                          setEmail('')
                          emailInputRef.current.reportValidity()
                        }
                        return
                      }
                      if (!emailInputRef.current?.checkValidity()) {
                        emailInputRef.current?.reportValidity()
                        return
                      }
                      passwordInputRef.current?.focus()
                    }
                  }}
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-password">
                Password
              </label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon-left" aria-hidden="true">
                  <IconLock size={18} />
                </span>
                <input
                  ref={passwordInputRef}
                  id="auth-password"
                  className="auth-input has-toggle"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'login' ? 'Masukkan password' : 'Min. 8 karakter'}
                  value={password}
                  disabled={loading}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (!password) {
                        e.preventDefault()
                        passwordInputRef.current?.reportValidity()
                        return
                      }
                      if (mode === 'register' && password.length < 8) {
                        e.preventDefault()
                        passwordInputRef.current?.reportValidity()
                        return
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="auth-toggle-pwd"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  tabIndex={-1}
                >
                  {showPassword ? <IconEye size={18} /> : <IconEyeOff size={18} />}
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <div className="auth-forgot-row">
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={handleForgotPassword}
                >
                  Lupa password?
                </button>
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  <span>Memproses...</span>
                </>
              ) : mode === 'login' ? (
                <>
                  <span>Masuk</span>
                </>
              ) : (
                <>
                  <span>Daftar Sekarang</span>
                </>
              )}
            </button>
          </form>

          {/* Navigation link at bottom of form */}
          <div className="auth-switch-prompt">
            {mode === 'login' ? (
              <span>
                Belum punya akun?{' '}
                <button
                  type="button"
                  className="auth-switch-btn"
                  onClick={() => switchMode('register')}
                >
                  Daftar sekarang
                </button>
              </span>
            ) : (
              <span>
                Sudah punya akun?{' '}
                <button
                  type="button"
                  className="auth-switch-btn"
                  onClick={() => switchMode('login')}
                >
                  Masuk
                </button>
              </span>
            )}
          </div>

          {/* Mobile Only: 3 Features & Bottom Tagline */}
          <div className="auth-mobile-footer" aria-hidden="true">
            <div className="auth-mobile-divider" />
            <div className="auth-mobile-features-grid">
              <div className="auth-mobile-feature-item">
                <div className="auth-mobile-feature-badge">
                  <IconWallet size={20} />
                </div>
                <div className="auth-mobile-feature-title">
                  Manajemen<br />Keuangan
                </div>
              </div>
              <div className="auth-mobile-feature-item">
                <div className="auth-mobile-feature-badge">
                  <IconChartBar size={20} />
                </div>
                <div className="auth-mobile-feature-title">
                  Analisis dan<br />Insight
                </div>
              </div>
              <div className="auth-mobile-feature-item">
                <div className="auth-mobile-feature-badge">
                  <IconTarget size={21} />
                </div>
                <div className="auth-mobile-feature-title">
                  Target dan<br />Perencanaan
                </div>
              </div>
            </div>
            <div className="auth-mobile-tagline">
              SMARTER MONEY &nbsp;×&nbsp; BRIGHTER FUTURE
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
