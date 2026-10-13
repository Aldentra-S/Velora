import { Router } from 'express'
import {
  getWallets,
  getWalletById,
  getWalletHistory,
  createWallet,
  updateWallet,
  deleteWallet
} from '../controllers/wallet.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { csrfProtection } from '../middlewares/csrf.middleware.js'

export const walletRouter = Router()

// All wallet routes require authenticated user
walletRouter.use(authenticate)

walletRouter.get('/', getWallets)
walletRouter.get('/:id', getWalletById)
walletRouter.get('/:id/history', getWalletHistory)
walletRouter.post('/', csrfProtection, createWallet)
walletRouter.put('/:id', csrfProtection, updateWallet)
walletRouter.delete('/:id', csrfProtection, deleteWallet)
