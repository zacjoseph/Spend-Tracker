import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuickAddSheet } from '@/components/QuickAddSheet';
import { Expense, useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';
import { showExpenseActions } from '@/utils/expenseActions';
import { getCategoryIcon } from '@/utils/categories';
import { getHeatmapCellColors, LEGEND_OPACITIES, toHexAlpha } from '@/utils/calendarHeatmap';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthKey(dateString: string) {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function BillRow({ expense, onEdit, onRemove }: { expense: Expense; onEdit: (expense: Expense) => void; onRemove: (id: string) => void }) {
  const colors = useColors();
  const { formatAmount, convertAmount, mainCurrency } = useSpending();
  const icon = getCategoryIcon(expense.category, 'monthly');

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
        testID={`monthly-expense-actions-${expense.id}`}
        accessibilityLabel={`Manage ${expense.category}`}
        hitSlop={10}
        onPress={() => showExpenseActions(expense, { onEdit: () => onEdit(expense), onRemove: () => onRemove(expense.id) })}
        style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.45 : 0.75 }]}
      >
        <Feather name="more-horizontal" size={17} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

export default function MonthlyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { expenses, mainCurrency, formatAmount, convertAmount, removeExpense } = useSpending();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [isAddVisible, setIsAddVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

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
  const monthRows = useMemo(() => {
    const rows: number[][] = [];
    for (let index = 0; index < MONTHS.length; index += 3) {
      rows.push([index, index + 1, index + 2]);
    }
    return rows;
  }, []);
  const addExpenseDate = (() => {
    const now = new Date();
    if (year === now.getFullYear() && selectedMonth === now.getMonth()) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    return new Date(year, selectedMonth, 1);
  })();
  const monthlyBillCount = expenses.filter(
    (expense) => expense.type === 'monthly' && monthKey(expense.date) === `${year}-${selectedMonth}`,
  ).length;

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
            setEditingExpense(null);
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

      <View style={[styles.summaryCard, { backgroundColor: colors.navy }]}>
        <Text style={[styles.summaryLabel, { color: colors.accentForeground }]}>TOTAL IN {year}</Text>
        <Text style={[styles.summaryAmount, { color: '#ffffff' }]}>{formatAmount(yearTotals.reduce((sum, amount) => sum + amount, 0), mainCurrency)}</Text>
      </View>

      <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.calendarHeader}>
          <Pressable testID="monthly-previous-year" accessibilityLabel="Previous year" onPress={() => moveYear(-1)} hitSlop={10} style={styles.arrowButton}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.periodLabel, { color: colors.foreground }]}>{year}</Text>
          <Pressable testID="monthly-next-year" accessibilityLabel="Next year" onPress={() => moveYear(1)} hitSlop={10} style={styles.arrowButton}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.calendarGrid}>
          {monthRows.map((row, rowIndex) => (
            <View key={`month-row-${rowIndex}`} style={styles.calendarRow}>
              {row.map((index) => {
                const month = MONTHS[index];
                const total = yearTotals[index];
                const isSelected = selectedMonth === index;
                const isCurrentMonth = year === currentYear && index === currentMonth;
                const cellColors = getHeatmapCellColors(total, maximum, colors.primary, {
                  isSelected,
                  isHighlighted: isCurrentMonth,
                  selectedBorderColor: colors.foreground,
                  emptyBorderColor: colors.border,
                  highlightColor: colors.primary,
                  secondaryColor: colors.secondary,
                  foregroundColor: colors.foreground,
                  primaryForeground: colors.primaryForeground,
                });
                return (
                  <Pressable
                    key={month}
                    testID={`monthly-month-${index + 1}`}
                    onPress={() => {
                      setSelectedMonth(index);
                      Haptics.selectionAsync().catch(() => undefined);
                    }}
                    style={({ pressed }) => [styles.monthCell, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View
                      style={[
                        styles.heatmapFill,
                        {
                          backgroundColor: cellColors.backgroundColor,
                          borderColor: cellColors.borderColor,
                          borderWidth: cellColors.borderWidth,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.cellLabel,
                          {
                            color: cellColors.labelColor,
                            fontWeight: isCurrentMonth || isSelected ? '700' : '600',
                          },
                        ]}
                      >
                        {month}
                      </Text>
                      {total > 0 ? (
                        <Text
                          style={[styles.cellAmount, { color: cellColors.amountColor }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                        >
                          {formatAmount(total, mainCurrency)}
                        </Text>
                      ) : (
                        <Text style={[styles.cellEmpty, { color: colors.mutedForeground }]}>—</Text>
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
          {LEGEND_OPACITIES.map((opacity) => (
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
            {monthlyBillCount ? `${monthlyBillCount} ${monthlyBillCount === 1 ? 'bill' : 'bills'}` : 'No bills logged'}
          </Text>
        </View>
        <Text style={[styles.selectedTotal, { color: colors.primary }]}>{formatAmount(selectedTotal, mainCurrency)}</Text>
      </View>

      {year === currentYear && monthlyBillCount > 0 && (
        <>
          <View style={styles.billsHeader}>
            <Text style={[styles.billsTitle, { color: colors.foreground }]}>Bills in {selectedLabel}</Text>
          </View>
          {expenses.filter((expense) => expense.type === 'monthly' && monthKey(expense.date) === `${year}-${selectedMonth}`).map((expense) => (
            <BillRow key={expense.id} expense={expense} onEdit={setEditingExpense} onRemove={removeExpense} />
          ))}
        </>
      )}
    </ScrollView>
    <QuickAddSheet
      visible={isAddVisible || !!editingExpense}
      initialType="monthly"
      initialDate={editingExpense ? new Date(editingExpense.date) : addExpenseDate}
      expense={editingExpense ?? undefined}
      onClose={() => {
        setIsAddVisible(false);
        setEditingExpense(null);
      }}
    />
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
  summaryCard: { borderRadius: 22, padding: 20, marginBottom: 12, gap: 8 },
  summaryLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  summaryAmount: { fontSize: 40, fontWeight: '700', letterSpacing: -1.1 },
  calendarCard: { borderRadius: 19, borderWidth: 1, padding: 16 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  arrowButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  periodLabel: { fontSize: 16, fontWeight: '700' },
  calendarGrid: { gap: 8 },
  calendarRow: { flexDirection: 'row', gap: 6 },
  monthCell: { flex: 1, minHeight: 56 },
  heatmapFill: {
    flex: 1,
    minHeight: 56,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  cellLabel: { fontSize: 13, lineHeight: 16, fontWeight: '600' },
  cellAmount: { fontSize: 9, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  cellEmpty: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 16 },
  legendLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 2 },
  legendSwatch: { width: 14, height: 14, borderRadius: 5, borderWidth: 1 },
  selectedHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28, marginBottom: 11 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sectionHint: { fontSize: 11, fontWeight: '500' },
  selectedTotal: { fontSize: 16, fontWeight: '700' },
  billsHeader: { marginTop: 18, marginBottom: 10 },
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
