/** Days in the calendar month for a local Date (month is 0-indexed). */
export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Per-day share of a month's bills: total ÷ days in that month. */
export function monthlyDailyShare(monthlyBillsTotal: number, year: number, month: number) {
  if (!monthlyBillsTotal) return 0;
  const days = daysInMonth(year, month);
  return days > 0 ? monthlyBillsTotal / days : 0;
}
