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
import {
  categoriesInclude,
  DEFAULT_DAILY_CATEGORIES,
  DEFAULT_MONTHLY_CATEGORIES,
  findCategoryMatch,
  PROTECTED_CATEGORY,
  sanitizeCategoryList,
  validateCategoryName,
} from '@/utils/categories';
import { getDefaultAvailableCurrencies, getDefaultCategories } from '@/utils/defaults';
import { moveListItem } from '@/utils/reorderList';
import { createTripId, findTripById, mergeTrips, sanitizeTrips, validateTripName, type Trip, type TripMutationResult } from '@/utils/trips';

export type ExpenseType = 'daily' | 'monthly';

export const CURRENCY_OPTIONS = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
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

export type { Trip } from '@/utils/trips';

export type Expense = {
  id: string;
  type: ExpenseType;
  amount: number;
  currency: CurrencyCode;
  category: string;
  note: string;
  date: string;
  createdAt: string;
  tripId?: string | null;
};

type AddExpenseInput = {
  type: ExpenseType;
  amount: number;
  currency: CurrencyCode;
  category: string;
  note: string;
  date?: Date;
  tripId?: string | null;
};

type UpdateExpenseInput = AddExpenseInput & {
  id: string;
};

type CategoryMutationResult = { success: boolean; message?: string; name?: string };

type SpendingContextValue = {
  expenses: Expense[];
  isLoaded: boolean;
  mainCurrency: CurrencyCode;
  entryCurrency: CurrencyCode;
  availableCurrencies: CurrencyCode[];
  currencyOptions: CurrencyOption[];
  dailyCategories: string[];
  monthlyCategories: string[];
  trips: Trip[];
  activeTripId: string | null;
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
  updateExpense: (input: UpdateExpenseInput) => void;
  removeExpense: (id: string) => void;
  clearAllExpenses: () => void;
  setMainCurrency: (currency: CurrencyCode) => void;
  setEntryCurrency: (currency: CurrencyCode) => void;
  setSpreadMonthlyIntoDaily: (value: boolean) => void;
  addCustomCurrency: (input: { code: string; name: string }) => Promise<AddCustomCurrencyResult>;
  removeCurrency: (currency: CurrencyCode) => void;
  addCategory: (type: ExpenseType, name: string) => CategoryMutationResult;
  removeCategory: (type: ExpenseType, name: string) => CategoryMutationResult;
  reorderCategories: (type: ExpenseType, fromIndex: number, toIndex: number) => void;
  reorderCurrency: (fromIndex: number, toIndex: number) => void;
  restoreDefaults: () => void;
  addTrip: (name: string) => TripMutationResult;
  removeTrip: (tripId: string) => void;
  setActiveTripId: (tripId: string | null) => void;
  getTripById: (tripId?: string | null) => Trip | undefined;
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
const DEFAULT_CURRENCIES = getDefaultAvailableCurrencies();
const FALLBACK_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  JPY: 0.0067,
  GBP: 1.27,
  AUD: 0.65,
  CAD: 0.74,
  THB: 0.029,
  MXN: 0.058,
  CNY: 0.14,
  UGX: 0.00028,
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
  const [entryCurrency, setEntryCurrencyState] = useState<CurrencyCode>('USD');
  const [availableCurrencies, setAvailableCurrencies] = useState<CurrencyCode[]>(DEFAULT_CURRENCIES);
  const [customCurrencies, setCustomCurrencies] = useState<CurrencyOption[]>([]);
  const [dailyCategories, setDailyCategories] = useState<string[]>(DEFAULT_DAILY_CATEGORIES);
  const [monthlyCategories, setMonthlyCategories] = useState<string[]>(DEFAULT_MONTHLY_CATEGORIES);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripIdState] = useState<string | null>(null);
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
            dailyCategories?: string[];
            monthlyCategories?: string[];
            trips?: Trip[];
            activeTripId?: string | null;
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
          if (parsed.mainCurrency && knownCodes.has(parsed.mainCurrency)) setMainCurrencyState(parsed.mainCurrency);
          if (parsed.entryCurrency && knownCodes.has(parsed.entryCurrency)) setEntryCurrencyState(parsed.entryCurrency);
          if (Array.isArray(parsed.availableCurrencies)) {
            setAvailableCurrencies(Array.from(new Set(parsed.availableCurrencies.filter((currency) => knownCodes.has(currency)))));
          }
          setDailyCategories(sanitizeCategoryList(parsed.dailyCategories, DEFAULT_DAILY_CATEGORIES));
          setMonthlyCategories(sanitizeCategoryList(parsed.monthlyCategories, DEFAULT_MONTHLY_CATEGORIES));
          const storedTrips = sanitizeTrips(parsed.trips);
          setTrips(storedTrips);
          const storedTripIds = new Set(storedTrips.map((trip) => trip.id));
          setActiveTripIdState(parsed.activeTripId && storedTripIds.has(parsed.activeTripId) ? parsed.activeTripId : null);
          if (Array.isArray(parsed.expenses)) {
            setExpenses(
              parsed.expenses.map((expense) => ({
                ...expense,
                tripId: expense.tripId && storedTripIds.has(expense.tripId) ? expense.tripId : null,
              })),
            );
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
          dailyCategories,
          monthlyCategories,
          trips,
          activeTripId,
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
    dailyCategories,
    monthlyCategories,
    trips,
    activeTripId,
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
      dailyCategories,
      monthlyCategories,
      trips,
      activeTripId,
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
        const tripId = input.tripId && trips.some((trip) => trip.id === input.tripId) ? input.tripId : null;
        const newExpense: Expense = {
          ...input,
          tripId,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          date: toExpenseDateString(input.date ?? new Date()),
          createdAt,
        };
        setExpenses((current) => [newExpense, ...current]);
      },
      updateExpense: (input: UpdateExpenseInput) => {
        const tripId = input.tripId && trips.some((trip) => trip.id === input.tripId) ? input.tripId : null;
        setExpenses((current) =>
          current.map((expense) =>
            expense.id === input.id
              ? {
                  ...expense,
                  type: input.type,
                  amount: input.amount,
                  currency: input.currency,
                  category: input.category,
                  note: input.note,
                  tripId,
                  date: toExpenseDateString(input.date ?? new Date(expense.date)),
                }
              : expense,
          ),
        );
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
        if (availableCurrencies.includes(code)) {
          return { success: false, message: 'That currency is already available.' };
        }
        const catalogOption = CURRENCY_OPTIONS.find((currency) => currency.code === code);
        try {
          const response = await fetch(RATES_ENDPOINT);
          const data = (await response.json()) as { result?: string; rates?: Record<string, number> };
          const unitsPerUsd = data.result === 'success' ? data.rates?.[code] : undefined;
          const rateToUsd =
            unitsPerUsd && unitsPerUsd > 0 ? 1 / unitsPerUsd : (ratesToUsdRef.current[code] ?? FALLBACK_RATES_TO_USD[code]);
          if (!rateToUsd || rateToUsd <= 0) {
            return { success: false, message: `No live exchange rate was found for ${code}.` };
          }

          if (catalogOption) {
            setRatesToUsd((current) => ({ ...current, [code]: rateToUsd }));
            setAvailableCurrencies((current) => [...current, code]);
            return { success: true, currency: catalogOption, rateToUsd };
          }

          if (!unitsPerUsd || unitsPerUsd <= 0) {
            return { success: false, message: `No live exchange rate was found for ${code}.` };
          }
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
      addCategory: (type: ExpenseType, name: string) => {
        const validated = validateCategoryName(name);
        if (!validated.success) return { success: false, message: validated.message };
        const list = type === 'daily' ? dailyCategories : monthlyCategories;
        if (categoriesInclude(list, validated.name)) {
          return { success: false, message: 'That category already exists.' };
        }
        const setter = type === 'daily' ? setDailyCategories : setMonthlyCategories;
        setter((current) => [...current, validated.name]);
        return { success: true, name: validated.name };
      },
      removeCategory: (type: ExpenseType, name: string) => {
        const match = findCategoryMatch(type === 'daily' ? dailyCategories : monthlyCategories, name);
        if (!match) return { success: false, message: 'Category not found.' };
        if (match === PROTECTED_CATEGORY) return { success: false, message: 'Other cannot be removed.' };
        const setter = type === 'daily' ? setDailyCategories : setMonthlyCategories;
        setter((current) => current.filter((item) => item !== match));
        return { success: true };
      },
      reorderCategories: (type: ExpenseType, fromIndex: number, toIndex: number) => {
        const setter = type === 'daily' ? setDailyCategories : setMonthlyCategories;
        setter((current) => moveListItem(current, fromIndex, toIndex));
      },
      reorderCurrency: (fromIndex: number, toIndex: number) => {
        setAvailableCurrencies((current) => moveListItem(current, fromIndex, toIndex));
      },
      restoreDefaults: () => {
        setDailyCategories(getDefaultCategories('daily'));
        setMonthlyCategories(getDefaultCategories('monthly'));
        setAvailableCurrencies(getDefaultAvailableCurrencies());
        setMainCurrencyState('USD');
        setEntryCurrencyState('USD');
        setSpreadMonthlyIntoDailyState(false);
      },
      addTrip: (name: string) => {
        const validated = validateTripName(name);
        if (!validated.success || !validated.name) return { success: false, message: validated.message };
        const duplicate = trips.some((trip) => trip.name.toLowerCase() === validated.name!.toLowerCase());
        if (duplicate) return { success: false, message: 'You already have a trip with that name.' };
        const trip: Trip = { id: createTripId(), name: validated.name, createdAt: new Date().toISOString() };
        setTrips((current) => [trip, ...current]);
        return { success: true, trip };
      },
      setActiveTripId: (tripId: string | null) => {
        if (tripId && !trips.some((trip) => trip.id === tripId)) return;
        setActiveTripIdState(tripId);
      },
      removeTrip: (tripId: string) => {
        setTrips((current) => current.filter((trip) => trip.id !== tripId));
        if (activeTripId === tripId) setActiveTripIdState(null);
        setExpenses((current) =>
          current.map((expense) => (expense.tripId === tripId ? { ...expense, tripId: null } : expense)),
        );
      },
      getTripById: (tripId?: string | null) => findTripById(trips, tripId),
      createBackup: () =>
        createBackup({
          expenses,
          mainCurrency,
          entryCurrency,
          availableCurrencies,
          customCurrencies,
          dailyCategories,
          monthlyCategories,
          trips,
          activeTripId,
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
          setDailyCategories(normalized.dailyCategories ?? DEFAULT_DAILY_CATEGORIES);
          setMonthlyCategories(normalized.monthlyCategories ?? DEFAULT_MONTHLY_CATEGORIES);
          setTrips(normalized.trips ?? []);
          setActiveTripIdState(normalized.activeTripId ?? null);
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
        setTrips(mergeTrips(trips, normalized.trips ?? []));
        return {
          success: true,
          message: addedCount > 0 ? `Added ${addedCount} new expenses.` : 'No new expenses to add.',
          addedCount,
        };
      },
      refreshRates,
      formatAmount: (amount: number, currency = mainCurrency) => {
        const option = currencyOptions.find((item) => item.code === currency);
        const zeroDecimalCurrencies = new Set(['UGX', 'TZS', 'RWF', 'JPY', 'THB']);
        const maximumFractionDigits = zeroDecimalCurrencies.has(currency) ? 0 : 2;
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
    dailyCategories,
    monthlyCategories,
    trips,
    activeTripId,
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