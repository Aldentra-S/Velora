import { z } from 'zod'

export const updateProfileSchema = z.object({
  name: z
    .string({ required_error: 'Nama wajib diisi' })
    .trim()
    .min(2, 'Nama minimal 2 karakter')
    .max(100, 'Nama maksimal 100 karakter')
})

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ required_error: 'Password saat ini wajib diisi' })
    .min(1, 'Password saat ini wajib diisi'),
  newPassword: z
    .string({ required_error: 'Password baru wajib diisi' })
    .min(8, 'Password baru minimal 8 karakter')
    .max(100, 'Password baru maksimal 100 karakter')
})

export const updatePreferencesSchema = z.object({
  currencyFormat: z.enum(['IDR', 'USD', 'EUR', 'SGD', 'JPY'], {
    errorMap: () => ({ message: 'Format mata uang harus salah satu dari: IDR, USD, EUR, SGD, JPY' })
  }),
  compactView: z.boolean()
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>
