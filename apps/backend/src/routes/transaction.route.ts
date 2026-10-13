import { Router } from 'express'
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction
} from '../controllers/transaction.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { csrfProtection } from '../middlewares/csrf.middleware.js'

export const transactionRouter = Router()

// All transaction routes require authenticated user
transactionRouter.use(authenticate)

transactionRouter.get('/', getTransactions)
transactionRouter.get('/:id', getTransactionById)
transactionRouter.post('/', csrfProtection, createTransaction)
transactionRouter.put('/:id', csrfProtection, updateTransaction)
transactionRouter.delete('/:id', csrfProtection, deleteTransaction)
