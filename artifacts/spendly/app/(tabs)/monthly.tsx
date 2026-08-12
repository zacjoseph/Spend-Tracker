import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuickAddSheet } from '@/components/QuickAddSheet';
import { Expense, useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthKey(dateString: string) {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function getIntensity(amount: number, maximum: number) {
  if (!amount || !maximum) return 0;
  return Math.max(0.18, Math.min(1, amount / maximum));
}

function BillRow({ expense, onRemove }: { expense: Expense; onRemove: (id: string) => void }) {
  const colors = useColors();
  const { formatAmount, convertAmount, mainCurrency } = useSpending();
  const icon = expense.category === 'Rent' ? 'home' : expense.category === 'Electricity' ? 'zap' : expense.category === 'Internet' ? 'wifi' : expense.category === 'Phone' ? 'smartphone' : 'more-horizontal';

  return (
    <View style={[styles.billRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.billIcon, { backgroundColor: colors.accent }]}>
        <Feather name={icon as React.ComponentProps<typeof Feather>['name']} size={18} color={colors.accentForeground} />
      </View>
      <View style={styles.billCopy}>
        <Text style={[styles.billTitle, { color: colors.foreground }]}>{expense.category}</Text>
        <Text style={[styles.billMeta, { color: colors.mutedForeground }]}>{expense.note || 'Monthly bill'}</Text>
      </View>
      <View style={styles.billAmountCopy}>
        <Text style={[styles.billAmount, { color: colors.foreground }]}>{formatAmount(expense.amount, expense.currency)}</Text>
        {expense.currency !== mainCurrency && (
          <Text style={[styles.billConverted, { color: colors.mutedForeground }]}>
            ≈ {formatAmount(convertAmount(expense.amount, expense.currency), mainCurrency)}
          </Text>
        )}
      </View>
      <Pressable
        testID={`monthly-delete-expense-${expense.id}`}
        accessibilityLabel={`Delete ${expense.category}`}
        hitSlop={10}
        onPress={() =>
          Alert.alert('Remove monthly expense?', 'This entry will be removed from your spending totals.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => onRemove(expense.id) },
          ])
        }
        style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.45 : 0.75 }]}
      >
        <Feather name="trash-2" size={17} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

export default function MonthlyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { expenses, mainCurrency, formatAmount, convertAmount, removeExpense } = useSpending();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [isAddVisible, setIsAddVisible] = useState(false);

  const totals = useMemo(() => {
    const byMonth: Record<string, number> = {};
    expenses.forEach((expense) => {
      const key = monthKey(expense.date);
      byMonth[key] = (byMonth[key] ?? 0) + convertAmount(expense.amount, expense.currency);
    });
    return byMonth;
  }, [expenses, convertAmount]);

  const yearTotals = MONTHS.map((_, index) => totals[`${year}-${index}`] ?? 0);
  const maximum = Math.max(0, ...yearTotals);
  const selectedTotal = yearTotals[selectedMonth] ?? 0;
  const selectedLabel = new Date(year, selectedMonth, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
  const addExpenseDate = (() => {
    const now = new Date();
    if (year === now.getFullYear() && selectedMonth === now.getMonth()) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    return new Date(year, selectedMonth, 1);
  })();

  const moveYear = (offset: number) => {
    setYear((current) => current + offset);
    setSelectedMonth(0);
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
          <Text style={[styles.eyebrow, { color: colors.primary }]}>YEAR AT A GLANCE</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Monthly spending</Text>
        </View>
        <Pressable
          testID="monthly-add-expense"
          accessibilityLabel="Add monthly bill"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            setIsAddVisible(true);
          }}
          style={({ pressed }) => [
            styles.headerAddButton,
            { backgroundColor: colors.accent, opacity: pressed ? 0.82 : 1 },
          ]}
        >
          <Feather name="plus" size={22} color={colors.accentForeground} />
        </Pressable>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: colors.navy }]}>
        <View>
          <Text style={[styles.summaryLabel, { color: colors.navyMuted }]}>TOTAL IN {year}</Text>
          <Text style={[styles.summaryAmount, { color: '#ffffff' }]}>{formatAmount(yearTotals.reduce((sum, amount) => sum + amount, 0), mainCurrency)}</Text>
        </View>
        <View style={[styles.summaryIcon, { backgroundColor: colors.navyMuted + '4d' }]}>
          <Feather name="trending-up" size={20} color={colors.accent} />
        </View>
      </View>

      <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.calendarHeader}>
          <Pressable testID="monthly-previous-year" accessibilityLabel="Previous year" onPress={() => moveYear(-1)} hitSlop={10} style={styles.arrowButton}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.yearLabel, { color: colors.foreground }]}>{year}</Text>
          <Pressable testID="monthly-next-year" accessibilityLabel="Next year" onPress={() => moveYear(1)} hitSlop={10} style={styles.arrowButton}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.monthGrid}>
          {MONTHS.map((month, index) => {
            const total = yearTotals[index];
            const intensity = getIntensity(total, maximum);
            const isSelected = selectedMonth === index;
            return (
              <Pressable
                key={month}
                testID={`monthly-month-${index + 1}`}
                onPress={() => {
                  setSelectedMonth(index);
                  Haptics.selectionAsync().catch(() => undefined);
                }}
                style={({ pressed }) => [
                  styles.monthCell,
                  {
                    backgroundColor: total ? `${colors.primary}${Math.round(28 + intensity * 190).toString(16).padStart(2, '0')}` : colors.secondary,
                    borderColor: isSelected ? colors.foreground : 'transparent',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.monthName, { color: total && intensity > 0.58 ? colors.primaryForeground : colors.foreground }]}>{month}</Text>
                <Text style={[styles.monthAmount, { color: intensity > 0.58 ? colors.primaryForeground : total ? colors.primary : colors.mutedForeground }]}>{total ? formatAmount(total, mainCurrency) : '—'}</Text>
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

      <View style={[styles.detailCard, { backgroundColor: colors.accent }]}>
        <View style={styles.detailCopy}>
          <Text style={[styles.detailLabel, { color: colors.accentForeground + 'b3' }]}>SELECTED MONTH</Text>
          <Text style={[styles.detailTitle, { color: colors.accentForeground }]}>{selectedLabel}</Text>
        </View>
        <Text style={[styles.detailAmount, { color: colors.accentForeground }]}>{formatAmount(selectedTotal, mainCurrency)}</Text>
      </View>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>Select a month to compare spending intensity across the year.</Text>
      {year === currentYear && (
        <>
          <View style={styles.billsHeader}>
            <Text style={[styles.billsTitle, { color: colors.foreground }]}>Bills in {selectedLabel}</Text>
            <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{expenses.filter((expense) => expense.type === 'monthly' && monthKey(expense.date) === `${year}-${selectedMonth}`).length} entries</Text>
          </View>
          {expenses.filter((expense) => expense.type === 'monthly' && monthKey(expense.date) === `${year}-${selectedMonth}`).map((expense) => (
            <BillRow key={expense.id} expense={expense} onRemove={removeExpense} />
          ))}
        </>
      )}
    </ScrollView>
    <QuickAddSheet visible={isAddVisible} initialType="monthly" initialDate={addExpenseDate} onClose={() => setIsAddVisible(false)} />
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
  summaryCard: { borderRadius: 21, padding: 20, minHeight: 130, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  summaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginBottom: 8 },
  summaryAmount: { fontSize: 34, fontWeight: '700', letterSpacing: -1 },
  summaryIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  calendarCard: { borderRadius: 19, borderWidth: 1, padding: 14 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  arrowButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  yearLabel: { fontSize: 16, fontWeight: '700' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthCell: { width: '31.5%', minHeight: 76, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  monthName: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  monthAmount: { fontSize: 10, fontWeight: '600' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginTop: 15 },
  legendLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 2 },
  legendSwatch: { width: 13, height: 13, borderRadius: 4 },
  detailCard: { minHeight: 75, borderRadius: 17, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 },
  detailCopy: { flex: 1 },
  detailLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  detailTitle: { fontSize: 15, fontWeight: '700' },
  detailAmount: { fontSize: 18, fontWeight: '700' },
  note: { fontSize: 11, lineHeight: 17, marginTop: 10 },
  sectionHint: { fontSize: 11, fontWeight: '500' },
  billsHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 25, marginBottom: 10 },
  billsTitle: { fontSize: 17, fontWeight: '700' },
  billRow: { minHeight: 72, borderRadius: 16, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  billIcon: { width: 41, height: 41, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  billCopy: { flex: 1 },
  billTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  billMeta: { fontSize: 10, fontWeight: '500' },
  billAmountCopy: { alignItems: 'flex-end', minWidth: 76 },
  billAmount: { fontSize: 13, fontWeight: '700' },
  billConverted: { fontSize: 10, fontWeight: '500', marginTop: 3 },
  deleteButton: { paddingLeft: 2, paddingVertical: 8 },
});