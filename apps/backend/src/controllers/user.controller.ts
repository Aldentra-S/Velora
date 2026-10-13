import { Request, Response } from 'express'
import { prisma } from '../config/db.js'
import { env } from '../config/env.js'
import {
  updateProfileSchema,
  changePasswordSchema,
  updatePreferencesSchema
} from '../validations/user.validation.js'
import {
  hashPassword,
  comparePassword,
  hashRefreshToken,
  generateAccessToken,
  generateRefreshToken
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

/**
 * GET /api/user/profile
 * Retrieves full user profile information, account status, and session metrics
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Autentikasi diperlukan.' })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            wallets: true,
            transactions: true,
            budgets: true,
            goals: true,
            recurringTransactions: true
          }
        }
      }
    })

    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'Pengguna tidak ditemukan.' })
      return
    }

    // Count active unrevoked refresh tokens
    const now = new Date()
    const activeSessionsCount = await prisma.refreshToken.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now }
      }
    })

    res.status(200).json({
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        status: 'ACTIVE',
        metrics: user._count,
        activeSessionsCount: Math.max(1, activeSessionsCount)
      }
    })
  } catch (error) {
    console.error('[User Profile Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat profil pengguna.'
    })
  }
}

/**
 * PUT /api/user/profile
 * Updates user display name with strict validation
 */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Autentikasi diperlukan.' })
    return
  }

  const validation = updateProfileSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data pembaruan profil tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { name } = validation.data

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true
      }
    })

    res.status(200).json({
      message: 'Profil berhasil diperbarui.',
      user: updatedUser
    })
  } catch (error) {
    console.error('[Update Profile Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memperbarui profil pengguna.'
    })
  }
}

/**
 * PUT /api/user/password
 * Changes user password after verifying existing password
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Autentikasi diperlukan.' })
    return
  }

  const validation = changePasswordSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data pergantian password tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { currentPassword, newPassword } = validation.data

  if (currentPassword === newPassword) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Password baru tidak boleh sama dengan password saat ini.'
    })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'Pengguna tidak ditemukan.' })
      return
    }

    // Verify current password
    const isCurrentValid = await comparePassword(currentPassword, user.passwordHash)
    if (!isCurrentValid) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Password saat ini yang Anda masukkan salah.'
      })
      return
    }

    // Hash new password securely
    const newPasswordHash = await hashPassword(newPassword)

    // Generate fresh tokens for the current device/session
    const newAccessToken = generateAccessToken({ userId: user.id, email: user.email })
    const newRawRefreshToken = generateRefreshToken()
    const newRefreshTokenHash = hashRefreshToken(newRawRefreshToken)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.$transaction(async (tx) => {
      // 1. Update password
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }
      })

      // 2. Revoke ALL previous refresh tokens across all devices
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })

      // 3. Register fresh active refresh token for the current session
      await tx.refreshToken.create({
        data: {
          userId,
          tokenHash: newRefreshTokenHash,
          expiresAt
        }
      })
    })

    // 4. Set fresh session cookies on current device
    res.cookie('velora_access_token', newAccessToken, ACCESS_COOKIE_OPTIONS)
    res.cookie('velora_refresh_token', newRawRefreshToken, REFRESH_COOKIE_OPTIONS)

    res.status(200).json({
      message: 'Password berhasil diubah. Sesi perangkat lain telah dicabut demi keamanan akun Anda.',
      accessToken: newAccessToken
    })
  } catch (error) {
    console.error('[Change Password Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memperbarui password pengguna.'
    })
  }
}

/**
 * GET /api/user/preferences
 * Retrieves user interface and display preferences
 */
export async function getPreferences(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Autentikasi diperlukan.' })
    return
  }

  try {
    let pref = await prisma.userPreference.findUnique({
      where: { userId }
    })

    if (!pref) {
      // Auto-create default preferences
      pref = await prisma.userPreference.create({
        data: {
          userId,
          currencyFormat: 'IDR',
          compactView: false
        }
      })
    }

    res.status(200).json({
      preferences: {
        currencyFormat: pref.currencyFormat,
        compactView: pref.compactView,
        updatedAt: pref.updatedAt
      }
    })
  } catch (error) {
    console.error('[Get Preferences Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat preferensi pengguna.'
    })
  }
}

/**
 * PUT /api/user/preferences
 * Updates user interface and display preferences
 */
export async function updatePreferences(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Autentikasi diperlukan.' })
    return
  }

  const validation = updatePreferencesSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data preferensi tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { currencyFormat, compactView } = validation.data

  try {
    const pref = await prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        currencyFormat,
        compactView
      },
      update: {
        currencyFormat,
        compactView
      }
    })

    res.status(200).json({
      message: 'Preferensi berhasil disimpan.',
      preferences: {
        currencyFormat: pref.currencyFormat,
        compactView: pref.compactView,
        updatedAt: pref.updatedAt
      }
    })
  } catch (error) {
    console.error('[Update Preferences Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal menyimpan preferensi pengguna.'
    })
  }
}
