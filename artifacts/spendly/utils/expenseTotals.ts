import type { Expense } from '@/context/SpendingContext';
import { monthlyDailyShare } from '@/utils/monthlySpread';

function isSameMonth(dateString: string, now: Date) {
  const date = new Date(dateString);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function isToday(dateString: string, now: Date) {
  const date = new Date(dateString);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function computeSpendingTotals(
  expenses: Expense[],
  convertAmount: (amount: number, currency: string) => number,
  spreadMonthlyIntoDaily: boolean,
  referenceDate = new Date(),
) {
  const currentMonth = expenses.filter((expense) => isSameMonth(expense.date, referenceDate));
  const dailyTodayTotal = expenses
    .filter((expense) => expense.type === 'daily' && isToday(expense.date, referenceDate))
    .reduce((sum, expense) => sum + convertAmount(expense.amount, expense.currency), 0);
  const monthlyBillsTotal = currentMonth
    .filter((expense) => expense.type === 'monthly')
    .reduce((sum, expense) => sum + convertAmount(expense.amount, expense.currency), 0);
  const monthlyDailyTotal = currentMonth
    .filter((expense) => expense.type === 'daily')
    .reduce((sum, expense) => sum + convertAmount(expense.amount, expense.currency), 0);
  const monthlyDailyShareValue = monthlyDailyShare(monthlyBillsTotal, referenceDate.getFullYear(), referenceDate.getMonth());

  return {
    dailyTodayTotal,
    monthlyDailyShare: monthlyDailyShareValue,
    effectiveDailyTodayTotal: dailyTodayTotal + (spreadMonthlyIntoDaily ? monthlyDailyShareValue : 0),
    monthlyBillsTotal,
    monthlyDailyTotal,
    monthlyTotal: monthlyBillsTotal + monthlyDailyTotal,
  };
}

export function filterExpensesByTrip(expenses: Expense[], tripId: string | null) {
  if (!tripId) return expenses;
  return expenses.filter((expense) => expense.tripId === tripId);
}
