import { AuthenticatedUser } from '../middlewares/auth.middleware.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

export {}
