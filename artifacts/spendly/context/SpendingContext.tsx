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

export type CurrencyCode = string;
export type CurrencyOption = {
  code: CurrencyCode;
  name: string;
  symbol: string;
  isCustom?: boolean;
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
  dailyTodayTotal: number;
  monthlyBillsTotal: number;
  monthlyDailyTotal: number;
  monthlyTotal: number;
  addExpense: (input: AddExpenseInput) => void;
  removeExpense: (id: string) => void;
  setMainCurrency: (currency: CurrencyCode) => void;
  setEntryCurrency: (currency: CurrencyCode) => void;
  addCustomCurrency: (input: { code: string; name: string; symbol: string; rateToUsd: number }) => boolean;
  removeCurrency: (currency: CurrencyCode) => void;
  refreshRates: () => Promise<void>;
  formatAmount: (amount: number, currency?: CurrencyCode) => string;
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
            customCurrencies?: CurrencyOption[];
            ratesToUsd?: Record<string, number>;
            lastRateUpdated?: string | null;
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
        JSON.stringify({ expenses, mainCurrency, entryCurrency, availableCurrencies, customCurrencies, ratesToUsd, lastRateUpdated }),
      ).catch(() => undefined);
    }
  }, [expenses, mainCurrency, entryCurrency, availableCurrencies, customCurrencies, ratesToUsd, lastRateUpdated, isLoaded]);

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
      customCurrencies.forEach(({ code }) => {
        if (ratesToUsd[code]) nextRates[code] = ratesToUsd[code];
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
    const convertToMain = (amount: number, currency: CurrencyCode) =>
      amount * (ratesToUsd[currency] ?? 1) / (ratesToUsd[mainCurrency] ?? 1);
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
      currencyOptions,
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
      addCustomCurrency: (input: { code: string; name: string; symbol: string; rateToUsd: number }) => {
        const code = input.code.trim().toUpperCase();
        if (!/^[A-Z0-9]{3,6}$/.test(code) || !input.name.trim() || !input.symbol.trim() || !Number.isFinite(input.rateToUsd) || input.rateToUsd <= 0) {
          return false;
        }
        if (CURRENCY_OPTIONS.some((currency) => currency.code === code) || availableCurrencies.includes(code)) {
          return false;
        }
        setCustomCurrencies((current) => [
          ...current.filter((currency) => currency.code !== code),
          { code, name: input.name.trim(), symbol: input.symbol.trim(), isCustom: true },
        ]);
        setRatesToUsd((current) => ({ ...current, [code]: input.rateToUsd }));
        setAvailableCurrencies((current) => [...current, code]);
        return true;
      },
      removeCurrency: (currency: CurrencyCode) => {
        if (currency === mainCurrency) return;
        setAvailableCurrencies((current) => current.filter((item) => item !== currency));
        if (entryCurrency === currency) setEntryCurrencyState(mainCurrency);
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
  }, [expenses, isLoaded, mainCurrency, entryCurrency, availableCurrencies, customCurrencies, ratesToUsd, lastRateUpdated, rateStatus]);

  return <SpendingContext.Provider value={value}>{children}</SpendingContext.Provider>;
}

export function useSpending() {
  const context = useContext(SpendingContext);
  if (!context) throw new Error('useSpending must be used inside SpendingProvider');
  return context;
}