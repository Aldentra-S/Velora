import { Router } from 'express'
import { getFinanceSummary, getDashboardAnalytics } from '../controllers/finance.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

export const financeRouter = Router()

financeRouter.use(authenticate)

financeRouter.get('/summary', getFinanceSummary)
financeRouter.get('/dashboard', getDashboardAnalytics)

