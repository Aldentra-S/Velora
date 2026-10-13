import { Router } from 'express'
import {
  getProfile,
  updateProfile,
  changePassword,
  getPreferences,
  updatePreferences
} from '../controllers/user.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { csrfProtection } from '../middlewares/csrf.middleware.js'

export const userRouter = Router()

// All user routes require active authentication
userRouter.use(authenticate)

userRouter.get('/profile', getProfile)
userRouter.put('/profile', csrfProtection, updateProfile)
userRouter.put('/password', csrfProtection, changePassword)

userRouter.get('/preferences', getPreferences)
userRouter.put('/preferences', csrfProtection, updatePreferences)
