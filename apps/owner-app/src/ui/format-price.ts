// INFORMATIONAL is not a guaranteed quote or a FROM price. Keep that distinction visible.
export function formatPrice(amount: string, currency: string): string {
  try { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount)); }
  catch { return `${amount} ${currency}`; }
}
