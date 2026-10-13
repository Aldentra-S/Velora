import { Request, Response, NextFunction } from 'express'

interface RateLimitRecord {
  count: number
  resetTime: number
}

// In-memory bucket store for IP-based rate limiting
const store = new Map<string, RateLimitRecord>()

// Periodically purge expired keys to keep memory clean (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [key, record] of store.entries()) {
    if (now > record.resetTime) {
      store.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS)

// Prevent timer from keeping the Node process open in test environments
if (cleanupTimer.unref) {
  cleanupTimer.unref()
}

export interface RateLimitOptions {
  windowMs?: number // Default: 15 minutes
  max?: number // Default: 10 requests per window
  message?: string
}

/**
 * Lightweight, zero-dependency in-memory Rate Limiting Middleware
 * Protects critical endpoints (e.g. login, register) from brute-force & credential stuffing
 */
export function rateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 15 * 60 * 1000 // 15 mins
  const max = options.max ?? 10
  const message =
    options.message ??
    'Terlalu banyak percobaan. Silakan coba kembali dalam beberapa menit demi keamanan akun Anda.'

  return (req: Request, res: Response, next: NextFunction): void => {
    // Resolve client IP safely
    const forwarded = req.headers['x-forwarded-for']
    const clientIp =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) ||
      'unknown'

    const key = `${req.baseUrl || req.path}:${clientIp}`
    const now = Date.now()
    const record = store.get(key)

    if (!record || now > record.resetTime) {
      // New or expired window
      store.set(key, {
        count: 1,
        resetTime: now + windowMs
      })

      res.setHeader('X-RateLimit-Limit', max)
      res.setHeader('X-RateLimit-Remaining', max - 1)
      return next()
    }

    record.count += 1
    const remaining = Math.max(0, max - record.count)
    res.setHeader('X-RateLimit-Limit', max)
    res.setHeader('X-RateLimit-Remaining', remaining)

    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000)
      res.setHeader('Retry-After', retryAfterSeconds)
      res.status(429).json({
        error: 'Too Many Requests',
        message
      })
      return
    }

    next()
  }
}

/**
 * Pre-configured rate limiter for authentication routes
 * 10 attempts per 15 minutes per IP
 */
export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Terlalu banyak percobaan autentikasi. Silakan tunggu 15 menit sebelum mencoba kembali.'
})
