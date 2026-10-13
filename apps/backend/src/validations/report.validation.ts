import { z } from 'zod'
import { transactionTypeEnum } from './finance.validation.js'

export const reportPeriodTypeEnum = z.enum(['monthly', 'yearly', 'custom'])

export const reportQuerySchema = z.object({
  periodType: reportPeriodTypeEnum.default('monthly'),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  walletId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: transactionTypeEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50)
})

export type ReportQueryInput = z.infer<typeof reportQuerySchema>
