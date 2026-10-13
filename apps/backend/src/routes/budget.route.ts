import { Router } from 'express'
import {
  getBudgets,
  getBudgetSummary,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget
} from '../controllers/budget.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { csrfProtection } from '../middlewares/csrf.middleware.js'

export const budgetRouter = Router()

// All budget routes require authenticated user
budgetRouter.use(authenticate)

budgetRouter.get('/', getBudgets)
budgetRouter.get('/summary', getBudgetSummary)
budgetRouter.get('/:id', getBudgetById)
budgetRouter.post('/', csrfProtection, createBudget)
budgetRouter.put('/:id', csrfProtection, updateBudget)
budgetRouter.delete('/:id', csrfProtection, deleteBudget)
