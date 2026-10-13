/** Format a Decimal string (from Prisma) to a locale currency string */
export function formatCurrency(value: string | number, currency = 'IDR'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

/** Short format: 1.500.000 → Rp1,5jt */
export function formatCurrencyShort(value: string | number, currency = 'IDR'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—'
  if (Math.abs(num) >= 1_000_000) {
    const short = (num / 1_000_000).toFixed(1).replace('.0', '')
    return `${currency === 'IDR' ? 'Rp' : currency}${short}jt`
  }
  if (Math.abs(num) >= 1_000) {
    const short = (num / 1_000).toFixed(1).replace('.0', '')
    return `${currency === 'IDR' ? 'Rp' : currency}${short}rb`
  }
  return formatCurrency(num, currency)
}

/** ISO date string → "12 Okt 2025" */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Month string "2025-10" → "Oktober 2025" */
export function formatMonthLabel(period: string): string {
  const [year, month] = period.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

/** Wallet type label in Indonesian */
export function walletTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CASH: 'Tunai',
    BANK: 'Bank',
    E_WALLET: 'E-Wallet',
    INVESTMENT: 'Investasi',
    OTHER: 'Lainnya',
  }
  return map[type] ?? type
}

/** Get initials for avatar */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** Build category color with fallback */
export function categoryColor(color: string | null | undefined): string {
  return color || '#9ca3af'
}

/** Clamp number between min and max */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

/** Get current year-month string: "2026-10" */
export function getCurrentPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Shift a "YYYY-MM" period by N months */
export function shiftPeriod(period: string, deltaMonths: number): string {
  const [yearStr, monthStr] = period.split('-')
  const d = new Date(Number(yearStr), Number(monthStr) - 1 + deltaMonths, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

