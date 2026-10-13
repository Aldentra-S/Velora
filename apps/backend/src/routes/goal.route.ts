import { Router } from 'express'
import {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  depositGoal,
  batchImportGoals
} from '../controllers/goal.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { csrfProtection } from '../middlewares/csrf.middleware.js'

export const goalRouter = Router()

goalRouter.use(authenticate)

goalRouter.get('/', getGoals)
goalRouter.get('/:id', getGoalById)
goalRouter.post('/', csrfProtection, createGoal)
goalRouter.put('/:id', csrfProtection, updateGoal)
goalRouter.delete('/:id', csrfProtection, deleteGoal)
goalRouter.post('/:id/deposit', csrfProtection, depositGoal)
goalRouter.post('/batch-import', csrfProtection, batchImportGoals)
