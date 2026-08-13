import type { Expense } from '@/context/SpendingContext';

function expenseSearchText(expense: Expense, tripName?: string) {
  const date = new Date(expense.date);
  const dateLabel = Number.isNaN(date.getTime()) ? expense.date : date.toLocaleDateString();
  return [
    expense.category,
    expense.note,
    expense.currency,
    expense.type,
    expense.amount.toString(),
    dateLabel,
    expense.date.slice(0, 10),
    tripName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function filterExpenses(
  expenses: Expense[],
  query: string,
  tripNameById?: (tripId?: string | null) => string | undefined,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const terms = normalized.split(/\s+/).filter(Boolean);
  return expenses
    .filter((expense) => {
      const haystack = expenseSearchText(expense, tripNameById?.(expense.tripId));
      return terms.every((term) => haystack.includes(term));
    })
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

export function formatExpenseListMeta(
  expense: Expense,
  options?: { showDate?: boolean; tripName?: string | null; showTrip?: boolean },
) {
  const date = new Date(expense.date);
  const dateLabel = Number.isNaN(date.getTime())
    ? expense.date.slice(0, 10)
    : date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      });

  const tripPrefix = options?.showTrip && options.tripName ? `${options.tripName} · ` : '';

  if (options?.showDate) {
    if (expense.note) return `${tripPrefix}${dateLabel} · ${expense.note}`;
    return `${tripPrefix}${dateLabel} · ${expense.type === 'monthly' ? 'Monthly bill' : expense.category}`;
  }

  if (expense.note) return `${tripPrefix}${expense.note}`;
  if (options?.showTrip && options.tripName) {
    if (expense.type === 'monthly') return `${options.tripName} · Monthly bill`;
    return options.tripName;
  }
  if (expense.type === 'monthly') return 'Monthly bill';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
