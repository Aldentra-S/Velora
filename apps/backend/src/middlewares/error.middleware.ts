import { Request, Response, NextFunction } from 'express'

/**
 * Global Error Handling Middleware
 * - Intercepts body-parser JSON syntax errors (400)
 * - Intercepts unhandled exceptions (500)
 * - Guarantees JSON response format and prevents stack trace leakage to clients
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // 1. JSON parsing syntax error from express.json()
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status: number }).status === 400 &&
    'body' in err
  ) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Format payload JSON tidak valid.'
    })
    return
  }

  // 2. Log server-side diagnostic without leaking to client
  console.error('[Unhandled Server Error]:', err instanceof Error ? err.message : err)

  // 3. Clean, safe generic error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Terjadi kesalahan pada sistem server. Silakan coba beberapa saat lagi.'
  })
}

/**
 * Standard Security Headers Middleware
 * Protects against MIME sniffing, clickjacking, and referrer leaks without third-party dependencies.
 */
export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
}
