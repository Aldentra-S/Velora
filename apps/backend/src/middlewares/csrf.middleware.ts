import { Request, Response, NextFunction } from 'express'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Allow safe methods (GET, HEAD, OPTIONS)
  if (SAFE_METHODS.has(req.method)) {
    return next()
  }

  const cookieCsrf = req.cookies?.velora_csrf
  const headerCsrf = req.headers['x-csrf-token'] as string | undefined

  if (!cookieCsrf || !headerCsrf || cookieCsrf !== headerCsrf) {
    res.status(403).json({
      error: 'CSRF Forbidden',
      message: 'Token CSRF tidak valid atau tidak disertakan.'
    })
    return
  }

  next()
}
