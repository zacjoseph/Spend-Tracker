import type { ExpenseType } from '@/context/SpendingContext';

export const DEFAULT_DAILY_CATEGORIES = ['Food', 'Transport', 'Lodging', 'Activities', 'Shopping', 'Other'];
export const DEFAULT_MONTHLY_CATEGORIES = ['Rent', 'Utilities', 'Phone', 'Subscriptions', 'Other'];
export const PROTECTED_CATEGORY = 'Other';

const DAILY_ICON_MAP: Record<string, string> = {
  Food: 'coffee',
  Transport: 'navigation',
  Lodging: 'home',
  Activities: 'map',
  Shopping: 'shopping-bag',
  Groceries: 'shopping-cart',
  Health: 'heart',
  Entertainment: 'film',
};

const MONTHLY_ICON_MAP: Record<string, string> = {
  Rent: 'home',
  Utilities: 'zap',
  Electricity: 'zap',
  Internet: 'wifi',
  Phone: 'smartphone',
  Subscriptions: 'repeat',
  Insurance: 'shield',
};

export function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

export function validateCategoryName(name: string): { success: true; name: string } | { success: false; message: string } {
  const normalized = normalizeCategoryName(name);
  if (!normalized) return { success: false, message: 'Enter a category name.' };
  if (normalized.length > 24) return { success: false, message: 'Keep category names under 24 characters.' };
  return { success: true, name: normalized };
}

export function categoriesInclude(list: string[], name: string) {
  const target = name.toLowerCase();
  return list.some((item) => item.toLowerCase() === target);
}

export function findCategoryMatch(list: string[], name: string) {
  const target = name.toLowerCase();
  return list.find((item) => item.toLowerCase() === target);
}

export function defaultCategoryForType(type: ExpenseType, dailyCategories: string[], monthlyCategories: string[]) {
  const list = type === 'daily' ? dailyCategories : monthlyCategories;
  const preferred = type === 'daily' ? 'Food' : 'Rent';
  return findCategoryMatch(list, preferred) ?? list[0] ?? PROTECTED_CATEGORY;
}

export function sanitizeCategoryList(list: unknown, fallback: string[]) {
  if (!Array.isArray(list)) return [...fallback];
  const seen = new Set<string>();
  const next: string[] = [];
  list.forEach((item) => {
    if (typeof item !== 'string') return;
    const normalized = normalizeCategoryName(item);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    next.push(normalized);
  });
  if (!categoriesInclude(next, PROTECTED_CATEGORY)) next.push(PROTECTED_CATEGORY);
  return next.length ? next : [...fallback];
}

export function getCategoryIcon(category: string, type: ExpenseType) {
  if (type === 'monthly') return MONTHLY_ICON_MAP[category] ?? 'more-horizontal';
  return DAILY_ICON_MAP[category] ?? 'circle';
}
