import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createBackup,
  mergeExpenses,
  normalizeBackupData,
  parseBackup,
  type SpendlyBackup,
} from '@/utils/backup';
import { toExpenseDateString } from '@/utils/expenseDate';
import { monthlyDailyShare } from '@/utils/monthlySpread';

export type ExpenseType = 'daily' | 'monthly';

export const CURRENCY_OPTIONS = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'RF' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
] as const;

export type CurrencyCode = string;
export type CurrencyOption = {
  code: CurrencyCode;
  name: string;
  symbol: string;
  isCustom?: boolean;
};

export type AddCustomCurrencyResult = {
  success: boolean;
  message?: string;
  currency?: CurrencyOption;
  rateToUsd?: number;
};

export type Expense = {
  id: string;
  type: ExpenseType;
  amount: number;
  currency: CurrencyCode;
  category: string;
  note: string;
  date: string;
  createdAt: string;
};

type AddExpenseInput = {
  type: ExpenseType;
  amount: number;
  currency: CurrencyCode;
  category: string;
  note: string;
  date?: Date;
};

type SpendingContextValue = {
  expenses: Expense[];
  isLoaded: boolean;
  mainCurrency: CurrencyCode;
  entryCurrency: CurrencyCode;
  availableCurrencies: CurrencyCode[];
  currencyOptions: CurrencyOption[];
  ratesToUsd: Record<string, number>;
  lastRateUpdated: string | null;
  rateStatus: 'idle' | 'refreshing' | 'error';
  spreadMonthlyIntoDaily: boolean;
  dailyTodayTotal: number;
  /** This month's monthly bills ÷ days in month (home currency). */
  monthlyDailyShare: number;
  /** Cash logged today, plus monthlyDailyShare when spreading is on. */
  effectiveDailyTodayTotal: number;
  monthlyBillsTotal: number;
  monthlyDailyTotal: number;
  monthlyTotal: number;
  addExpense: (input: AddExpenseInput) => void;
  removeExpense: (id: string) => void;
  clearAllExpenses: () => void;
  setMainCurrency: (currency: CurrencyCode) => void;
  setEntryCurrency: (currency: CurrencyCode) => void;
  setSpreadMonthlyIntoDaily: (value: boolean) => void;
  addCustomCurrency: (input: { code: string; name: string }) => Promise<AddCustomCurrencyResult>;
  removeCurrency: (currency: CurrencyCode) => void;
  refreshRates: () => Promise<void>;
  createBackup: () => SpendlyBackup;
  importBackup: (backup: SpendlyBackup, mode: 'replace' | 'merge') => { success: boolean; message: string; addedCount?: number };
  convertAmount: (amount: number, currency: CurrencyCode) => number;
  formatAmount: (amount: number, currency?: CurrencyCode) => string;
  getMonthlyBillsTotalForMonth: (year: number, month: number) => number;
  getMonthlyDailyShareForMonth: (year: number, month: number) => number;
};

const STORAGE_KEY = '@spendly/data/v2';
const LEGACY_STORAGE_KEY = '@spendly/expenses/v1';
const DEFAULT_CURRENCIES: CurrencyCode[] = ['USD', 'UGX'];
const FALLBACK_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  UGX: 0.00028,
  EUR: 1.08,
  GBP: 1.27,
  KES: 0.0072,
  TZS: 0.00029,
  RWF: 0.00072,
  ZAR: 0.054,
};
const SpendingContext = createContext<SpendingContextValue | null>(null);
const RATES_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
const RATE_REFRESH_INTERVAL = 6 * 60 * 60 * 1000;

function getCurrencySymbol(code: string) {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

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

export function SpendingProvider({ children }: { children: React.ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mainCurrency, setMainCurrencyState] = useState<CurrencyCode>('USD');
  const [entryCurrency, setEntryCurrencyState] = useState<CurrencyCode>('UGX');
  const [availableCurrencies, setAvailableCurrencies] = useState<CurrencyCode[]>(DEFAULT_CURRENCIES);
  const [customCurrencies, setCustomCurrencies] = useState<CurrencyOption[]>([]);
  const [ratesToUsd, setRatesToUsd] = useState<Record<string, number>>(FALLBACK_RATES_TO_USD);
  const [lastRateUpdated, setLastRateUpdated] = useState<string | null>(null);
  const [rateStatus, setRateStatus] = useState<'idle' | 'refreshing' | 'error'>('idle');
  const [spreadMonthlyIntoDaily, setSpreadMonthlyIntoDailyState] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const customCurrenciesRef = useRef(customCurrencies);
  const ratesToUsdRef = useRef(ratesToUsd);

  useEffect(() => {
    customCurrenciesRef.current = customCurrencies;
  }, [customCurrencies]);

  useEffect(() => {
    ratesToUsdRef.current = ratesToUsd;
  }, [ratesToUsd]);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(LEGACY_STORAGE_KEY)])
      .then(([stored, legacyStored]) => {
        if (stored) {
          const parsed = JSON.parse(stored) as {
            expenses?: Expense[];
            mainCurrency?: CurrencyCode;
            entryCurrency?: CurrencyCode;
            availableCurrencies?: CurrencyCode[];
            customCurrencies?: CurrencyOption[];
            ratesToUsd?: Record<string, number>;
            lastRateUpdated?: string | null;
            spreadMonthlyIntoDaily?: boolean;
          };
          const storedCustomCurrencies = Array.isArray(parsed.customCurrencies)
            ? parsed.customCurrencies
                .filter((currency) => currency?.isCustom && /^[A-Z0-9]{3,6}$/.test(currency.code) && currency.name && currency.symbol)
                .map((currency) => ({ ...currency, code: currency.code.toUpperCase(), isCustom: true }))
            : [];
          const knownCodes = new Set([...CURRENCY_OPTIONS.map((item) => item.code), ...storedCustomCurrencies.map((item) => item.code)]);
          setCustomCurrencies(storedCustomCurrencies);
          if (Array.isArray(parsed.expenses)) setExpenses(parsed.expenses);
          if (parsed.mainCurrency && knownCodes.has(parsed.mainCurrency)) setMainCurrencyState(parsed.mainCurrency);
          if (parsed.entryCurrency && knownCodes.has(parsed.entryCurrency)) setEntryCurrencyState(parsed.entryCurrency);
          if (Array.isArray(parsed.availableCurrencies)) {
            setAvailableCurrencies(Array.from(new Set(parsed.availableCurrencies.filter((currency) => knownCodes.has(currency)))));
          }
          if (parsed.ratesToUsd) setRatesToUsd({ ...FALLBACK_RATES_TO_USD, ...parsed.ratesToUsd });
          if (parsed.lastRateUpdated) setLastRateUpdated(parsed.lastRateUpdated);
          if (typeof parsed.spreadMonthlyIntoDaily === 'boolean') {
            setSpreadMonthlyIntoDailyState(parsed.spreadMonthlyIntoDaily);
          }
        } else if (legacyStored) {
          const legacyExpenses = JSON.parse(legacyStored) as Omit<Expense, 'currency'>[];
          if (Array.isArray(legacyExpenses)) {
            setExpenses(legacyExpenses.map((expense) => ({ ...expense, currency: 'USD' })));
          }
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          expenses,
          mainCurrency,
          entryCurrency,
          availableCurrencies,
          customCurrencies,
          ratesToUsd,
          lastRateUpdated,
          spreadMonthlyIntoDaily,
        }),
      ).catch(() => undefined);
    }
  }, [
    expenses,
    mainCurrency,
    entryCurrency,
    availableCurrencies,
    customCurrencies,
    ratesToUsd,
    lastRateUpdated,
    spreadMonthlyIntoDaily,
    isLoaded,
  ]);

  useEffect(() => {
    if (!isLoaded) return;
    refreshRates();
    const interval = setInterval(() => {
      refreshRates();
    }, RATE_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [isLoaded]);

  const refreshRates = async () => {
    setRateStatus('refreshing');
    try {
      const response = await fetch(RATES_ENDPOINT);
      const data = (await response.json()) as { result?: string; rates?: Record<string, number> };
      if (data.result !== 'success' || !data.rates) throw new Error('Rates unavailable');
      const nextRates = { ...FALLBACK_RATES_TO_USD, ...ratesToUsdRef.current };
      CURRENCY_OPTIONS.forEach(({ code }) => {
        if (code === 'USD') nextRates[code] = 1;
        else if (data.rates?.[code]) nextRates[code] = 1 / data.rates[code];
      });
      customCurrenciesRef.current.forEach(({ code }) => {
        if (data.rates?.[code]) nextRates[code] = 1 / data.rates[code];
      });
      setRatesToUsd(nextRates);
      setLastRateUpdated(new Date().toISOString());
      setRateStatus('idle');
    } catch {
      setRateStatus('error');
    }
  };

  const value = useMemo(() => {
    const now = new Date();
    const currencyOptions: CurrencyOption[] = [...CURRENCY_OPTIONS, ...customCurrencies];
    const convertAmount = (amount: number, currency: CurrencyCode) =>
      amount * (ratesToUsd[currency] ?? 1) / (ratesToUsd[mainCurrency] ?? 1);
    const currentMonth = expenses.filter((expense) => isSameMonth(expense.date, now));
    const dailyTodayTotal = expenses
      .filter((expense) => expense.type === 'daily' && isToday(expense.date, now))
      .reduce((sum, expense) => sum + convertAmount(expense.amount, expense.currency), 0);
    const monthlyBillsTotal = currentMonth
      .filter((expense) => expense.type === 'monthly')
      .reduce((sum, expense) => sum + convertAmount(expense.amount, expense.currency), 0);
    const monthlyDailyTotal = currentMonth
      .filter((expense) => expense.type === 'daily')
      .reduce((sum, expense) => sum + convertAmount(expense.amount, expense.currency), 0);
    const currentMonthlyDailyShare = monthlyDailyShare(monthlyBillsTotal, now.getFullYear(), now.getMonth());
    const getMonthlyBillsTotalForMonth = (year: number, month: number) =>
      expenses
        .filter((expense) => {
          if (expense.type !== 'monthly') return false;
          const date = new Date(expense.date);
          return date.getFullYear() === year && date.getMonth() === month;
        })
        .reduce((sum, expense) => sum + convertAmount(expense.amount, expense.currency), 0);
    const getMonthlyDailyShareForMonth = (year: number, month: number) =>
      monthlyDailyShare(getMonthlyBillsTotalForMonth(year, month), year, month);

    return {
      expenses,
      isLoaded,
      mainCurrency,
      entryCurrency,
      availableCurrencies,
      currencyOptions,
      ratesToUsd,
      lastRateUpdated,
      rateStatus,
      spreadMonthlyIntoDaily,
      dailyTodayTotal,
      monthlyDailyShare: currentMonthlyDailyShare,
      effectiveDailyTodayTotal: dailyTodayTotal + (spreadMonthlyIntoDaily ? currentMonthlyDailyShare : 0),
      monthlyBillsTotal,
      monthlyDailyTotal,
      monthlyTotal: monthlyBillsTotal + monthlyDailyTotal,
      convertAmount,
      getMonthlyBillsTotalForMonth,
      getMonthlyDailyShareForMonth,
      addExpense: (input: AddExpenseInput) => {
        const createdAt = new Date().toISOString();
        const newExpense: Expense = {
          ...input,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          date: toExpenseDateString(input.date ?? new Date()),
          createdAt,
        };
        setExpenses((current) => [newExpense, ...current]);
      },
      removeExpense: (id: string) => {
        setExpenses((current) => current.filter((expense) => expense.id !== id));
      },
      clearAllExpenses: () => {
        setExpenses([]);
      },
      setMainCurrency: (currency: CurrencyCode) => {
        if (availableCurrencies.includes(currency)) setMainCurrencyState(currency);
      },
      setEntryCurrency: (currency: CurrencyCode) => {
        if (availableCurrencies.includes(currency)) setEntryCurrencyState(currency);
      },
      setSpreadMonthlyIntoDaily: (value: boolean) => {
        setSpreadMonthlyIntoDailyState(value);
      },
      addCustomCurrency: async (input: { code: string; name: string }) => {
        const code = input.code.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(code) || !input.name.trim()) {
          return { success: false, message: 'Enter a valid 3-letter currency code and name.' };
        }
        if (CURRENCY_OPTIONS.some((currency) => currency.code === code) || availableCurrencies.includes(code)) {
          return { success: false, message: 'That currency is already available.' };
        }
        try {
          const response = await fetch(RATES_ENDPOINT);
          const data = (await response.json()) as { result?: string; rates?: Record<string, number> };
          const unitsPerUsd = data.result === 'success' ? data.rates?.[code] : undefined;
          if (!unitsPerUsd || unitsPerUsd <= 0) {
            return { success: false, message: `No live exchange rate was found for ${code}.` };
          }
          const rateToUsd = 1 / unitsPerUsd;
          const currency: CurrencyOption = {
            code,
            name: input.name.trim(),
            symbol: getCurrencySymbol(code),
            isCustom: true,
          };
          setCustomCurrencies((current) => [...current.filter((item) => item.code !== code), currency]);
          setRatesToUsd((current) => ({ ...current, [code]: rateToUsd }));
          setAvailableCurrencies((current) => [...current, code]);
          return { success: true, currency, rateToUsd };
        } catch {
          return { success: false, message: 'Could not reach the exchange-rate service. Try again when online.' };
        }
      },
      removeCurrency: (currency: CurrencyCode) => {
        if (currency === mainCurrency) return;
        setAvailableCurrencies((current) => current.filter((item) => item !== currency));
        if (entryCurrency === currency) setEntryCurrencyState(mainCurrency);
      },
      createBackup: () =>
        createBackup({
          expenses,
          mainCurrency,
          entryCurrency,
          availableCurrencies,
          customCurrencies,
          ratesToUsd,
          lastRateUpdated,
          spreadMonthlyIntoDaily,
        }),
      importBackup: (backup: SpendlyBackup, mode: 'replace' | 'merge') => {
        const parsed = parseBackup(JSON.stringify(backup));
        if (!parsed.success) return { success: false, message: parsed.message };
        const normalized = normalizeBackupData(parsed.backup.data, FALLBACK_RATES_TO_USD);

        if (mode === 'replace') {
          setExpenses(normalized.expenses);
          setMainCurrencyState(normalized.mainCurrency);
          setEntryCurrencyState(normalized.entryCurrency);
          setAvailableCurrencies(normalized.availableCurrencies);
          setCustomCurrencies(normalized.customCurrencies);
          setRatesToUsd(normalized.ratesToUsd);
          setLastRateUpdated(normalized.lastRateUpdated);
          setSpreadMonthlyIntoDailyState(normalized.spreadMonthlyIntoDaily);
          return {
            success: true,
            message: `Restored ${normalized.expenses.length} expenses.`,
          };
        }

        const merged = mergeExpenses(expenses, normalized.expenses);
        const addedCount = merged.length - expenses.length;
        setExpenses(merged);
        return {
          success: true,
          message: addedCount > 0 ? `Added ${addedCount} new expenses.` : 'No new expenses to add.',
          addedCount,
        };
      },
      refreshRates,
      formatAmount: (amount: number, currency = mainCurrency) => {
        const option = currencyOptions.find((item) => item.code === currency);
        const maximumFractionDigits = currency === 'UGX' || currency === 'TZS' || currency === 'RWF' ? 0 : 2;
        try {
          return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits }).format(amount);
        } catch {
          return `${option?.symbol ?? currency} ${amount.toLocaleString('en-US', { maximumFractionDigits })}`;
        }
      },
    };
  }, [
    expenses,
    isLoaded,
    mainCurrency,
    entryCurrency,
    availableCurrencies,
    customCurrencies,
    ratesToUsd,
    lastRateUpdated,
    rateStatus,
    spreadMonthlyIntoDaily,
  ]);

  return <SpendingContext.Provider value={value}>{children}</SpendingContext.Provider>;
}

export function useSpending() {
  const context = useContext(SpendingContext);
  if (!context) throw new Error('useSpending must be used inside SpendingProvider');
  return context;
}