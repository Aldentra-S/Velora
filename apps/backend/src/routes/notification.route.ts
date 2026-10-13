import { Router } from 'express'
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../controllers/notification.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { csrfProtection } from '../middlewares/csrf.middleware.js'

export const notificationRouter = Router()

// All notification routes require active authentication
notificationRouter.use(authenticate)

notificationRouter.get('/', getNotifications)
notificationRouter.patch('/:id/read', csrfProtection, markAsRead)
notificationRouter.post('/read-all', csrfProtection, markAllAsRead)
notificationRouter.delete('/:id', csrfProtection, deleteNotification)
