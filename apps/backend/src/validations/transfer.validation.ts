import { z } from 'zod'

export const createTransferSchema = z
  .object({
    fromWalletId: z
      .string({ required_error: 'Dompet asal wajib dipilih' })
      .uuid('ID Dompet asal tidak valid'),
    toWalletId: z
      .string({ required_error: 'Dompet tujuan wajib dipilih' })
      .uuid('ID Dompet tujuan tidak valid'),
    amount: z
      .number({
        required_error: 'Nominal transfer wajib diisi',
        invalid_type_error: 'Nominal transfer harus berupa angka'
      })
      .positive('Nominal transfer harus lebih besar dari 0'),
    notes: z.string().trim().max(255, 'Catatan maksimal 255 karakter').optional(),
    date: z
      .string()
      .datetime({ message: 'Format tanggal harus standar ISO 8601' })
      .optional()
  })
  .refine((data) => data.fromWalletId !== data.toWalletId, {
    message: 'Dompet asal dan dompet tujuan tidak boleh sama',
    path: ['toWalletId']
  })

export const transferQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  walletId: z.string().uuid('ID Dompet tidak valid').optional(),
  status: z.enum(['COMPLETED', 'CANCELLED', 'ALL']).default('ALL'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
})

export type CreateTransferInput = z.infer<typeof createTransferSchema>
export type TransferQueryInput = z.infer<typeof transferQuerySchema>
