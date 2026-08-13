import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuickAddSheet } from '@/components/QuickAddSheet';
import { ExpenseSearchField } from '@/components/ExpenseSearchField';
import { RateFreshnessIndicator } from '@/components/RateFreshnessIndicator';
import { TripPicker } from '@/components/TripPicker';
import { Expense, useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';
import { showExpenseActions } from '@/utils/expenseActions';
import { getCategoryIcon } from '@/utils/categories';
import { filterExpenses, formatExpenseListMeta } from '@/utils/expenseSearch';
import { computeSpendingTotals, filterExpensesByTrip } from '@/utils/expenseTotals';

function ExpenseRow({
  expense,
  onEdit,
  onRemove,
  showDate = false,
  showTrip = false,
}: {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onRemove: (id: string) => void;
  showDate?: boolean;
  showTrip?: boolean;
}) {
  const colors = useColors();
  const { formatAmount, convertAmount, mainCurrency, getTripById } = useSpending();
  const icon = expense.type === 'monthly' ? 'calendar' : getCategoryIcon(expense.category, expense.type);
  const tripName = getTripById(expense.tripId)?.name;
  return (
    <View style={[styles.expenseRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.expenseIcon, { backgroundColor: expense.type === 'monthly' ? colors.accent : colors.secondary }]}>
        <Feather name={icon as React.ComponentProps<typeof Feather>['name']} size={17} color={expense.type === 'monthly' ? colors.accentForeground : colors.primary} />
      </View>
      <View style={styles.expenseCopy}>
        <Text style={[styles.expenseCategory, { color: colors.foreground }]}>{expense.category}</Text>
        <Text style={[styles.expenseMeta, { color: colors.mutedForeground }]}>
          {formatExpenseListMeta(expense, { showDate, tripName, showTrip })}
        </Text>
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
        accessibilityLabel={`Manage ${expense.category}`}
        testID={`expense-actions-${expense.id}`}
        hitSlop={10}
        onPress={() => showExpenseActions(expense, { onEdit: () => onEdit(expense), onRemove: () => onRemove(expense.id) })}
        style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.45 : 0.7 }]}
      >
        <Feather name="more-horizontal" size={19} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    expenses,
    isLoaded,
    activeTripId,
    spreadMonthlyIntoDaily,
    formatAmount,
    removeExpense,
    convertAmount,
    getTripById,
  } = useSpending();
  const [isAddVisible, setIsAddVisible] = useState(false);
  const [addType, setAddType] = useState<'daily' | 'monthly'>('daily');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isSearching = searchQuery.trim().length > 0;
  const scopedExpenses = useMemo(() => filterExpensesByTrip(expenses, activeTripId), [expenses, activeTripId]);
  const totals = useMemo(
    () => computeSpendingTotals(scopedExpenses, convertAmount, spreadMonthlyIntoDaily),
    [scopedExpenses, convertAmount, spreadMonthlyIntoDaily],
  );
  const listExpenses = useMemo(() => {
    if (isSearching) return filterExpenses(scopedExpenses, searchQuery, (tripId) => getTripById(tripId)?.name);
    return scopedExpenses.slice(0, 8);
  }, [scopedExpenses, isSearching, searchQuery, getTripById]);
  const monthName = new Date().toLocaleDateString([], { month: 'long' });
  const showTripOnRows = !activeTripId;

  const openAdd = (type: 'daily' | 'monthly') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setEditingExpense(null);
    setAddType(type);
    setIsAddVisible(true);
  };

  const closeSheet = () => {
    setIsAddVisible(false);
    setEditingExpense(null);
  };

  if (!isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={listExpenses}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <ExpenseRow
            expense={item}
            onEdit={setEditingExpense}
            onRemove={removeExpense}
            showDate={isSearching}
            showTrip={showTripOnRows}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 22) + 92, paddingHorizontal: 20 }}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>Your spending</Text>
              <TripPicker />
            </View>

            <View style={styles.summaryGroup}>
              <View style={[styles.hero, { backgroundColor: colors.navy }]}>
                <Text style={[styles.heroLabel, { color: colors.accentForeground }]}>
                  {activeTripId ? 'TRIP SPEND THIS MONTH' : 'SPENT THIS MONTH'}
                </Text>
                <Text style={[styles.heroAmount, { color: '#ffffff' }]}>{formatAmount(totals.monthlyTotal)}</Text>
                <Text style={[styles.heroMonth, { color: colors.accentForeground }]}>
                  {activeTripId ? getTripById(activeTripId)?.name ?? monthName : monthName}
                </Text>
              </View>

              <View style={[styles.stats, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  {spreadMonthlyIntoDaily ? 'TODAY INCL. BILLS' : 'SPENT TODAY'}
                </Text>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {formatAmount(spreadMonthlyIntoDaily ? totals.effectiveDailyTodayTotal : totals.dailyTodayTotal)}
                </Text>
                {spreadMonthlyIntoDaily && totals.monthlyDailyShare > 0 && (
                  <Text style={[styles.statHint, { color: colors.mutedForeground }]}>
                    Includes {formatAmount(totals.monthlyDailyShare)}/day from monthly bills
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick add</Text>
                <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Tap to log</Text>
              </View>
              <View style={styles.quickActions}>
                <Pressable
                  testID="quick-add-daily"
                  onPress={() => openAdd('daily')}
                  style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
                >
                  <View style={[styles.quickIcon, { backgroundColor: colors.primaryForeground + '26' }]}>
                    <Feather name="calendar" size={20} color={colors.primaryForeground} />
                  </View>
                  <View>
                    <Text style={[styles.quickActionTitle, { color: colors.primaryForeground }]}>Daily expense</Text>
                    <Text style={[styles.quickActionSub, { color: colors.primaryForeground + 'b3' }]}>Food, transport, more</Text>
                  </View>
                </Pressable>
                <Pressable
                  testID="quick-add-monthly"
                  onPress={() => openAdd('monthly')}
                  style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.accent, opacity: pressed ? 0.82 : 1 }]}
                >
                  <View style={[styles.quickIcon, { backgroundColor: colors.accentForeground + '18' }]}>
                    <Feather name="bar-chart-2" size={18} color={colors.accentForeground} />
                  </View>
                  <View>
                    <Text style={[styles.quickActionTitle, { color: colors.accentForeground }]}>Monthly bill</Text>
                    <Text style={[styles.quickActionSub, { color: colors.accentForeground + 'b3' }]}>Rent, internet, more</Text>
                  </View>
                </Pressable>
              </View>
              <RateFreshnessIndicator />
            </View>

            <View style={styles.section}>
              <ExpenseSearchField value={searchQuery} onChangeText={setSearchQuery} />
            </View>

            <View style={[styles.sectionHeaderRow, styles.listHeader]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {isSearching ? 'Search results' : 'Recent activity'}
              </Text>
              {listExpenses.length > 0 && (
                <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                  {listExpenses.length} {listExpenses.length === 1 ? 'entry' : 'entries'}
                  {!isSearching && scopedExpenses.length > listExpenses.length ? ` of ${scopedExpenses.length}` : ''}
                </Text>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          isSearching ? (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="search" size={22} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No matches</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Try a category, note, currency, or amount.
              </Text>
            </View>
          ) : (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="inbox" size={22} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing logged yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Your recent expenses will appear here.</Text>
            </View>
          )
        }
      />
      <QuickAddSheet
        visible={isAddVisible || !!editingExpense}
        initialType={editingExpense?.type ?? addType}
        expense={editingExpense ?? undefined}
        onClose={closeSheet}
      />
    </View>
  );
}

const SECTION = 20;
const INNER = 10;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: SECTION },
  title: { flex: 1, fontSize: 31, fontWeight: '700', letterSpacing: -0.8 },
  summaryGroup: { gap: INNER, marginBottom: SECTION },
  hero: { borderRadius: 22, padding: 20, gap: 8 },
  heroLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  heroAmount: { fontSize: 40, fontWeight: '700', letterSpacing: -1.1 },
  heroMonth: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  stats: { borderRadius: 17, borderWidth: 1, paddingVertical: 18, paddingHorizontal: 18, gap: 8 },
  statLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  statValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  statHint: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  section: { marginBottom: SECTION, gap: INNER },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  listHeader: { marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  sectionHint: { fontSize: 12, fontWeight: '500' },
  quickActions: { flexDirection: 'row', gap: INNER },
  quickAction: { flex: 1, minHeight: 106, borderRadius: 17, padding: 14, justifyContent: 'space-between' },
  quickIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickActionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  quickActionSub: { fontSize: 10, fontWeight: '500' },
  expenseRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, gap: 11 },
  expenseIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  expenseCopy: { flex: 1 },
  expenseCategory: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  expenseMeta: { fontSize: 11, fontWeight: '500' },
  expenseAmount: { fontSize: 14, fontWeight: '700' },
  expenseAmountCopy: { alignItems: 'flex-end', minWidth: 76 },
  expenseConverted: { fontSize: 10, fontWeight: '500', marginTop: 3 },
  deleteButton: { paddingLeft: 3 },
  empty: { alignItems: 'center', borderRadius: 17, borderWidth: 1, paddingVertical: 28, paddingHorizontal: 20, marginTop: 4 },
  emptyIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 5 },
  emptyText: { fontSize: 12, fontWeight: '500' },
});