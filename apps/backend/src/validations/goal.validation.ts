import { z } from 'zod'

export const createGoalSchema = z.object({
  name: z
    .string({ required_error: 'Nama target wajib diisi' })
    .trim()
    .min(2, 'Nama target minimal 2 karakter')
    .max(100, 'Nama target maksimal 100 karakter'),
  targetAmount: z
    .number({ required_error: 'Nominal target wajib diisi' })
    .positive('Nominal target harus lebih besar dari 0'),
  currentAmount: z
    .number({ invalid_type_error: 'Nominal tabungan harus berupa angka' })
    .min(0, 'Nominal tabungan tidak boleh negatif')
    .default(0),
  category: z.string().trim().max(50).optional().nullable(),
  deadline: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'Format tenggat waktu tidak valid' })
    .optional()
    .nullable(),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Format warna harus hex (contoh: #6366f1)')
    .optional()
    .nullable(),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional().nullable()
})

export const updateGoalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama target minimal 2 karakter')
    .max(100, 'Nama target maksimal 100 karakter')
    .optional(),
  targetAmount: z
    .number()
    .positive('Nominal target harus lebih besar dari 0')
    .optional(),
  currentAmount: z
    .number()
    .min(0, 'Nominal tabungan tidak boleh negatif')
    .optional(),
  category: z.string().trim().max(50).optional().nullable(),
  deadline: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'Format tenggat waktu tidak valid' })
    .optional()
    .nullable(),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Format warna harus hex (contoh: #6366f1)')
    .optional()
    .nullable(),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional().nullable()
})

export const depositGoalSchema = z.object({
  amount: z
    .number({ required_error: 'Nominal setor wajib diisi' })
    .positive('Nominal setor harus lebih besar dari 0')
})

export const batchImportGoalsSchema = z.object({
  goals: z.array(
    z.object({
      name: z.string().trim().min(2).max(100),
      targetAmount: z.number().positive(),
      currentAmount: z.number().min(0).default(0),
      category: z.string().trim().max(50).optional().nullable(),
      deadline: z.string().optional().nullable(),
      color: z.string().optional().nullable(),
      notes: z.string().trim().max(500).optional().nullable()
    })
  )
})

export type CreateGoalInput = z.infer<typeof createGoalSchema>
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>
export type DepositGoalInput = z.infer<typeof depositGoalSchema>
export type BatchImportGoalsInput = z.infer<typeof batchImportGoalsSchema>
