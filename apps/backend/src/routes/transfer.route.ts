import { Router } from 'express'
import {
  createTransfer,
  getTransfers,
  getTransferById,
  cancelTransfer
} from '../controllers/transfer.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { csrfProtection } from '../middlewares/csrf.middleware.js'

export const transferRouter = Router()

// All transfer routes require authenticated user
transferRouter.use(authenticate)

transferRouter.get('/', getTransfers)
transferRouter.get('/:id', getTransferById)
transferRouter.post('/', csrfProtection, createTransfer)
transferRouter.post('/:id/cancel', csrfProtection, cancelTransfer)
transferRouter.delete('/:id', csrfProtection, cancelTransfer)
