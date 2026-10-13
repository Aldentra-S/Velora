import { z } from 'zod'

export const walletTypeEnum = z.enum([
  'CASH',
  'BANK',
  'E_WALLET',
  'INVESTMENT',
  'OTHER'
])

export const transactionTypeEnum = z.enum(['INCOME', 'EXPENSE'])

export const createWalletSchema = z.object({
  name: z
    .string({ required_error: 'Nama dompet wajib diisi' })
    .trim()
    .min(2, 'Nama dompet minimal 2 karakter')
    .max(50, 'Nama dompet maksimal 50 karakter'),
  type: walletTypeEnum.default('CASH'),
  initialBalance: z
    .number({ invalid_type_error: 'Saldo awal harus berupa angka' })
    .min(0, 'Saldo awal tidak boleh negatif')
    .default(0),
  currency: z.string().trim().default('IDR'),
  description: z.string().trim().max(255, 'Deskripsi maksimal 255 karakter').optional().nullable()
})

export const updateWalletSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama dompet minimal 2 karakter')
    .max(50, 'Nama dompet maksimal 50 karakter')
    .optional(),
  type: walletTypeEnum.optional(),
  description: z.string().trim().max(255, 'Deskripsi maksimal 255 karakter').optional().nullable()
})

export const createCategorySchema = z.object({
  name: z
    .string({ required_error: 'Nama kategori wajib diisi' })
    .trim()
    .min(2, 'Nama kategori minimal 2 karakter')
    .max(50, 'Nama kategori maksimal 50 karakter'),
  type: transactionTypeEnum,
  color: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Format warna harus hex (contoh: #10b981)').optional(),
  icon: z.string().trim().max(30).optional()
})

export const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama kategori minimal 2 karakter')
    .max(50, 'Nama kategori maksimal 50 karakter')
    .optional(),
  color: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Format warna harus hex').optional(),
  icon: z.string().trim().max(30).optional()
})

export const createTransactionSchema = z.object({
  walletId: z.string({ required_error: 'Dompet wajib dipilih' }).uuid('ID Dompet tidak valid'),
  categoryId: z.string({ required_error: 'Kategori wajib dipilih' }).uuid('ID Kategori tidak valid'),
  type: transactionTypeEnum,
  amount: z
    .number({ required_error: 'Nominal transaksi wajib diisi' })
    .positive('Nominal transaksi harus lebih besar dari 0'),
  description: z.string().trim().max(255, 'Deskripsi maksimal 255 karakter').optional(),
  date: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'Format tanggal tidak valid' })
    .optional()
    .default(() => new Date().toISOString())
})

export const updateTransactionSchema = z.object({
  walletId: z.string().uuid('ID Dompet tidak valid').optional(),
  categoryId: z.string().uuid('ID Kategori tidak valid').optional(),
  type: transactionTypeEnum.optional(),
  amount: z.number().positive('Nominal transaksi harus lebih besar dari 0').optional(),
  description: z.string().trim().max(255).optional(),
  date: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'Format tanggal tidak valid' })
    .optional()
})

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  walletId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: transactionTypeEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['date', 'amount', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/

export const dashboardQuerySchema = z.object({
  period: z
    .string()
    .regex(periodRegex, 'Format periode tidak valid. Gunakan format YYYY-MM (contoh: 2026-10)')
    .optional(),
  range: z.enum(['month', '3m', '6m', '12m']).default('month')
})

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>

