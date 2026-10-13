import React, { useState } from 'react'
import { authApi } from '../services/api'
import type { UserProfile, ApiError } from '../services/types'
import { IconLogo, IconAlertCircle } from './Icons'

interface AuthPageProps {
  onLogin: (user: UserProfile) => void
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (mode === 'login') {
        const res = await authApi.login({ email, password })
        onLogin(res.user)
      } else {
        const res = await authApi.register({ name, email, password })
        onLogin(res.user)
      }
    } catch (err: unknown) {
      const e = err as ApiError
      setError(e.message || 'Terjadi kesalahan sistem. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-brand">
          <div className="auth-logo" aria-hidden="true">
            <IconLogo size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="auth-brand-name">Velora</div>
            <div className="auth-brand-tagline">Personal Finance Platform</div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tabs" role="tablist" aria-label="Autentikasi">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Masuk
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Daftar Baru
          </button>
        </div>

        {error && (
          <div className="alert alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconAlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate={false}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name">
                Nama Lengkap
              </label>
              <input
                id="auth-name"
                className="form-input"
                type="text"
                required
                autoComplete="name"
                placeholder="cth. Budi Pratama"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">
              Alamat Email
            </label>
            <input
              id="auth-email"
              className="form-input"
              type="email"
              required
              autoComplete="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="auth-password">
                Kata Sandi
              </label>
              {mode === 'register' && (
                <span className="form-hint" style={{ fontSize: 11 }}>Min. 8 karakter</span>
              )}
            </div>
            <input
              id="auth-password"
              className="form-input"
              type="password"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: 14 }}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14 }} />
                <span>Memproses...</span>
              </>
            ) : mode === 'login' ? (
              'Masuk ke Akun'
            ) : (
              'Buat Akun Velora'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
