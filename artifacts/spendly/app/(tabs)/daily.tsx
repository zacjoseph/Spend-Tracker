import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Expense, useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isSameDay(dateString: string, date: Date) {
  return dateKey(new Date(dateString)) === dateKey(date);
}

function getIntensity(amount: number, maximum: number) {
  if (!amount || !maximum) return 0;
  return Math.max(0.18, Math.min(1, amount / maximum));
}

function getDayCells(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= daysInMonth ? new Date(year, month, day) : null;
  });
}

function ExpenseRow({ expense, onRemove }: { expense: Expense; onRemove: (id: string) => void }) {
  const colors = useColors();
  const { formatAmount } = useSpending();
  const icon = expense.type === 'monthly' ? 'calendar' : expense.category === 'Food' ? 'coffee' : expense.category === 'Transport' ? 'navigation' : expense.category === 'Shopping' ? 'shopping-bag' : 'circle';

  return (
    <View style={[styles.expenseRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.expenseIcon, { backgroundColor: expense.type === 'monthly' ? colors.accent : colors.secondary }]}>
        <Feather name={icon as React.ComponentProps<typeof Feather>['name']} size={16} color={expense.type === 'monthly' ? colors.accentForeground : colors.primary} />
      </View>
      <View style={styles.expenseCopy}>
        <Text style={[styles.expenseCategory, { color: colors.foreground }]}>{expense.category}</Text>
        <Text style={[styles.expenseMeta, { color: colors.mutedForeground }]}>{expense.note || (expense.type === 'monthly' ? 'Monthly bill' : 'Daily expense')}</Text>
      </View>
      <Text style={[styles.expenseAmount, { color: colors.foreground }]}>{formatAmount(expense.amount, expense.currency)}</Text>
      <Pressable
        accessibilityLabel={`Delete ${expense.category}`}
        testID={`daily-delete-expense-${expense.id}`}
        hitSlop={10}
        onPress={() =>
          Alert.alert('Remove expense?', 'This entry will be removed from your totals.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => onRemove(expense.id) },
          ])
        }
      >
        <Feather name="more-horizontal" size={19} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

export default function DailyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { expenses, mainCurrency, formatAmount, convertAmount, removeExpense } = useSpending();
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));

  const monthExpenses = useMemo(
    () => expenses.filter((expense) => {
      const date = new Date(expense.date);
      return date.getFullYear() === visibleMonth.getFullYear() && date.getMonth() === visibleMonth.getMonth();
    }),
    [expenses, visibleMonth],
  );

  const convertedTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    monthExpenses.forEach((expense) => {
      const key = dateKey(new Date(expense.date));
      totals[key] = (totals[key] ?? 0) + convertAmount(expense.amount, expense.currency);
    });
    return totals;
  }, [monthExpenses, convertAmount]);

  const maximum = Math.max(0, ...Object.values(convertedTotals));
  const selectedExpenses = useMemo(() => expenses.filter((expense) => isSameDay(expense.date, selectedDay)), [expenses, selectedDay]);
  const selectedTotal = selectedExpenses.reduce((sum, expense) => sum + convertAmount(expense.amount, expense.currency), 0);
  const cells = getDayCells(visibleMonth.getFullYear(), visibleMonth.getMonth());
  const monthLabel = visibleMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });
  const selectedLabel = selectedDay.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  const moveMonth = (offset: number) => {
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setVisibleMonth(nextMonth);
    setSelectedDay(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
    Haptics.selectionAsync().catch(() => undefined);
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom, 22) + 90, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>DAY BY DAY</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Daily spending</Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="calendar" size={20} color={colors.foreground} />
        </View>
      </View>

      <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.calendarHeader}>
          <Pressable testID="daily-previous-month" accessibilityLabel="Previous month" onPress={() => moveMonth(-1)} hitSlop={10} style={styles.arrowButton}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.monthLabel, { color: colors.foreground }]}>{monthLabel}</Text>
          <Pressable testID="daily-next-month" accessibilityLabel="Next month" onPress={() => moveMonth(1)} hitSlop={10} style={styles.arrowButton}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((day, index) => <Text key={`${day}-${index}`} style={[styles.weekday, { color: colors.mutedForeground }]}>{day}</Text>)}
        </View>
        <View style={styles.calendarGrid}>
          {cells.map((day, index) => {
            if (!day) return <View key={`empty-${index}`} style={styles.emptyDayCell} />;
            const key = dateKey(day);
            const total = convertedTotals[key] ?? 0;
            const isSelected = dateKey(selectedDay) === key;
            const isToday = dateKey(today) === key;
            const intensity = getIntensity(total, maximum);
            return (
              <Pressable
                key={key}
                testID={`daily-day-${day.getDate()}`}
                onPress={() => {
                  setSelectedDay(day);
                  Haptics.selectionAsync().catch(() => undefined);
                }}
                style={({ pressed }) => [
                  styles.dayCell,
                  {
                    backgroundColor: total ? `${colors.primary}${Math.round(28 + intensity * 190).toString(16).padStart(2, '0')}` : 'transparent',
                    borderColor: isSelected ? colors.foreground : isToday ? colors.primary : 'transparent',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.dayNumber, { color: total && intensity > 0.58 ? colors.primaryForeground : colors.foreground, fontWeight: isToday || isSelected ? '700' : '500' }]}>{day.getDate()}</Text>
                {total > 0 && <Text style={[styles.dayAmount, { color: intensity > 0.58 ? colors.primaryForeground : colors.primary }]}>{formatAmount(total, mainCurrency)}</Text>}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.legend}>
          <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>LESS</Text>
          <View style={[styles.legendSwatch, { backgroundColor: `${colors.primary}30` }]} />
          <View style={[styles.legendSwatch, { backgroundColor: `${colors.primary}8c` }]} />
          <View style={[styles.legendSwatch, { backgroundColor: `${colors.primary}e8` }]} />
          <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>MORE</Text>
        </View>
      </View>

      <View style={styles.selectedHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{selectedLabel}</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{selectedExpenses.length ? `${selectedExpenses.length} ${selectedExpenses.length === 1 ? 'entry' : 'entries'}` : 'No entries logged'}</Text>
        </View>
        <Text style={[styles.selectedTotal, { color: colors.primary }]}>{formatAmount(selectedTotal, mainCurrency)}</Text>
      </View>
      <View style={[styles.expensesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {selectedExpenses.length ? selectedExpenses.map((expense) => <ExpenseRow key={expense.id} expense={expense} onRemove={removeExpense} />) : (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="sun" size={20} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>A clear day</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tap another date to see its expenses.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.8 },
  headerIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  calendarCard: { borderRadius: 19, borderWidth: 1, padding: 14 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  arrowButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  weekdayRow: { flexDirection: 'row', marginBottom: 7 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 5 },
  dayCell: { width: '14.2857%', minHeight: 54, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyDayCell: { width: '14.2857%', minHeight: 54 },
  dayNumber: { fontSize: 12 },
  dayAmount: { fontSize: 8, fontWeight: '700', marginTop: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginTop: 13 },
  legendLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 2 },
  legendSwatch: { width: 13, height: 13, borderRadius: 4 },
  selectedHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28, marginBottom: 11 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sectionHint: { fontSize: 11, fontWeight: '500' },
  selectedTotal: { fontSize: 16, fontWeight: '700' },
  expensesCard: { borderRadius: 17, borderWidth: 1, paddingHorizontal: 14 },
  expenseRow: { minHeight: 69, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, gap: 10 },
  expenseIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  expenseCopy: { flex: 1 },
  expenseCategory: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  expenseMeta: { fontSize: 10, fontWeight: '500' },
  expenseAmount: { fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 27, paddingHorizontal: 16 },
  emptyIcon: { width: 45, height: 45, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  emptyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 5 },
  emptyText: { fontSize: 11, textAlign: 'center' },
});