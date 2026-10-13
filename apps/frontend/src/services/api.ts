import type {
  UserProfile,
  AuthResponse,
  Wallet,
  Category,
  Transaction,
  Pagination,
  FinanceSummary,
  DashboardAnalytics,
  DashboardFilters,
  DashboardSummary,
  CashflowPoint,
  CategorySpending,
  DashboardBudgetOverview,
  DashboardActivity,
  ApiError,
  TransactionType,
  WalletType,
  Budget,
  BudgetStatus,
  BudgetSummary,
  BudgetDetail,
  Transfer,
  TransferStatus,
  CreateTransferPayload,
  FinancialGoal,
  GoalsSummary,
  RecurringTransaction,
  RecurringFrequency,
  RecurringSummary,
  ReportPeriodType,
  FinancialReportData,
  WalletHistoryData,
  UserAccountProfile,
  UserPreferences,
  NotificationItem,
} from './types'

export type {
  UserProfile,
  AuthResponse,
  Wallet,
  Category,
  Transaction,
  Pagination,
  FinanceSummary,
  DashboardAnalytics,
  DashboardFilters,
  DashboardSummary,
  CashflowPoint,
  CategorySpending,
  DashboardBudgetOverview,
  DashboardActivity,
  ApiError,
  TransactionType,
  WalletType,
  Budget,
  BudgetStatus,
  BudgetSummary,
  BudgetDetail,
  Transfer,
  TransferStatus,
  CreateTransferPayload,
  FinancialGoal,
  GoalsSummary,
  RecurringTransaction,
  RecurringFrequency,
  RecurringSummary,
  ReportPeriodType,
  FinancialReportData,
  WalletHistoryData,
}

const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5000/api'

let cachedCsrfToken: string | null = null

export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/csrf`, {
    method: 'GET',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Gagal mengambil token keamanan CSRF')
  const data = await res.json()
  cachedCsrfToken = data.csrfToken
  return data.csrfToken
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const headers = new Headers(options.headers || {})

  const method = (options.method || 'GET').toUpperCase()
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    if (!cachedCsrfToken) await fetchCsrfToken()
    if (cachedCsrfToken) headers.set('X-CSRF-Token', cachedCsrfToken)
    if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, { ...options, headers, credentials: 'include' })

  if (!res.ok) {
    if (res.status === 403) {
      cachedCsrfToken = null
    }
    if (
      res.status === 401 &&
      endpoint !== '/auth/login' &&
      endpoint !== '/auth/register' &&
      endpoint !== '/auth/refresh'
    ) {
      try {
        const csrf = cachedCsrfToken || (await fetchCsrfToken().catch(() => ''))
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': csrf },
        })
        if (refreshRes.ok) {
          const retryRes = await fetch(url, { ...options, headers, credentials: 'include' })
          if (retryRes.ok) return (await retryRes.json()) as T
        }
      } catch {
        // refresh failed — fall through to throw
      }
    }

    let errorData: ApiError
    try {
      errorData = await res.json()
    } catch {
      errorData = { error: 'Network Error', message: `Permintaan gagal dengan status HTTP ${res.status}` }
    }
    throw errorData
  }

  return (await res.json()) as T
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  getCsrf: fetchCsrfToken,

  register: (body: { name: string; email: string; password: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  getMe: () => request<{ user: UserProfile }>('/auth/me', { method: 'GET' }),

  getHealth: () =>
    request<{ status: string; service: string; version: string; timestamp: string; uptime: number }>('/health', {
      method: 'GET',
    }),
}

// ─── Wallets ──────────────────────────────────────────────────────────────────

export const walletApi = {
  list: () => request<{ wallets: Wallet[] }>('/wallets'),

  get: (id: string) => request<{ wallet: Wallet }>(`/wallets/${id}`),

  getHistory: (id: string) => request<WalletHistoryData>(`/wallets/${id}/history`),

  create: (body: { name: string; type: WalletType; initialBalance?: number; currency?: string; description?: string }) =>
    request<{ message: string; wallet: Wallet }>('/wallets', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: { name?: string; type?: WalletType; description?: string }) =>
    request<{ message: string; wallet: Wallet }>(`/wallets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/wallets/${id}`, { method: 'DELETE' }),
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const categoryApi = {
  list: (type?: TransactionType) =>
    request<{ categories: Category[] }>(`/categories${type ? `?type=${type}` : ''}`),

  create: (body: { name: string; type: TransactionType; color?: string; icon?: string }) =>
    request<{ message: string; category: Category }>('/categories', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: { name?: string; color?: string; icon?: string }) =>
    request<{ message: string; category: Category }>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/categories/${id}`, { method: 'DELETE' }),
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface TransactionFilters {
  page?: number
  limit?: number
  walletId?: string
  categoryId?: string
  type?: TransactionType
  startDate?: string
  endDate?: string
  search?: string
  sortBy?: 'date' | 'amount' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export const transactionApi = {
  list: (filters: TransactionFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.page) params.set('page', String(filters.page))
    if (filters.limit) params.set('limit', String(filters.limit))
    if (filters.walletId) params.set('walletId', filters.walletId)
    if (filters.categoryId) params.set('categoryId', filters.categoryId)
    if (filters.type) params.set('type', filters.type)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (filters.search) params.set('search', filters.search)
    if (filters.sortBy) params.set('sortBy', filters.sortBy)
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder)
    const qs = params.toString()
    return request<{ transactions: Transaction[]; pagination: Pagination }>(
      `/transactions${qs ? `?${qs}` : ''}`
    )
  },

  get: (id: string) => request<{ transaction: Transaction }>(`/transactions/${id}`),

  create: (body: {
    walletId: string
    categoryId: string
    type: TransactionType
    amount: number
    description?: string
    date?: string
  }) =>
    request<{ message: string; transaction: Transaction; updatedWallet: Wallet }>('/transactions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (
    id: string,
    body: {
      walletId?: string
      categoryId?: string
      type?: TransactionType
      amount?: number
      description?: string
      date?: string
    }
  ) =>
    request<{ message: string; transaction: Transaction; updatedWallet: Wallet }>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<{ message: string; updatedWallet: Wallet }>(`/transactions/${id}`, { method: 'DELETE' }),
}

// ─── Finance ──────────────────────────────────────────────────────────────────

export const financeApi = {
  summary: () => request<{ summary: FinanceSummary }>('/finance/summary'),

  dashboard: (filters: DashboardFilters = {}, options: RequestInit = {}) => {
    const params = new URLSearchParams()
    if (filters.period) params.set('period', filters.period)
    if (filters.range) params.set('range', filters.range)
    const qs = params.toString()
    return request<DashboardAnalytics>(`/finance/dashboard${qs ? `?${qs}` : ''}`, options)
  },

  getAnalytics: (filters: DashboardFilters = {}, options: RequestInit = {}) => {
    const params = new URLSearchParams()
    if (filters.period) params.set('period', filters.period)
    if (filters.range) params.set('range', filters.range)
    const qs = params.toString()
    return request<DashboardAnalytics>(`/finance/dashboard${qs ? `?${qs}` : ''}`, options)
  },
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export const budgetApi = {
  list: (period?: string) =>
    request<{ period: string; summary: BudgetSummary; budgets: Budget[] }>(
      `/budgets${period ? `?period=${encodeURIComponent(period)}` : ''}`
    ),

  summary: (period?: string) =>
    request<{ summary: BudgetSummary }>(
      `/budgets/summary${period ? `?period=${encodeURIComponent(period)}` : ''}`
    ),

  get: (id: string) =>
    request<{ budget: BudgetDetail }>(`/budgets/${id}`),

  create: (body: { categoryId: string; period: string; amount: number }) =>
    request<{ message: string; budget: Budget }>('/budgets', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: { amount: number }) =>
    request<{ message: string; budget: Budget }>(`/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/budgets/${id}`, { method: 'DELETE' }),
}

// ─── Transfers ────────────────────────────────────────────────────────────────

export interface TransferFilters {
  page?: number
  limit?: number
  walletId?: string
  status?: 'COMPLETED' | 'CANCELLED' | 'ALL'
  startDate?: string
  endDate?: string
}

export const transferApi = {
  list: (filters: TransferFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.page) params.set('page', String(filters.page))
    if (filters.limit) params.set('limit', String(filters.limit))
    if (filters.walletId) params.set('walletId', filters.walletId)
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    const qs = params.toString()
    return request<{ transfers: Transfer[]; pagination: Pagination }>(
      `/transfers${qs ? `?${qs}` : ''}`
    )
  },

  get: (id: string) => request<{ transfer: Transfer }>(`/transfers/${id}`),

  create: (body: CreateTransferPayload) =>
    request<{
      message: string
      transfer: Transfer
      balances: {
        fromWallet: { id: string; name: string; balance: string }
        toWallet: { id: string; name: string; balance: string }
      }
    }>('/transfers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  cancel: (id: string) =>
    request<{
      message: string
      transfer: { id: string; status: TransferStatus; cancelledAt: string }
      balances: {
        fromWallet: { id: string; name: string; balance: string }
        toWallet: { id: string; name: string; balance: string }
      }
    }>(`/transfers/${id}/cancel`, {
      method: 'POST',
    }),
}

// ─── Financial Goals ─────────────────────────────────────────────────────────

export const goalApi = {
  list: () =>
    request<{ goals: FinancialGoal[]; summary: GoalsSummary }>('/goals'),

  get: (id: string) =>
    request<{ goal: FinancialGoal }>(`/goals/${id}`),

  create: (body: {
    name: string
    targetAmount: number
    currentAmount?: number
    category?: string | null
    deadline?: string | null
    color?: string | null
    notes?: string | null
  }) =>
    request<{ message: string; goal: FinancialGoal }>('/goals', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (
    id: string,
    body: {
      name?: string
      targetAmount?: number
      currentAmount?: number
      category?: string | null
      deadline?: string | null
      color?: string | null
      notes?: string | null
    }
  ) =>
    request<{ message: string; goal: FinancialGoal }>(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/goals/${id}`, { method: 'DELETE' }),

  deposit: (id: string, amount: number) =>
    request<{ message: string; goal: FinancialGoal }>(`/goals/${id}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  batchImport: (goals: Array<{
    name: string
    targetAmount: number
    currentAmount?: number
    category?: string | null
    deadline?: string | null
    color?: string | null
    notes?: string | null
  }>) =>
    request<{ message: string; importedCount: number; skippedCount: number }>('/goals/batch-import', {
      method: 'POST',
      body: JSON.stringify({ goals }),
    }),
}

// ─── Recurring Transactions ──────────────────────────────────────────────────

export const recurringApi = {
  list: () =>
    request<{ recurring: RecurringTransaction[]; summary: RecurringSummary }>('/recurring-transactions'),

  get: (id: string) =>
    request<{ recurring: RecurringTransaction }>(`/recurring-transactions/${id}`),

  create: (body: {
    walletId: string
    categoryId: string
    type: TransactionType
    amount: number
    description?: string | null
    frequency: RecurringFrequency
    startDate: string
    endDate?: string | null
    isActive?: boolean
  }) =>
    request<{ message: string; recurring: RecurringTransaction }>('/recurring-transactions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (
    id: string,
    body: {
      walletId?: string
      categoryId?: string
      type?: TransactionType
      amount?: number
      description?: string | null
      frequency?: RecurringFrequency
      startDate?: string
      endDate?: string | null
      isActive?: boolean
    }
  ) =>
    request<{ message: string; recurring: RecurringTransaction }>(`/recurring-transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  toggle: (id: string, isActive?: boolean) =>
    request<{ message: string; recurring: RecurringTransaction }>(`/recurring-transactions/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/recurring-transactions/${id}`, { method: 'DELETE' }),

  process: () =>
    request<{
      message: string
      processedCount: number
      results: Array<{ id: string; description: string | null; amount: number; status: string }>
    }>('/recurring-transactions/process', {
      method: 'POST',
    }),
}

// ─── Financial Reports & Export ──────────────────────────────────────────────

export interface ReportFilters {
  periodType?: ReportPeriodType
  year?: number
  month?: number
  startDate?: string
  endDate?: string
  walletId?: string
  categoryId?: string
  type?: TransactionType
  page?: number
  limit?: number
}

export const reportApi = {
  getAnalytics: (filters: ReportFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.periodType) params.set('periodType', filters.periodType)
    if (filters.year) params.set('year', String(filters.year))
    if (filters.month) params.set('month', String(filters.month))
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (filters.walletId) params.set('walletId', filters.walletId)
    if (filters.categoryId) params.set('categoryId', filters.categoryId)
    if (filters.type) params.set('type', filters.type)
    if (filters.page) params.set('page', String(filters.page))
    if (filters.limit) params.set('limit', String(filters.limit))

    const qs = params.toString()
    return request<FinancialReportData>(`/reports/analytics${qs ? `?${qs}` : ''}`)
  },

  downloadCsv: async (filters: ReportFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.periodType) params.set('periodType', filters.periodType)
    if (filters.year) params.set('year', String(filters.year))
    if (filters.month) params.set('month', String(filters.month))
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (filters.walletId) params.set('walletId', filters.walletId)
    if (filters.categoryId) params.set('categoryId', filters.categoryId)
    if (filters.type) params.set('type', filters.type)

    const qs = params.toString()
    const url = `${API_BASE_URL}/reports/export/csv${qs ? `?${qs}` : ''}`

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!res.ok) {
      throw new Error('Gagal mengunduh file CSV laporan keuangan.')
    }

    const blob = await res.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `Laporan_Velora_${filters.periodType || 'monthly'}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(downloadUrl)
  },
}

// ─── User Profile & Preferences (Fase 13) ───────────────────────────────────

export const userApi = {
  getProfile: () =>
    request<{ profile: UserAccountProfile }>('/user/profile'),

  updateProfile: (body: { name: string }) =>
    request<{ message: string; user: UserProfile }>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>('/user/password', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  getPreferences: () =>
    request<{ preferences: UserPreferences }>('/user/preferences'),

  updatePreferences: (body: { currencyFormat: string; compactView: boolean }) =>
    request<{ message: string; preferences: UserPreferences }>('/user/preferences', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
}

// ─── Notifications (Fase 13) ────────────────────────────────────────────────

export const notificationApi = {
  list: () =>
    request<{ notifications: NotificationItem[]; unreadCount: number }>('/notifications'),

  markAsRead: (id: string) =>
    request<{ message: string; notification: NotificationItem }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  markAllAsRead: () =>
    request<{ message: string }>('/notifications/read-all', {
      method: 'POST',
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/notifications/${id}`, {
      method: 'DELETE',
    }),
}


