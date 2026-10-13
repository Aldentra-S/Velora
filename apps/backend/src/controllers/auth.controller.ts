import { Request, Response } from 'express'
import { prisma } from '../config/db.js'
import { env } from '../config/env.js'
import { registerSchema, loginSchema } from '../validations/auth.validation.js'
import {
  hashPassword,
  comparePassword,
  generateRefreshToken,
  hashRefreshToken,
  generateAccessToken,
  generateCsrfToken
} from '../utils/security.util.js'

const isProduction = env.NODE_ENV === 'production'

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 15 * 60 * 1000 // 15 menit
}

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 hari
}

const CLEAR_ACCESS_COOKIE = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/'
}

const CLEAR_REFRESH_COOKIE = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/api/auth'
}

const CSRF_COOKIE_OPTIONS = {
  httpOnly: false, // Frontend JS needs to read or receive this token
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000
}

export async function getCsrfToken(req: Request, res: Response): Promise<void> {
  const existingCsrf = req.cookies?.velora_csrf
  const csrfToken = existingCsrf || generateCsrfToken()

  res.cookie('velora_csrf', csrfToken, CSRF_COOKIE_OPTIONS)
  res.status(200).json({ csrfToken })
}

export async function register(req: Request, res: Response): Promise<void> {
  const validation = registerSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data registrasi tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { name, email, password } = validation.data

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      res.status(409).json({
        error: 'Conflict',
        message: 'Email sudah terdaftar. Silakan gunakan email lain atau masuk.'
      })
      return
    }

    const passwordHash = await hashPassword(password)

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // Issue refresh token
    const rawRefreshToken = generateRefreshToken()
    const tokenHash = hashRefreshToken(rawRefreshToken)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: newUser.id,
        expiresAt
      }
    })

    // Issue access token
    const accessToken = generateAccessToken({
      userId: newUser.id,
      email: newUser.email
    })

    // Set secure cookies
    res.cookie('velora_access_token', accessToken, ACCESS_COOKIE_OPTIONS)
    res.cookie('velora_refresh_token', rawRefreshToken, REFRESH_COOKIE_OPTIONS)

    res.status(201).json({
      message: 'Registrasi berhasil.',
      user: newUser
    })
  } catch (error) {
    console.error('[Register Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Terjadi kesalahan pada server saat memproses registrasi.'
    })
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const validation = loginSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data login tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { email, password } = validation.data

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user || !user.passwordHash) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Email atau password salah.'
      })
      return
    }

    const isPasswordMatch = await comparePassword(password, user.passwordHash)
    if (!isPasswordMatch) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Email atau password salah.'
      })
      return
    }

    // Issue refresh token
    const rawRefreshToken = generateRefreshToken()
    const tokenHash = hashRefreshToken(rawRefreshToken)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt
      }
    })

    // Issue access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email
    })

    // Set secure cookies
    res.cookie('velora_access_token', accessToken, ACCESS_COOKIE_OPTIONS)
    res.cookie('velora_refresh_token', rawRefreshToken, REFRESH_COOKIE_OPTIONS)

    res.status(200).json({
      message: 'Login berhasil.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    })
  } catch (error) {
    console.error('[Login Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Terjadi kesalahan pada server saat memproses login.'
    })
  }
}

export async function refreshTokenHandler(req: Request, res: Response): Promise<void> {
  const rawRefreshToken = req.cookies?.velora_refresh_token

  if (!rawRefreshToken) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Refresh token tidak ditemukan.'
    })
    return
  }

  try {
    const tokenHash = hashRefreshToken(rawRefreshToken)

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    })

    // If token not found or already revoked, potential token reuse attempt!
    if (!tokenRecord || tokenRecord.revokedAt !== null) {
      if (tokenRecord?.userId) {
        // Revoke all tokens for this user as a safeguard against stolen tokens
        await prisma.refreshToken.updateMany({
          where: { userId: tokenRecord.userId },
          data: { revokedAt: new Date() }
        })
      }

      res.clearCookie('velora_access_token', CLEAR_ACCESS_COOKIE)
      res.clearCookie('velora_refresh_token', CLEAR_REFRESH_COOKIE)

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token tidak valid atau telah dicabut.'
      })
      return
    }

    // Check expiration
    if (tokenRecord.expiresAt < new Date()) {
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() }
      })

      res.clearCookie('velora_access_token', CLEAR_ACCESS_COOKIE)
      res.clearCookie('velora_refresh_token', CLEAR_REFRESH_COOKIE)

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token telah kedaluwarsa.'
      })
      return
    }

    // ROTATION: Revoke current refresh token
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() }
    })

    // Issue NEW refresh token
    const newRawRefreshToken = generateRefreshToken()
    const newTokenHash = hashRefreshToken(newRawRefreshToken)
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        userId: tokenRecord.userId,
        expiresAt: newExpiresAt
      }
    })

    // Issue NEW access token
    const newAccessToken = generateAccessToken({
      userId: tokenRecord.user.id,
      email: tokenRecord.user.email
    })

    // Set updated cookies
    res.cookie('velora_access_token', newAccessToken, ACCESS_COOKIE_OPTIONS)
    res.cookie('velora_refresh_token', newRawRefreshToken, REFRESH_COOKIE_OPTIONS)

    res.status(200).json({
      message: 'Token berhasil diperbarui.',
      user: {
        id: tokenRecord.user.id,
        name: tokenRecord.user.name,
        email: tokenRecord.user.email,
        createdAt: tokenRecord.user.createdAt,
        updatedAt: tokenRecord.user.updatedAt
      }
    })
  } catch (error) {
    console.error('[Refresh Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Terjadi kesalahan pada server saat memperbarui sesi.'
    })
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const rawRefreshToken = req.cookies?.velora_refresh_token

  if (rawRefreshToken) {
    try {
      const tokenHash = hashRefreshToken(rawRefreshToken)
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    } catch (error) {
      console.error('[Logout Revoke Warning]:', error)
    }
  }

  res.clearCookie('velora_access_token', CLEAR_ACCESS_COOKIE)
  res.clearCookie('velora_refresh_token', CLEAR_REFRESH_COOKIE)

  res.status(200).json({
    message: 'Logout berhasil. Sesi telah dicabut.'
  })
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Pengguna tidak terautentikasi.'
    })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Pengguna tidak ditemukan.'
      })
      return
    }

    res.status(200).json({ user })
  } catch (error) {
    console.error('[GetMe Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Terjadi kesalahan pada server saat mengambil data profil.'
    })
  }
}
