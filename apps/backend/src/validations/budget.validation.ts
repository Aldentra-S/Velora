import { z } from 'zod'

// Strictly validates YYYY-MM with months 01-12
export const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/

export const createBudgetSchema = z.object({
  categoryId: z
    .string({ required_error: 'Kategori wajib dipilih' })
    .uuid('ID Kategori tidak valid'),
  period: z
    .string({ required_error: 'Periode anggaran wajib diisi' })
    .regex(periodRegex, 'Format periode tidak valid. Gunakan format YYYY-MM (contoh: 2026-10)'),
  amount: z
    .number({
      required_error: 'Nominal batas anggaran wajib diisi',
      invalid_type_error: 'Nominal batas anggaran harus berupa angka'
    })
    .positive('Nominal batas anggaran harus lebih besar dari 0')
})

export const updateBudgetSchema = z.object({
  amount: z
    .number({
      required_error: 'Nominal batas anggaran wajib diisi',
      invalid_type_error: 'Nominal batas anggaran harus berupa angka'
    })
    .positive('Nominal batas anggaran harus lebih besar dari 0')
})

export const budgetQuerySchema = z.object({
  period: z
    .string()
    .regex(periodRegex, 'Format periode tidak valid. Gunakan format YYYY-MM (contoh: 2026-10)')
    .optional()
})

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>
export type BudgetQueryInput = z.infer<typeof budgetQuerySchema>
