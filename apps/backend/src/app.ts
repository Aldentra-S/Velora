import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { healthRouter } from './routes/health.route.js'
import { authRouter } from './routes/auth.route.js'
import { walletRouter } from './routes/wallet.route.js'
import { categoryRouter } from './routes/category.route.js'
import { transactionRouter } from './routes/transaction.route.js'
import { financeRouter } from './routes/finance.route.js'
import { budgetRouter } from './routes/budget.route.js'
import { transferRouter } from './routes/transfer.route.js'
import { goalRouter } from './routes/goal.route.js'
import { recurringRouter } from './routes/recurring.route.js'
import { reportRouter } from './routes/report.route.js'
import { userRouter } from './routes/user.route.js'
import { notificationRouter } from './routes/notification.route.js'
import { errorHandler, securityHeaders } from './middlewares/error.middleware.js'

export const app = express()

// Allowed CORS origins
const allowedOrigins = new Set([
  env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
])

// Global Security Headers
app.use(securityHeaders)

// CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, or server-to-server)
      if (!origin) {
        return callback(null, true)
      }

      if (allowedOrigins.has(origin)) {
        return callback(null, true)
      }

      // In development mode, permit any localhost or 127.0.0.1 Vite port
      if (
        env.NODE_ENV === 'development' &&
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true)
      }

      callback(null, false)
    },
    credentials: true
  })
)

app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// API Routes
app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/wallets', walletRouter)
app.use('/api/categories', categoryRouter)
app.use('/api/transactions', transactionRouter)
app.use('/api/finance', financeRouter)
app.use('/api/budgets', budgetRouter)
app.use('/api/transfers', transferRouter)
app.use('/api/goals', goalRouter)
app.use('/api/recurring-transactions', recurringRouter)
app.use('/api/recurring', recurringRouter)
app.use('/api/reports', reportRouter)
app.use('/api/user', userRouter)
app.use('/api/notifications', notificationRouter)

// Root fallback route
app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'Velora API',
    description: 'AI Personal Finance Backend Service',
    healthCheck: '/api/health',
    authEndpoints: '/api/auth',
    financeEndpoints: {
      wallets: '/api/wallets',
      categories: '/api/categories',
      transactions: '/api/transactions',
      summary: '/api/finance/summary',
      budgets: '/api/budgets',
      transfers: '/api/transfers',
      goals: '/api/goals',
      recurringTransactions: '/api/recurring-transactions',
      reports: '/api/reports',
      user: '/api/user',
      notifications: '/api/notifications'
    }
  })
})

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist.'
  })
})

// Central 500 & SyntaxError Handler
app.use(errorHandler)
