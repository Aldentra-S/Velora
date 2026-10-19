import { useState, useEffect } from 'react'
import { authApi } from './services/api'
import type { UserProfile, ApiError } from './services/types'
import AuthPage from './components/AuthPage'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import WalletsPage from './components/WalletsPage'
import CategoriesPage from './components/CategoriesPage'
import TransactionsPage from './components/TransactionsPage'
import BudgetsPage from './components/BudgetsPage'
import RecurringPage from './components/RecurringPage'
import ReportsPage from './components/ReportsPage'
import ProfilePage from './components/ProfilePage'
import NotificationDropdown from './components/NotificationDropdown'
import { IconLogo, IconMenu, IconClose, IconAlertCircle } from './components/Icons'

type Page = 'dashboard' | 'wallets' | 'categories' | 'transactions' | 'budgets' | 'recurring' | 'reports' | 'profile'

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Dashboard',
  wallets: 'Dompet & Rekening',
  categories: 'Kategori Anggaran',
  transactions: 'Buku Transaksi',
  budgets: 'Anggaran Bulanan',
  recurring: 'Transaksi Rutin & Berulang',
  reports: 'Laporan Keuangan & Ekspor',
  profile: 'Profil & Pengaturan Akun',
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [sessionChecking, setSessionChecking] = useState(true)
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  // Restore session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        await authApi.getCsrf()
        const res = await authApi.getMe()
        setUser(res.user)
      } catch {
        setUser(null)
      } finally {
        setSessionChecking(false)
      }
    }
    checkSession()
  }, [])

  // Keyboard Escape listener for logout confirmation dialog
  useEffect(() => {
    if (!showLogoutConfirm) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loggingOut) {
        setShowLogoutConfirm(false)
        setLogoutError(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showLogoutConfirm, loggingOut])

  const handleLogin = (u: UserProfile) => {
    setUser(u)
    setCurrentPage('dashboard')
  }

  const handleOpenLogoutConfirm = () => {
    setLogoutError(null)
    setShowLogoutConfirm(true)
  }

  const handleCloseLogoutConfirm = () => {
    if (!loggingOut) {
      setShowLogoutConfirm(false)
      setLogoutError(null)
    }
  }

  const handleConfirmLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError(null)
    try {
      await authApi.logout()
      setUser(null)
      setShowLogoutConfirm(false)
    } catch (err: unknown) {
      const e = err as ApiError
      setLogoutError(e.message || 'Gagal memproses keluar akun. Silakan coba lagi.')
    } finally {
      setLoggingOut(false)
    }
  }

  // ── Loading splash ─────────────────────────────────────────────────────────
  if (sessionChecking) {
    return (
      <div
        style={{
          minHeight: '100svh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--bg)',
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              marginBottom: 16,
            }}
          >
            <IconLogo size={26} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-h)', letterSpacing: -0.3 }}>
            Velora
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 20 }}>
            Memeriksa autentikasi sesi...
          </div>
          <span className="spinner" style={{ width: 20, height: 20 }} />
        </div>
      </div>
    )
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!user) {
    return <AuthPage onLogin={handleLogin} />
  }

  // ── App Shell ──────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onLogout={handleOpenLogoutConfirm}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Mobile menu toggle */}
            <button
              type="button"
              id="mobile-menu-btn"
              aria-label="Buka navigasi menu"
              onClick={() => setMobileNavOpen((o) => !o)}
              className="mobile-menu-btn btn btn-ghost"
              style={{
                display: 'none',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-h)',
              }}
            >
              <IconMenu size={20} />
            </button>
            <span className="topbar-title">{PAGE_TITLES[currentPage]}</span>
          </div>

          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationDropdown onNavigate={(page) => setCurrentPage(page)} />

            {loggingOut && (
              <span className="spinner" style={{ width: 14, height: 14 }} />
            )}
            <div
              onClick={() => setCurrentPage('profile')}
              title="Buka profil dan pengaturan akun"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setCurrentPage('profile')
                }
              }}
              style={{
                fontSize: 12,
                color: 'var(--text)',
                background: currentPage === 'profile' ? 'var(--surface-raised)' : 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 99,
                padding: '4px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--income)',
                  display: 'inline-block',
                }}
                aria-hidden="true"
              />
              {user.name}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main id="main-page-content">
          {currentPage === 'dashboard' && (
            <Dashboard
              onNavigate={(page) => setCurrentPage(page)}
            />
          )}
          {currentPage === 'wallets' && <WalletsPage />}
          {currentPage === 'categories' && <CategoriesPage />}
          {currentPage === 'transactions' && <TransactionsPage />}
          {currentPage === 'budgets' && <BudgetsPage user={user} />}
          {currentPage === 'recurring' && <RecurringPage />}
          {currentPage === 'reports' && <ReportsPage />}
          {currentPage === 'profile' && (
            <ProfilePage
              currentUser={user}
              onUserUpdated={setUser}
            />
          )}
        </main>
      </div>

      {/* ── Modal Konfirmasi Logout ─────────────────────────────────────────── */}
      {showLogoutConfirm && (
        <div
          className="modal-overlay"
          onClick={handleCloseLogoutConfirm}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
        >
          <div
            className="modal"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title" id="logout-dialog-title">
                Keluar dari akun?
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={handleCloseLogoutConfirm}
                disabled={loggingOut}
                aria-label="Tutup dialog"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="modal-body">
              {logoutError && (
                <div
                  className="auth-alert error"
                  style={{ marginBottom: 14 }}
                  role="alert"
                >
                  <IconAlertCircle size={16} />
                  <div style={{ flex: 1, fontSize: 13 }}>{logoutError}</div>
                </div>
              )}
              <p style={{ fontSize: 13.5, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
                Kamu yakin ingin keluar dari akun Velora ini?
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCloseLogoutConfirm}
                disabled={loggingOut}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmLogout}
                disabled={loggingOut}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {loggingOut ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  'Ya, Keluar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
