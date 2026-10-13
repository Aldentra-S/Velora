import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/db.js'
import {
  createGoalSchema,
  updateGoalSchema,
  depositGoalSchema,
  batchImportGoalsSchema
} from '../validations/goal.validation.js'

export async function getGoals(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id

  try {
    const goals = await prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    let totalTarget = new Prisma.Decimal(0)
    let totalSaved = new Prisma.Decimal(0)
    let completedCount = 0

    goals.forEach((g) => {
      totalTarget = totalTarget.plus(g.targetAmount)
      totalSaved = totalSaved.plus(g.currentAmount)
      if (g.currentAmount.greaterThanOrEqualTo(g.targetAmount)) {
        completedCount++
      }
    })

    const overallPct = totalTarget.isZero()
      ? 0
      : Math.min(Math.round(totalSaved.dividedBy(totalTarget).toNumber() * 100), 100)

    res.status(200).json({
      goals,
      summary: {
        totalGoals: goals.length,
        completedCount,
        activeCount: goals.length - completedCount,
        totalTarget: totalTarget.toNumber(),
        totalSaved: totalSaved.toNumber(),
        overallPct
      }
    })
  } catch (error) {
    console.error('[GetGoals Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat target keuangan.'
    })
  }
}

export async function getGoalById(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const goal = await prisma.goal.findFirst({
      where: { id, userId }
    })

    if (!goal) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Target keuangan tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    res.status(200).json({ goal })
  } catch (error) {
    console.error('[GetGoalById Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memuat detail target keuangan.'
    })
  }
}

export async function createGoal(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = createGoalSchema.safeParse(req.body)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data target keuangan tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { name, targetAmount, currentAmount, category, deadline, color, notes } = validation.data

  try {
    const goal = await prisma.goal.create({
      data: {
        userId,
        name,
        targetAmount: new Prisma.Decimal(targetAmount),
        currentAmount: new Prisma.Decimal(currentAmount ?? 0),
        category: category ?? null,
        deadline: deadline ? new Date(deadline) : null,
        color: color ?? null,
        notes: notes ?? null
      }
    })

    res.status(201).json({
      message: 'Target keuangan berhasil dibuat.',
      goal
    })
  } catch (error) {
    console.error('[CreateGoal Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal membuat target keuangan.'
    })
  }
}

export async function updateGoal(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  const validation = updateGoalSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data pembaruan target keuangan tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  try {
    const existing = await prisma.goal.findFirst({
      where: { id, userId }
    })

    if (!existing) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Target keuangan tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    const { name, targetAmount, currentAmount, category, deadline, color, notes } = validation.data

    const updateData: Prisma.GoalUpdateInput = {}
    if (name !== undefined) updateData.name = name
    if (targetAmount !== undefined) updateData.targetAmount = new Prisma.Decimal(targetAmount)
    if (currentAmount !== undefined) updateData.currentAmount = new Prisma.Decimal(currentAmount)
    if (category !== undefined) updateData.category = category
    if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null
    if (color !== undefined) updateData.color = color
    if (notes !== undefined) updateData.notes = notes

    const updatedGoal = await prisma.goal.update({
      where: { id },
      data: updateData
    })

    res.status(200).json({
      message: 'Target keuangan berhasil diperbarui.',
      goal: updatedGoal
    })
  } catch (error) {
    console.error('[UpdateGoal Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal memperbarui target keuangan.'
    })
  }
}

export async function deleteGoal(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const existing = await prisma.goal.findFirst({
      where: { id, userId }
    })

    if (!existing) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Target keuangan tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    await prisma.goal.delete({
      where: { id }
    })

    res.status(200).json({
      message: 'Target keuangan berhasil dihapus.'
    })
  } catch (error) {
    console.error('[DeleteGoal Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal menghapus target keuangan.'
    })
  }
}

export async function depositGoal(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { id } = req.params

  const validation = depositGoalSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Nominal setoran tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { amount } = validation.data

  try {
    const existing = await prisma.goal.findFirst({
      where: { id, userId }
    })

    if (!existing) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Target keuangan tidak ditemukan atau Anda tidak memiliki akses.'
      })
      return
    }

    const updatedGoal = await prisma.goal.update({
      where: { id },
      data: {
        currentAmount: {
          increment: new Prisma.Decimal(amount)
        }
      }
    })

    res.status(200).json({
      message: 'Setoran berhasil ditambahkan.',
      goal: updatedGoal
    })
  } catch (error) {
    console.error('[DepositGoal Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal menambahkan setoran ke target keuangan.'
    })
  }
}

export async function batchImportGoals(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const validation = batchImportGoalsSchema.safeParse(req.body)

  if (!validation.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Data import tidak valid.',
      details: validation.error.flatten().fieldErrors
    })
    return
  }

  const { goals: incoming } = validation.data

  try {
    // Prevent duplicate imports: check existing goals by name
    const existingGoals = await prisma.goal.findMany({
      where: { userId },
      select: { name: true }
    })
    const existingNames = new Set(existingGoals.map((g) => g.name.trim().toLowerCase()))

    let importedCount = 0
    let skippedCount = 0

    for (const g of incoming) {
      const cleanName = g.name.trim()
      if (existingNames.has(cleanName.toLowerCase())) {
        skippedCount++
        continue
      }

      await prisma.goal.create({
        data: {
          userId,
          name: cleanName,
          targetAmount: new Prisma.Decimal(g.targetAmount),
          currentAmount: new Prisma.Decimal(g.currentAmount ?? 0),
          category: g.category ?? null,
          deadline: g.deadline ? new Date(g.deadline) : null,
          color: g.color ?? null,
          notes: g.notes ?? null
        }
      })
      existingNames.add(cleanName.toLowerCase())
      importedCount++
    }

    res.status(200).json({
      message: `Migrasi selesai: ${importedCount} target berhasil diimpor, ${skippedCount} dilewati (sudah ada).`,
      importedCount,
      skippedCount
    })
  } catch (error) {
    console.error('[BatchImportGoals Error]:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Gagal mengimpor target keuangan.'
    })
  }
}
