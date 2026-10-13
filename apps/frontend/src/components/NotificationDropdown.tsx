import { useState, useEffect, useRef } from 'react'
import { notificationApi } from '../services/api'
import type { NotificationItem } from '../services/types'
import {
  IconBell,
  IconAlertCircle,
  IconRepeat,
  IconCheck,
  IconTrash,
  IconChevronRight,
  IconInfo
} from './Icons'

interface NotificationDropdownProps {
  onNavigate: (page: 'budgets' | 'recurring') => void
}

export default function NotificationDropdown({ onNavigate }: NotificationDropdownProps) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const res = await notificationApi.list()
      setNotifications(res.notifications)
      setUnreadCount(res.unreadCount)
    } catch {
      // Silently handle error to prevent disruption
    } finally {
      setLoading(false)
    }
  }

  // Initial load and periodic refresh (every 60s)
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click or Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await notificationApi.markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      // ignore
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {
      // ignore
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await notificationApi.delete(id)
      const target = notifications.find((n) => n.id === id)
      if (target && !target.isRead) {
        setUnreadCount((c) => Math.max(0, c - 1))
      }
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch {
      // ignore
    }
  }

  const handleItemClick = (n: NotificationItem) => {
    if (!n.isRead) {
      handleMarkAsRead(n.id)
    }
    if (n.link === '/budgets') {
      setOpen(false)
      onNavigate('budgets')
    } else if (n.link === '/recurring') {
      setOpen(false)
      onNavigate('recurring')
    }
  }

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffMins < 1) return 'Baru saja'
      if (diffMins < 60) return `${diffMins}m yang lalu`
      if (diffHours < 24) return `${diffHours}j yang lalu`
      return `${diffDays}h yang lalu`
    } catch {
      return ''
    }
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        id="notification-bell-btn"
        className="btn btn-ghost"
        style={{
          position: 'relative',
          padding: '7px',
          borderRadius: 'var(--radius-sm)',
          color: unreadCount > 0 ? 'var(--text-h)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={() => {
          setOpen((prev) => !prev)
          if (!open) {
            fetchNotifications()
          }
        }}
        aria-label={`Notifikasi (${unreadCount} belum dibaca)`}
        aria-expanded={open}
      >
        <IconBell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 99,
              background: 'var(--expense)',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              boxShadow: '0 0 0 2px var(--surface)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Menu */}
      {open && (
        <div
          role="region"
          aria-label="Daftar notifikasi"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 360,
            maxWidth: '92vw',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 12px 32px rgba(4, 7, 14, 0.45), 0 2px 6px rgba(0, 0, 0, 0.2)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 460,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-h)' }}>
                Notifikasi
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 99,
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--expense)',
                  }}
                >
                  {unreadCount} baru
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '3px 8px', height: 'auto', minHeight: 0 }}
                onClick={handleMarkAllAsRead}
              >
                Tandai dibaca
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                <span className="spinner" style={{ width: 16, height: 16, marginBottom: 8 }} />
                <div>Memeriksa status keuangan...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'var(--surface-2)',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 10px',
                    color: 'var(--income)',
                  }}
                >
                  <IconCheck size={20} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-h)' }}>
                  Semua Beres!
                </div>
                <div style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.4 }}>
                  Tidak ada peringatan anggaran atau transaksi jatuh tempo saat ini.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {notifications.map((n) => {
                  const isExceeded = n.type === 'BUDGET_EXCEEDED'
                  const isWarning = n.type === 'BUDGET_WARNING'
                  const isRecurring = n.type === 'RECURRING_DUE'

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleItemClick(n)}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: n.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                        cursor: n.link ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        transition: 'background 0.15s ease',
                      }}
                      className="notification-item"
                    >
                      {/* Icon */}
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 'var(--radius-sm)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          marginTop: 2,
                          background: isExceeded
                            ? 'rgba(239, 68, 68, 0.12)'
                            : isWarning
                            ? 'rgba(245, 158, 11, 0.12)'
                            : isRecurring
                            ? 'rgba(99, 102, 241, 0.12)'
                            : 'var(--surface-2)',
                          color: isExceeded
                            ? 'var(--expense)'
                            : isWarning
                            ? '#f59e0b'
                            : isRecurring
                            ? 'var(--accent)'
                            : 'var(--text-muted)',
                        }}
                      >
                        {isExceeded || isWarning ? (
                          <IconAlertCircle size={15} />
                        ) : isRecurring ? (
                          <IconRepeat size={15} />
                        ) : (
                          <IconInfo size={15} />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span
                            style={{
                              fontSize: 12.5,
                              fontWeight: n.isRead ? 500 : 600,
                              color: n.isRead ? 'var(--text)' : 'var(--text-h)',
                              lineHeight: 1.3,
                            }}
                          >
                            {n.title}
                          </span>
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: 11.5,
                            color: 'var(--text-muted)',
                            marginTop: 3,
                            lineHeight: 1.4,
                            wordBreak: 'break-word',
                          }}
                        >
                          {n.message}
                        </p>

                        {/* Quick action link */}
                        {n.link && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              fontSize: 11,
                              fontWeight: 500,
                              color: 'var(--accent)',
                              marginTop: 6,
                            }}
                          >
                            <span>{n.link === '/budgets' ? 'Lihat Anggaran' : 'Lihat Transaksi Rutin'}</span>
                            <IconChevronRight size={12} />
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                        {!n.isRead && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ padding: 4, height: 22, minHeight: 0, color: 'var(--text-muted)' }}
                            onClick={(e) => handleMarkAsRead(n.id, e)}
                            title="Tandai dibaca"
                            aria-label="Tandai dibaca"
                          >
                            <IconCheck size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: 4, height: 22, minHeight: 0, color: 'var(--text-muted)' }}
                          onClick={(e) => handleDelete(n.id, e)}
                          title="Hapus notifikasi"
                          aria-label="Hapus notifikasi"
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
