import { z } from 'zod';
import type { CurrencyCode, CurrencyOption, Expense } from '@/context/SpendingContext';
import {
  DEFAULT_DAILY_CATEGORIES,
  DEFAULT_MONTHLY_CATEGORIES,
  sanitizeCategoryList,
} from '@/utils/categories';
import { sanitizeTrips } from '@/utils/trips';

export const BACKUP_VERSION = 1;
export const BACKUP_APP_ID = 'multi-currency-spend';
const LEGACY_BACKUP_APP_ID = 'spendly';

const expenseSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['daily', 'monthly']),
  amount: z.coerce.number().finite().nonnegative(),
  currency: z.string().min(3).max(6),
  category: z.string(),
  note: z.string(),
  date: z.string(),
  createdAt: z.string(),
  tripId: z.string().nullable().optional(),
});

const tripSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string(),
});

const currencyOptionSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{3,6}$/),
  name: z.string().min(1),
  symbol: z.string().min(1),
  isCustom: z.boolean().optional(),
});

export const backupDataSchema = z.object({
  expenses: z.array(expenseSchema),
  mainCurrency: z.string().min(3).max(6),
  entryCurrency: z.string().min(3).max(6),
  availableCurrencies: z.array(z.string().min(3).max(6)),
  customCurrencies: z.array(currencyOptionSchema).default([]),
  dailyCategories: z.array(z.string()).optional(),
  monthlyCategories: z.array(z.string()).optional(),
  trips: z.array(tripSchema).optional(),
  activeTripId: z.string().nullable().optional(),
  ratesToUsd: z.record(z.string(), z.coerce.number().finite().positive()),
  lastRateUpdated: z.string().nullable().default(null),
  spreadMonthlyIntoDaily: z.boolean().default(false),
});

export const backupSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  app: z.enum([BACKUP_APP_ID, LEGACY_BACKUP_APP_ID]),
  data: backupDataSchema,
});

export type SpendlyBackup = z.infer<typeof backupSchema>;
export type SpendlyBackupData = z.infer<typeof backupDataSchema>;

export function createBackup(data: SpendlyBackupData): SpendlyBackup {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: BACKUP_APP_ID,
    data,
  };
}

function sanitizeBackupContent(raw: string) {
  return raw.replace(/^\uFEFF/, '').trim();
}

function wrapBackupData(data: SpendlyBackupData, exportedAt?: string): SpendlyBackup {
  return {
    version: BACKUP_VERSION,
    exportedAt: exportedAt ?? new Date().toISOString(),
    app: BACKUP_APP_ID,
    data,
  };
}

function normalizeBackupJson(json: unknown): SpendlyBackup | null {
  if (!json || typeof json !== 'object') return null;
  const record = json as Record<string, unknown>;

  const wrapped = backupSchema.safeParse(json);
  if (wrapped.success) return wrapped.data;

  if (record.data && typeof record.data === 'object') {
    const data = backupDataSchema.safeParse(record.data);
    if (data.success) {
      return wrapBackupData(
        data.data,
        typeof record.exportedAt === 'string' ? record.exportedAt : undefined,
      );
    }
  }

  const flat = backupDataSchema.safeParse(json);
  if (flat.success) {
    return wrapBackupData(
      flat.data,
      typeof record.exportedAt === 'string' ? record.exportedAt : undefined,
    );
  }

  return null;
}

export function parseBackup(raw: string): { success: true; backup: SpendlyBackup } | { success: false; message: string } {
  const trimmed = sanitizeBackupContent(raw);
  if (!trimmed) {
    return { success: false, message: 'The selected file is empty.' };
  }
  if (trimmed.startsWith('<')) {
    return {
      success: false,
      message: 'This looks like a web page, not a Multi Currency Spend backup. Download the .json file first, then import it.',
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return {
      success: false,
      message: 'Could not read JSON from this file. It may be corrupted or incomplete.',
    };
  }

  const backup = normalizeBackupJson(json);
  if (backup) return { success: true, backup };

  return { success: false, message: 'This file is not a valid Multi Currency Spend backup.' };
}

export function mergeExpenses(local: Expense[], imported: Expense[]): Expense[] {
  const byId = new Map<string, Expense>();
  local.forEach((expense) => byId.set(expense.id, expense));
  imported.forEach((expense) => {
    if (!byId.has(expense.id)) byId.set(expense.id, expense);
  });
  return Array.from(byId.values()).sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function summarizeBackup(backup: SpendlyBackup) {
  const exportedAt = new Date(backup.exportedAt);
  const dateLabel = Number.isNaN(exportedAt.getTime())
    ? 'an unknown date'
    : exportedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return {
    expenseCount: backup.data.expenses.length,
    dateLabel,
  };
}

export function normalizeBackupData(data: SpendlyBackupData, fallbackRates: Record<string, number>): SpendlyBackupData {
  const customCurrencies = data.customCurrencies
    .filter((currency) => currency.isCustom)
    .map((currency) => ({ ...currency, code: currency.code.toUpperCase(), isCustom: true as const }));
  const knownCodes = new Set([
    ...customCurrencies.map((currency) => currency.code),
    ...data.availableCurrencies.map((code) => code.toUpperCase()),
    data.mainCurrency.toUpperCase(),
    data.entryCurrency.toUpperCase(),
  ]);

  const availableCurrencies = Array.from(
    new Set(data.availableCurrencies.map((code) => code.toUpperCase()).filter((code) => knownCodes.has(code))),
  );
  const mainCurrency = knownCodes.has(data.mainCurrency.toUpperCase())
    ? data.mainCurrency.toUpperCase()
    : (availableCurrencies[0] ?? 'USD');
  const entryCurrency = knownCodes.has(data.entryCurrency.toUpperCase())
    ? data.entryCurrency.toUpperCase()
    : mainCurrency;
  const trips = sanitizeTrips(data.trips);
  const tripIds = new Set(trips.map((trip) => trip.id));
  const activeTripId = data.activeTripId && tripIds.has(data.activeTripId) ? data.activeTripId : null;

  return {
    expenses: data.expenses.map((expense) => ({
      ...expense,
      currency: expense.currency.toUpperCase() as CurrencyCode,
      tripId: expense.tripId && tripIds.has(expense.tripId) ? expense.tripId : null,
    })),
    mainCurrency: mainCurrency as CurrencyCode,
    entryCurrency: entryCurrency as CurrencyCode,
    availableCurrencies: availableCurrencies as CurrencyCode[],
    customCurrencies: customCurrencies as CurrencyOption[],
    dailyCategories: sanitizeCategoryList(data.dailyCategories, DEFAULT_DAILY_CATEGORIES),
    monthlyCategories: sanitizeCategoryList(data.monthlyCategories, DEFAULT_MONTHLY_CATEGORIES),
    trips,
    activeTripId,
    ratesToUsd: { ...fallbackRates, ...data.ratesToUsd },
    lastRateUpdated: data.lastRateUpdated,
    spreadMonthlyIntoDaily: data.spreadMonthlyIntoDaily ?? false,
  };
}
