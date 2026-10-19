import React from 'react'
import type { UserProfile } from '../services/types'
import { getInitials } from '../lib/utils'
import {
  IconLogo,
  IconDashboard,
  IconWallet,
  IconCategory,
  IconTransaction,
  IconLogout,
  IconBudget,
  IconRepeat,
  IconReport,
  IconUser,
} from './Icons'

export type Page = 'dashboard' | 'wallets' | 'categories' | 'transactions' | 'budgets' | 'recurring' | 'reports' | 'profile'

interface SidebarProps {
  user: UserProfile
  currentPage: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

const NAV_ITEMS: { page: Page; icon: React.FC<{ size?: number; className?: string }>; label: string }[] = [
  { page: 'dashboard', icon: IconDashboard, label: 'Dashboard' },
  { page: 'wallets', icon: IconWallet, label: 'Dompet' },
  { page: 'categories', icon: IconCategory, label: 'Kategori' },
  { page: 'transactions', icon: IconTransaction, label: 'Transaksi' },
  { page: 'budgets', icon: IconBudget, label: 'Anggaran & Target' },
  { page: 'recurring', icon: IconRepeat, label: 'Transaksi Rutin' },
  { page: 'reports', icon: IconReport, label: 'Laporan Keuangan' },
]

export default function Sidebar({
  user,
  currentPage,
  onNavigate,
  onLogout,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4, 7, 14, 0.65)',
            backdropFilter: 'blur(2px)',
            zIndex: 35,
          }}
          className="sidebar-overlay"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <IconLogo size={28} />
          </div>
          <div>
            <div className="sidebar-title">Velora</div>
            <div className="sidebar-subtitle">Finance Engine</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" aria-label="Navigasi utama">
          <div className="nav-section-label">Menu</div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.page
            return (
              <button
                key={item.page}
                type="button"
                className={`nav-item${isActive ? ' active' : ''}`}
                onClick={() => {
                  onNavigate(item.page)
                  onMobileClose()
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-item-icon">
                  <Icon size={18} />
                </span>
                {item.label}
              </button>
            )
          })}

          <div className="nav-section-label" style={{ marginTop: 12 }}>
            Akun
          </div>
          <button
            type="button"
            className={`nav-item${currentPage === 'profile' ? ' active' : ''}`}
            onClick={() => {
              onNavigate('profile')
              onMobileClose()
            }}
            id="sidebar-profile-btn"
            aria-current={currentPage === 'profile' ? 'page' : undefined}
          >
            <span className="nav-item-icon">
              <IconUser size={18} />
            </span>
            Profil & Pengaturan
          </button>
          <button
            type="button"
            className="nav-item"
            onClick={() => {
              onLogout()
              onMobileClose()
            }}
            id="sidebar-logout-btn"
          >
            <span className="nav-item-icon">
              <IconLogout size={18} />
            </span>
            Keluar
          </button>
        </nav>

        {/* User chip */}
        <div
          className="sidebar-footer"
          onClick={() => {
            onNavigate('profile')
            onMobileClose()
          }}
          style={{ cursor: 'pointer' }}
          title="Buka profil dan pengaturan akun"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onNavigate('profile')
              onMobileClose()
            }
          }}
        >
          <div className="user-chip">
            <div className="user-avatar">{getInitials(user.name)}</div>
            <div className="user-info">
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.email}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
