import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuickAddSheet } from '@/components/QuickAddSheet';
import { Expense, useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isSameDay(dateString: string, date: Date) {
  return dateKey(new Date(dateString)) === dateKey(date);
}

function getFillOpacity(amount: number, maximum: number) {
  if (!amount || !maximum) return 0;
  const ratio = amount / maximum;
  return 0.2 + ratio * 0.45;
}

function toHexAlpha(opacity: number) {
  return Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
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
  const { formatAmount, convertAmount, mainCurrency } = useSpending();
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
      <View style={styles.expenseAmountCopy}>
        <Text style={[styles.expenseAmount, { color: colors.foreground }]}>{formatAmount(expense.amount, expense.currency)}</Text>
        {expense.currency !== mainCurrency && (
          <Text style={[styles.expenseConverted, { color: colors.mutedForeground }]}>
            ≈ {formatAmount(convertAmount(expense.amount, expense.currency), mainCurrency)}
          </Text>
        )}
      </View>
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
  const { expenses, mainCurrency, formatAmount, convertAmount, removeExpense, spreadMonthlyIntoDaily, getMonthlyDailyShareForMonth } = useSpending();
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [isAddVisible, setIsAddVisible] = useState(false);

  const monthShare = useMemo(
    () =>
      spreadMonthlyIntoDaily
        ? getMonthlyDailyShareForMonth(visibleMonth.getFullYear(), visibleMonth.getMonth())
        : 0,
    [spreadMonthlyIntoDaily, getMonthlyDailyShareForMonth, visibleMonth],
  );

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
      if (spreadMonthlyIntoDaily && expense.type === 'monthly') return;
      const key = dateKey(new Date(expense.date));
      totals[key] = (totals[key] ?? 0) + convertAmount(expense.amount, expense.currency);
    });
    if (monthShare > 0) {
      const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day += 1) {
        const key = dateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
        totals[key] = (totals[key] ?? 0) + monthShare;
      }
    }
    return totals;
  }, [monthExpenses, convertAmount, spreadMonthlyIntoDaily, monthShare, visibleMonth]);

  const maximum = Math.max(0, ...Object.values(convertedTotals));
  const selectedExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        if (!isSameDay(expense.date, selectedDay)) return false;
        if (spreadMonthlyIntoDaily && expense.type === 'monthly') return false;
        return true;
      }),
    [expenses, selectedDay, spreadMonthlyIntoDaily],
  );
  const selectedCashTotal = selectedExpenses.reduce((sum, expense) => sum + convertAmount(expense.amount, expense.currency), 0);
  const selectedTotal = selectedCashTotal + monthShare;
  const cells = getDayCells(visibleMonth.getFullYear(), visibleMonth.getMonth());
  const weeks = useMemo(() => {
    const rows: (Date | null)[][] = [];
    for (let index = 0; index < cells.length; index += 7) {
      rows.push(cells.slice(index, index + 7));
    }
    return rows;
  }, [cells]);
  const monthLabel = visibleMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });
  const selectedLabel = selectedDay.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const selectedEntryCount = selectedExpenses.length + (monthShare > 0 ? 1 : 0);

  const moveMonth = (offset: number) => {
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setVisibleMonth(nextMonth);
    setSelectedDay(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
    Haptics.selectionAsync().catch(() => undefined);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom, 22) + 90, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>DAY BY DAY</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Daily spending</Text>
        </View>
        <Pressable
          testID="daily-add-expense"
          accessibilityLabel="Add daily expense"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            setIsAddVisible(true);
          }}
          style={({ pressed }) => [
            styles.headerAddButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
          ]}
        >
          <Feather name="plus" size={22} color={colors.primaryForeground} />
        </Pressable>
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
          {weeks.map((week, weekIndex) => (
            <View key={`week-${weekIndex}`} style={styles.calendarWeek}>
              {week.map((day, dayIndex) => {
                if (!day) {
                  return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.emptyDayCell} />;
                }
                const key = dateKey(day);
                const total = convertedTotals[key] ?? 0;
                const isSelected = dateKey(selectedDay) === key;
                const isToday = dateKey(today) === key;
                const fillOpacity = getFillOpacity(total, maximum);
                const strongFill = fillOpacity > 0.42;
                const fillBorderOpacity = total ? Math.min(fillOpacity + 0.22, 0.88) : 0;
                return (
                  <Pressable
                    key={key}
                    testID={`daily-day-${day.getDate()}`}
                    onPress={() => {
                      setSelectedDay(day);
                      Haptics.selectionAsync().catch(() => undefined);
                    }}
                    style={({ pressed }) => [styles.dayCell, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View
                      style={[
                        styles.dayFill,
                        {
                          backgroundColor: total
                            ? `${colors.primary}${toHexAlpha(fillOpacity)}`
                            : isSelected
                              ? colors.secondary
                              : 'transparent',
                          borderColor: isSelected
                            ? colors.foreground
                            : isToday
                              ? colors.primary
                              : total
                                ? `${colors.primary}${toHexAlpha(fillBorderOpacity)}`
                                : colors.border,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          {
                            color: strongFill ? colors.primaryForeground : colors.foreground,
                            fontWeight: isToday || isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                      {total > 0 && (
                        <Text
                          style={[
                            styles.dayAmount,
                            { color: strongFill ? colors.primaryForeground : colors.primary },
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                        >
                          {formatAmount(total, mainCurrency)}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <View style={styles.legend}>
          <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>LESS</Text>
          {[0.28, 0.48, 0.65].map((opacity) => (
            <View
              key={opacity}
              style={[
                styles.legendSwatch,
                {
                  backgroundColor: `${colors.primary}${toHexAlpha(opacity)}`,
                  borderColor: `${colors.primary}${toHexAlpha(Math.min(opacity + 0.22, 0.88))}`,
                },
              ]}
            />
          ))}
          <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>MORE</Text>
        </View>
      </View>

      <View style={styles.selectedHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{selectedLabel}</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
            {selectedEntryCount
              ? `${selectedEntryCount} ${selectedEntryCount === 1 ? 'entry' : 'entries'}`
              : 'No entries logged'}
          </Text>
        </View>
        <Text style={[styles.selectedTotal, { color: colors.primary }]}>{formatAmount(selectedTotal, mainCurrency)}</Text>
      </View>
      <View style={[styles.expensesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {monthShare > 0 && (
          <View style={[styles.expenseRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.expenseIcon, { backgroundColor: colors.accent }]}>
              <Feather name="calendar" size={16} color={colors.accentForeground} />
            </View>
            <View style={styles.expenseCopy}>
              <Text style={[styles.expenseCategory, { color: colors.foreground }]}>Monthly bills</Text>
              <Text style={[styles.expenseMeta, { color: colors.mutedForeground }]}>Spread across this month</Text>
            </View>
            <View style={styles.expenseAmountCopy}>
              <Text style={[styles.expenseAmount, { color: colors.foreground }]}>{formatAmount(monthShare, mainCurrency)}</Text>
            </View>
          </View>
        )}
        {selectedExpenses.length ? selectedExpenses.map((expense) => <ExpenseRow key={expense.id} expense={expense} onRemove={removeExpense} />) : !monthShare ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="sun" size={20} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>A clear day</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tap another date to see its expenses.</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
    <QuickAddSheet visible={isAddVisible} initialType="daily" initialDate={selectedDay} onClose={() => setIsAddVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.8 },
  headerAddButton: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  calendarCard: { borderRadius: 19, borderWidth: 1, padding: 16 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  arrowButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  weekdayRow: { flexDirection: 'row', marginBottom: 10, paddingHorizontal: 2 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700' },
  calendarGrid: { gap: 8 },
  calendarWeek: { flexDirection: 'row', gap: 6 },
  dayCell: {
    flex: 1,
    minHeight: 56,
  },
  dayFill: {
    flex: 1,
    minHeight: 56,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 5,
  },
  emptyDayCell: { flex: 1, minHeight: 56 },
  dayNumber: { fontSize: 12, lineHeight: 15 },
  dayAmount: { fontSize: 8, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 16 },
  legendLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 2 },
  legendSwatch: { width: 14, height: 14, borderRadius: 5, borderWidth: 1 },
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
  expenseAmountCopy: { alignItems: 'flex-end', minWidth: 76 },
  expenseConverted: { fontSize: 10, fontWeight: '500', marginTop: 3 },
  empty: { alignItems: 'center', paddingVertical: 27, paddingHorizontal: 16 },
  emptyIcon: { width: 45, height: 45, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  emptyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 5 },
  emptyText: { fontSize: 11, textAlign: 'center' },
});