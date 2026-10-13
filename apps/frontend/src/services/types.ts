// ─── Auth ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  name: string
  email: string
  createdAt: string
  updatedAt?: string
}

export interface AuthResponse {
  message: string
  user: UserProfile
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export type WalletType = 'CASH' | 'BANK' | 'E_WALLET' | 'INVESTMENT' | 'OTHER'

export interface Wallet {
  id: string
  userId: string
  name: string
  type: WalletType
  balance: string
  currency: string
  description?: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    transactions: number
    transfersFrom?: number
    transfersTo?: number
    recurringTransactions?: number
  }
}

export interface WalletSummary {
  id: string
  name: string
  type: WalletType
  balance: string
  currency: string
}

// ─── Category ─────────────────────────────────────────────────────────────────

export type TransactionType = 'INCOME' | 'EXPENSE'

export interface Category {
  id: string
  userId: string
  name: string
  type: TransactionType
  color?: string | null
  icon?: string | null
  createdAt: string
  updatedAt: string
  _count?: { transactions: number }
}

// ─── Transaction ──────────────────────────────────────────────────────────────

export interface TransactionWallet {
  id: string
  name: string
  type: WalletType
  currency: string
}

export interface TransactionCategory {
  id: string
  name: string
  type: TransactionType
  color?: string | null
  icon?: string | null
}

export interface Transaction {
  id: string
  userId: string
  walletId: string
  categoryId: string
  type: TransactionType
  amount: string
  description?: string | null
  date: string
  createdAt: string
  updatedAt: string
  wallet: TransactionWallet
  category: TransactionCategory
}

export interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Finance Summary & Dashboard Analytics ───────────────────────────────────

export interface FinanceSummary {
  totalBalance: string
  totalIncome: string
  totalExpense: string
  netCashflow: string
  currentMonth: {
    income: string
    expense: string
    cashflow: string
    period: string
  }
  walletCount: number
  wallets: WalletSummary[]
}

export interface PreviousPeriodSummary {
  period: string
  income: string
  expense: string
  cashflow: string
  incomeChangePct: number
  expenseChangePct: number
}

export interface DashboardSummary {
  totalBalance: string
  periodIncome: string
  periodExpense: string
  periodCashflow: string
  previousPeriod: PreviousPeriodSummary
  walletCount: number
  wallets: WalletSummary[]
}

export interface CashflowPoint {
  label: string
  income: string
  expense: string
}

export interface CategorySpending {
  categoryId: string
  name: string
  color: string
  icon?: string | null
  total: string
  percentage: number
}

export interface DashboardBudgetItem {
  id: string
  categoryId: string
  name: string
  color?: string | null
  icon?: string | null
  limit: string
  spent: string
  remaining: string
  percentage: number
  status: BudgetStatus
}

export interface DashboardBudgetOverview {
  hasBudgets: boolean
  totalLimit: string
  totalSpent: string
  totalRemaining: string
  percentage: number
  status: BudgetStatus
  budgetCount: number
  exceededCount: number
  warningCount: number
  budgets: DashboardBudgetItem[]
}

export interface DashboardActivity {
  id: string
  activityType: 'TRANSACTION' | 'TRANSFER'
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  title: string
  amount: string
  walletName: string
  categoryName: string
  categoryColor: string
  status: TransferStatus | null
  date: string
}

export interface DashboardAnalytics {
  period: string
  range: 'month' | '3m' | '6m' | '12m'
  summary: DashboardSummary
  cashflowSeries: CashflowPoint[]
  categoryBreakdown: CategorySpending[]
  budgetOverview: DashboardBudgetOverview
  recentActivities: DashboardActivity[]
}

export interface DashboardFilters {
  period?: string
  range?: 'month' | '3m' | '6m' | '12m'
}

// ─── Budget ──────────────────────────────────────────────────────────────────

export type BudgetStatus = 'NORMAL' | 'WARNING' | 'EXCEEDED'

export interface Budget {
  id: string
  categoryId: string
  period: string
  amount: string
  spent: string
  remaining: string
  percentage: number
  status: BudgetStatus
  createdAt: string
  updatedAt: string
  category: {
    id: string
    name: string
    color?: string | null
    icon?: string | null
    type: TransactionType
  }
}

export interface BudgetSummary {
  period: string
  totalLimit: string
  totalSpent: string
  totalRemaining: string
  percentage: number
  budgetCount: number
}

export interface BudgetDetail extends Budget {
  transactions: Transaction[]
}

// ─── Transfer ────────────────────────────────────────────────────────────────

export type TransferStatus = 'COMPLETED' | 'CANCELLED'

export interface TransferWalletInfo {
  id: string
  name: string
  type?: WalletType
  currency: string
}

export interface Transfer {
  id: string
  fromWalletId: string
  toWalletId: string
  amount: string
  notes?: string | null
  status: TransferStatus
  date: string
  cancelledAt?: string | null
  createdAt: string
  updatedAt: string
  fromWallet: TransferWalletInfo
  toWallet: TransferWalletInfo
}

export interface CreateTransferPayload {
  fromWalletId: string
  toWalletId: string
  amount: number
  notes?: string
  date?: string
}

// ─── API Error ────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
  message: string
  details?: Record<string, string[]>
}

// ─── Financial Goals ─────────────────────────────────────────────────────────

export interface FinancialGoal {
  id: string
  userId?: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline?: string | null
  color?: string | null
  category?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface GoalsSummary {
  totalGoals: number
  completedCount: number
  activeCount: number
  totalTarget: number
  totalSaved: number
  overallPct: number
}

// ─── Recurring Transactions ──────────────────────────────────────────────────

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface RecurringTransaction {
  id: string
  userId: string
  walletId: string
  categoryId: string
  type: TransactionType
  amount: number | string
  description?: string | null
  frequency: RecurringFrequency
  startDate: string
  endDate?: string | null
  lastProcessedDate?: string | null
  nextRunDate: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  wallet?: {
    id: string
    name: string
    type?: WalletType
    currency?: string
  }
  category?: {
    id: string
    name: string
    color?: string | null
    icon?: string | null
  }
}

export interface RecurringSummary {
  total: number
  activeCount: number
  dueCount: number
}

// ─── Financial Reports ───────────────────────────────────────────────────────

export type ReportPeriodType = 'monthly' | 'yearly' | 'custom'

export interface ReportComparison {
  prevIncome: number
  prevExpense: number
  incomeChangePct: number
  expenseChangePct: number
}

export interface ReportSummary {
  totalIncome: number
  totalExpense: number
  netCashflow: number
  savingsRate: number
  incomeCount: number
  expenseCount: number
  comparison: ReportComparison
}

export interface ReportCategoryItem {
  categoryId: string
  categoryName: string
  categoryColor: string
  categoryIcon?: string | null
  amount: number
  count: number
  percentage: number
}

export interface ReportBudgetItem {
  id: string
  categoryName: string
  limit: number
  spent: number
  percentage: number
  status: 'NORMAL' | 'WARNING' | 'EXCEEDED'
}

export interface ReportBudgetsSummary {
  totalLimit: number
  totalSpent: number
  remaining: number
  items: ReportBudgetItem[]
}

export interface FinancialReportData {
  period: {
    type: ReportPeriodType
    label: string
    startDate: string
    endDate: string
  }
  summary: ReportSummary
  categoryBreakdown: ReportCategoryItem[]
  budgetsSummary?: ReportBudgetsSummary | null
  transactions: {
    items: Transaction[]
    pagination: {
      total: number
      page: number
      limit: number
      totalPages: number
    }
  }
}

export interface WalletHistoryData {
  wallet: Wallet
  transactions: Transaction[]
  transfers: Transfer[]
}

// ─── Profile & Preferences (Fase 13) ─────────────────────────────────────────

export interface UserAccountMetrics {
  wallets: number
  transactions: number
  budgets: number
  goals: number
  recurringTransactions: number
}

export interface UserAccountProfile {
  id: string
  name: string
  email: string
  createdAt: string
  updatedAt: string
  status: 'ACTIVE' | 'SUSPENDED'
  metrics: UserAccountMetrics
  activeSessionsCount: number
}

export interface UserPreferences {
  currencyFormat: 'IDR' | 'USD' | 'EUR' | 'SGD' | 'JPY'
  compactView: boolean
  updatedAt?: string
}

// ─── Notifications (Fase 13) ────────────────────────────────────────────────

export interface NotificationItem {
  id: string
  userId: string
  title: string
  message: string
  type: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'RECURRING_DUE' | 'SYSTEM'
  link?: string | null
  isRead: boolean
  createdAt: string
}



