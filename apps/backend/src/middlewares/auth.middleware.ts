import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/security.util.js'

export interface AuthenticatedUser {
  id: string
  email: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Check cookie first, fallback to Authorization header
  const tokenFromCookie = req.cookies?.velora_access_token
  const authHeader = req.headers.authorization
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

  const token = tokenFromCookie || tokenFromHeader

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Autentikasi diperlukan untuk mengakses sumber daya ini.'
    })
    return
  }

  const payload = verifyAccessToken(token)
  if (!payload) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token akses tidak valid atau telah kedaluwarsa.'
    })
    return
  }

  req.user = {
    id: payload.userId,
    email: payload.email
  }

  next()
}
