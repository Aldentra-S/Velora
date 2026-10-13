import { Router } from 'express'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/category.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { csrfProtection } from '../middlewares/csrf.middleware.js'

export const categoryRouter = Router()

// All category routes require authenticated user
categoryRouter.use(authenticate)

categoryRouter.get('/', getCategories)
categoryRouter.post('/', csrfProtection, createCategory)
categoryRouter.put('/:id', csrfProtection, updateCategory)
categoryRouter.delete('/:id', csrfProtection, deleteCategory)
