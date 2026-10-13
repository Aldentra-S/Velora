import { Router } from 'express'
import {
  getCsrfToken,
  register,
  login,
  refreshTokenHandler,
  logout,
  getMe
} from '../controllers/auth.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { csrfProtection } from '../middlewares/csrf.middleware.js'
import { authRateLimiter } from '../middlewares/rateLimit.middleware.js'

export const authRouter = Router()

// Public bootstrap endpoint to fetch/initialize CSRF token
authRouter.get('/csrf', getCsrfToken)

// Auth actions (Protected by CSRF and Rate Limiting)
authRouter.post('/register', authRateLimiter, csrfProtection, register)
authRouter.post('/login', authRateLimiter, csrfProtection, login)
authRouter.post('/logout', csrfProtection, logout)
authRouter.post('/refresh', csrfProtection, refreshTokenHandler)

// Protected user profile
authRouter.get('/me', authenticate, getMe)
