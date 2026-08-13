import type { CurrencyCode, Expense } from '@/context/SpendingContext';

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatCsvDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function buildExpensesCsv(
  expenses: Expense[],
  mainCurrency: CurrencyCode,
  convertAmount: (amount: number, currency: CurrencyCode) => number,
  tripNameById?: (tripId?: string | null) => string | undefined,
) {
  const headers = [
    'Date',
    'Type',
    'Category',
    'Trip',
    'Amount',
    'Currency',
    `Amount (${mainCurrency})`,
    'Note',
    'Created At',
  ];

  const rows = [...expenses]
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .map((expense) => [
      formatCsvDate(expense.date),
      expense.type,
      expense.category,
      tripNameById?.(expense.tripId) ?? '',
      expense.amount.toString(),
      expense.currency,
      convertAmount(expense.amount, expense.currency).toString(),
      expense.note,
      expense.createdAt,
    ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n');
}
