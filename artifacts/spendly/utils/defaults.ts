import type { ExpenseType } from '@/context/SpendingContext';
import { DEFAULT_DAILY_CATEGORIES, DEFAULT_MONTHLY_CATEGORIES } from '@/utils/categories';

export const DEFAULT_AVAILABLE_CURRENCIES = ['USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'THB', 'MXN', 'CNY'] as const;

export type RestoreDefaultsScope = {
  categories: boolean;
  currencies: boolean;
  dailyView: boolean;
};

export function getDefaultCategories(type: ExpenseType) {
  return type === 'daily' ? [...DEFAULT_DAILY_CATEGORIES] : [...DEFAULT_MONTHLY_CATEGORIES];
}

export function getDefaultAvailableCurrencies() {
  return [...DEFAULT_AVAILABLE_CURRENCIES];
}
