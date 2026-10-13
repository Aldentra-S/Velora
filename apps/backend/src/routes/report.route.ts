import { Router } from 'express'
import { getFinancialReport, exportReportCsv } from '../controllers/report.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

export const reportRouter = Router()

reportRouter.use(authenticate)

reportRouter.get('/analytics', getFinancialReport)
reportRouter.get('/export/csv', exportReportCsv)
