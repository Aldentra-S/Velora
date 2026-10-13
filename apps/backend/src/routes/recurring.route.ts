import { Router } from 'express'
import {
  getRecurringTransactions,
  getRecurringById,
  createRecurring,
  updateRecurring,
  toggleRecurring,
  deleteRecurring,
  processDueRecurring
} from '../controllers/recurring.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { csrfProtection } from '../middlewares/csrf.middleware.js'

export const recurringRouter = Router()

recurringRouter.use(authenticate)

recurringRouter.get('/', getRecurringTransactions)
recurringRouter.get('/:id', getRecurringById)
recurringRouter.post('/', csrfProtection, createRecurring)
recurringRouter.put('/:id', csrfProtection, updateRecurring)
recurringRouter.patch('/:id/toggle', csrfProtection, toggleRecurring)
recurringRouter.delete('/:id', csrfProtection, deleteRecurring)
recurringRouter.post('/process', csrfProtection, processDueRecurring)
recurringRouter.post('/process-due', csrfProtection, processDueRecurring)
