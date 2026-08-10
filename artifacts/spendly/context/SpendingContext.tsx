import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code'];
export type CurrencyOption = (typeof CURRENCY_OPTIONS)[number];

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
};

type SpendingContextValue = {
  expenses: Expense[];
  isLoaded: boolean;
  mainCurrency: CurrencyCode;
  entryCurrency: CurrencyCode;
  availableCurrencies: CurrencyCode[];
  ratesToUsd: Record<CurrencyCode, number>;
  lastRateUpdated: string | null;
  rateStatus: 'idle' | 'refreshing' | 'error';
  dailyTodayTotal: number;
  monthlyBillsTotal: number;
  monthlyDailyTotal: number;
  monthlyTotal: number;
  addExpense: (input: AddExpenseInput) => void;
  removeExpense: (id: string) => void;
  setMainCurrency: (currency: CurrencyCode) => void;
  setEntryCurrency: (currency: CurrencyCode) => void;
  addCurrency: (currency: CurrencyCode) => void;
  removeCurrency: (currency: CurrencyCode) => void;
  refreshRates: () => Promise<void>;
  formatAmount: (amount: number, currency?: CurrencyCode) => string;
};

const STORAGE_KEY = '@spendly/data/v2';
const LEGACY_STORAGE_KEY = '@spendly/expenses/v1';
const DEFAULT_CURRENCIES: CurrencyCode[] = ['USD', 'UGX'];
const FALLBACK_RATES_TO_USD: Record<CurrencyCode, number> = {
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
  const [ratesToUsd, setRatesToUsd] = useState<Record<CurrencyCode, number>>(FALLBACK_RATES_TO_USD);
  const [lastRateUpdated, setLastRateUpdated] = useState<string | null>(null);
  const [rateStatus, setRateStatus] = useState<'idle' | 'refreshing' | 'error'>('idle');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(LEGACY_STORAGE_KEY)])
      .then(([stored, legacyStored]) => {
        if (stored) {
          const parsed = JSON.parse(stored) as {
            expenses?: Expense[];
            mainCurrency?: CurrencyCode;
            entryCurrency?: CurrencyCode;
            availableCurrencies?: CurrencyCode[];
            ratesToUsd?: Record<CurrencyCode, number>;
            lastRateUpdated?: string | null;
          };
          if (Array.isArray(parsed.expenses)) setExpenses(parsed.expenses);
          if (parsed.mainCurrency && CURRENCY_OPTIONS.some((item) => item.code === parsed.mainCurrency)) setMainCurrencyState(parsed.mainCurrency);
          if (parsed.entryCurrency && CURRENCY_OPTIONS.some((item) => item.code === parsed.entryCurrency)) setEntryCurrencyState(parsed.entryCurrency);
          if (Array.isArray(parsed.availableCurrencies)) {
            setAvailableCurrencies(Array.from(new Set(parsed.availableCurrencies.filter((currency) => CURRENCY_OPTIONS.some((item) => item.code === currency)))));
          }
          if (parsed.ratesToUsd) setRatesToUsd({ ...FALLBACK_RATES_TO_USD, ...parsed.ratesToUsd });
          if (parsed.lastRateUpdated) setLastRateUpdated(parsed.lastRateUpdated);
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
        JSON.stringify({ expenses, mainCurrency, entryCurrency, availableCurrencies, ratesToUsd, lastRateUpdated }),
      ).catch(() => undefined);
    }
  }, [expenses, mainCurrency, entryCurrency, availableCurrencies, ratesToUsd, lastRateUpdated, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    refreshRates();
  }, [isLoaded]);

  const refreshRates = async () => {
    setRateStatus('refreshing');
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = (await response.json()) as { result?: string; rates?: Record<string, number> };
      if (data.result !== 'success' || !data.rates) throw new Error('Rates unavailable');
      const nextRates = { ...FALLBACK_RATES_TO_USD };
      CURRENCY_OPTIONS.forEach(({ code }) => {
        if (code === 'USD') nextRates[code] = 1;
        else if (data.rates?.[code]) nextRates[code] = 1 / data.rates[code];
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
    const convertToMain = (amount: number, currency: CurrencyCode) =>
      amount * ratesToUsd[currency] / ratesToUsd[mainCurrency];
    const currentMonth = expenses.filter((expense) => isSameMonth(expense.date, now));
    const dailyTodayTotal = expenses
      .filter((expense) => expense.type === 'daily' && isToday(expense.date, now))
      .reduce((sum, expense) => sum + convertToMain(expense.amount, expense.currency), 0);
    const monthlyBillsTotal = currentMonth
      .filter((expense) => expense.type === 'monthly')
      .reduce((sum, expense) => sum + convertToMain(expense.amount, expense.currency), 0);
    const monthlyDailyTotal = currentMonth
      .filter((expense) => expense.type === 'daily')
      .reduce((sum, expense) => sum + convertToMain(expense.amount, expense.currency), 0);

    return {
      expenses,
      isLoaded,
      mainCurrency,
      entryCurrency,
      availableCurrencies,
      ratesToUsd,
      lastRateUpdated,
      rateStatus,
      dailyTodayTotal,
      monthlyBillsTotal,
      monthlyDailyTotal,
      monthlyTotal: monthlyBillsTotal + monthlyDailyTotal,
      addExpense: (input: AddExpenseInput) => {
        const nowString = new Date().toISOString();
        const newExpense: Expense = {
          ...input,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          date: nowString,
          createdAt: nowString,
        };
        setExpenses((current) => [newExpense, ...current]);
      },
      removeExpense: (id: string) => {
        setExpenses((current) => current.filter((expense) => expense.id !== id));
      },
      setMainCurrency: (currency: CurrencyCode) => {
        if (availableCurrencies.includes(currency)) setMainCurrencyState(currency);
      },
      setEntryCurrency: (currency: CurrencyCode) => {
        if (availableCurrencies.includes(currency)) setEntryCurrencyState(currency);
      },
      addCurrency: (currency: CurrencyCode) => {
        setAvailableCurrencies((current) => (current.includes(currency) ? current : [...current, currency]));
      },
      removeCurrency: (currency: CurrencyCode) => {
        if (currency === mainCurrency) return;
        setAvailableCurrencies((current) => current.filter((item) => item !== currency));
        if (entryCurrency === currency) setEntryCurrencyState(mainCurrency);
      },
      refreshRates,
      formatAmount: (amount: number, currency = mainCurrency) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: currency === 'UGX' || currency === 'TZS' || currency === 'RWF' ? 0 : 2 }).format(amount),
    };
  }, [expenses, isLoaded, mainCurrency, entryCurrency, availableCurrencies, ratesToUsd, lastRateUpdated, rateStatus]);

  return <SpendingContext.Provider value={value}>{children}</SpendingContext.Provider>;
}

export function useSpending() {
  const context = useContext(SpendingContext);
  if (!context) throw new Error('useSpending must be used inside SpendingProvider');
  return context;
}