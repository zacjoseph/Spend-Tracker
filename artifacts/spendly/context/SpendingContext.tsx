import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ExpenseType = 'daily' | 'monthly';

export type Expense = {
  id: string;
  type: ExpenseType;
  amount: number;
  category: string;
  note: string;
  date: string;
  createdAt: string;
};

type AddExpenseInput = {
  type: ExpenseType;
  amount: number;
  category: string;
  note: string;
};

type SpendingContextValue = {
  expenses: Expense[];
  isLoaded: boolean;
  dailyTodayTotal: number;
  monthlyBillsTotal: number;
  monthlyDailyTotal: number;
  monthlyTotal: number;
  addExpense: (input: AddExpenseInput) => void;
  removeExpense: (id: string) => void;
};

const STORAGE_KEY = '@spendly/expenses/v1';
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
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          const parsed = JSON.parse(stored) as Expense[];
          if (Array.isArray(parsed)) setExpenses(parsed);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(expenses)).catch(() => undefined);
    }
  }, [expenses, isLoaded]);

  const value = useMemo(() => {
    const now = new Date();
    const currentMonth = expenses.filter((expense) => isSameMonth(expense.date, now));
    const dailyTodayTotal = expenses
      .filter((expense) => expense.type === 'daily' && isToday(expense.date, now))
      .reduce((sum, expense) => sum + expense.amount, 0);
    const monthlyBillsTotal = currentMonth
      .filter((expense) => expense.type === 'monthly')
      .reduce((sum, expense) => sum + expense.amount, 0);
    const monthlyDailyTotal = currentMonth
      .filter((expense) => expense.type === 'daily')
      .reduce((sum, expense) => sum + expense.amount, 0);

    return {
      expenses,
      isLoaded,
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
    };
  }, [expenses, isLoaded]);

  return <SpendingContext.Provider value={value}>{children}</SpendingContext.Provider>;
}

export function useSpending() {
  const context = useContext(SpendingContext);
  if (!context) throw new Error('useSpending must be used inside SpendingProvider');
  return context;
}