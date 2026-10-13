import { z } from 'zod'
import { transactionTypeEnum } from './finance.validation.js'

export const recurringFrequencyEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY'])

export const createRecurringSchema = z.object({
  walletId: z.string({ required_error: 'Dompet wajib dipilih' }).uuid('ID Dompet tidak valid'),
  categoryId: z.string({ required_error: 'Kategori wajib dipilih' }).uuid('ID Kategori tidak valid'),
  type: transactionTypeEnum,
  amount: z
    .number({ required_error: 'Nominal transaksi wajib diisi' })
    .positive('Nominal transaksi harus lebih besar dari 0'),
  description: z.string().trim().max(255, 'Deskripsi maksimal 255 karakter').optional().nullable(),
  frequency: recurringFrequencyEnum,
  startDate: z
    .string({ required_error: 'Tanggal mulai wajib diisi' })
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'Format tanggal mulai tidak valid' }),
  endDate: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'Format tanggal akhir tidak valid' })
    .optional()
    .nullable(),
  isActive: z.boolean().optional().default(true)
})

export const updateRecurringSchema = z.object({
  walletId: z.string().uuid('ID Dompet tidak valid').optional(),
  categoryId: z.string().uuid('ID Kategori tidak valid').optional(),
  type: transactionTypeEnum.optional(),
  amount: z.number().positive('Nominal transaksi harus lebih besar dari 0').optional(),
  description: z.string().trim().max(255).optional().nullable(),
  frequency: recurringFrequencyEnum.optional(),
  startDate: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'Format tanggal mulai tidak valid' })
    .optional(),
  endDate: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'Format tanggal akhir tidak valid' })
    .optional()
    .nullable(),
  isActive: z.boolean().optional()
})

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>
