import { Request, Response } from 'express'
import { Prisma, TransactionType } from '@prisma/client'
import { prisma } from '../config/db.js'
import { createCategorySchema, updateCategorySchema } from '../validations/finance.validation.js'

export async function getCategories(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Autentikasi diperlukan.'
    })
    return
  }

  const userId = req.user.id
  const typeQuery = req.query.type as string | undefined

  try {
    const whereClause: Prisma.CategoryWhereInput = { userId }
    if (typeQuery === TransactionType.INCOME || typeQuery === TransactionType.EXPENSE) {
      whereClause.type = typeQuery
    }

    const categories = await prisma.category.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { transactions: true }
        }
      }
    })

    res.status(200).json({ categories })
  } catch (error) {
    console.error('[GetCategories Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat kategori.'
    })
  }
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Autentikasi diperlukan.'
    })
    return
  }

  const userId = req.user.id
  const validation = createCategorySchema.safeParse(req.body)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data kategori tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { name, type, color, icon } = validation.data

  try {
    const category = await prisma.category.create({
      data: {
        userId,
        name,
        type,
        color,
        icon
      }
    })

    res.status(201).json({
      message: 'Kategori berhasil ditambahkan.',
      category
    })
  } catch (error) {
    console.error('[CreateCategory Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal menambahkan kategori.'
    })
  }
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Autentikasi diperlukan.'
    })
    return
  }

  const userId = req.user.id
  const { id } = req.params

  const validation = updateCategorySchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data pembaruan kategori tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  try {
    const existingCategory = await prisma.category.findFirst({
      where: { id, userId }
    })

    if (!existingCategory) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Kategori tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: validation.data
    })

    res.status(200).json({
      message: 'Kategori berhasil diperbarui.',
      category: updatedCategory
    })
  } catch (error) {
    console.error('[UpdateCategory Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memperbarui kategori.'
    })
  }
}

export async function deleteCategory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Autentikasi diperlukan.'
    })
    return
  }

  const userId = req.user.id
  const { id } = req.params

  try {
    const existingCategory = await prisma.category.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { transactions: true, budgets: true }
        }
      }
    })

    if (!existingCategory) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Kategori tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    if (existingCategory._count.transactions > 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Kategori tidak dapat dihapus karena masih digunakan oleh transaksi yang tercatat.'
      })
      return
    }

    if (existingCategory._count.budgets > 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Kategori tidak dapat dihapus karena masih memiliki anggaran aktif yang terhubung. Hapus anggaran terkait terlebih dahulu.'
      })
      return
    }

    await prisma.category.delete({
      where: { id }
    })

    res.status(200).json({
      message: 'Kategori berhasil dihapus.'
    })
  } catch (error) {
    console.error('[DeleteCategory Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal menghapus kategori.'
    })
  }
}
