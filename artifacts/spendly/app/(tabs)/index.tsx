import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuickAddSheet } from '@/components/QuickAddSheet';
import { Expense, useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function ExpenseRow({ expense, onRemove }: { expense: Expense; onRemove: (id: string) => void }) {
  const colors = useColors();
  const { formatAmount, convertAmount, mainCurrency } = useSpending();
  const icon = expense.type === 'monthly' ? 'calendar' : expense.category === 'Food' ? 'coffee' : expense.category === 'Transport' ? 'navigation' : expense.category === 'Shopping' ? 'shopping-bag' : 'circle';
  return (
    <View style={[styles.expenseRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.expenseIcon, { backgroundColor: expense.type === 'monthly' ? colors.accent : colors.secondary }]}>
        <Feather name={icon as React.ComponentProps<typeof Feather>['name']} size={17} color={expense.type === 'monthly' ? colors.accentForeground : colors.primary} />
      </View>
      <View style={styles.expenseCopy}>
        <Text style={[styles.expenseCategory, { color: colors.foreground }]}>{expense.category}</Text>
        <Text style={[styles.expenseMeta, { color: colors.mutedForeground }]}>{expense.note || (expense.type === 'monthly' ? 'Monthly bill' : formatDate(expense.date))}</Text>
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
        testID={`delete-expense-${expense.id}`}
        hitSlop={10}
        onPress={() =>
          Alert.alert('Remove expense?', 'This entry will be removed from your totals.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => onRemove(expense.id) },
          ])
        }
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
  const { expenses, isLoaded, dailyTodayTotal, monthlyTotal, formatAmount, removeExpense } = useSpending();
  const [isAddVisible, setIsAddVisible] = useState(false);
  const [addType, setAddType] = useState<'daily' | 'monthly'>('daily');
  const recent = useMemo(() => expenses.slice(0, 8), [expenses]);
  const monthName = new Date().toLocaleDateString([], { month: 'long' });

  const openAdd = (type: 'daily' | 'monthly') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setAddType(type);
    setIsAddVisible(true);
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
        data={recent}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ExpenseRow expense={item} onRemove={removeExpense} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 22) + 92, paddingHorizontal: 20 }}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting()}</Text>
                <Text style={[styles.title, { color: colors.foreground }]}>Your spending</Text>
              </View>
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={[styles.avatarText, { color: colors.accentForeground }]}>S</Text>
              </View>
            </View>

            <View style={[styles.hero, { backgroundColor: colors.navy }]}>
              <View style={styles.heroTop}>
                <View>
              <Text style={[styles.heroLabel, { color: colors.navyMuted }]}>SPENT THIS MONTH</Text>
                  <Text style={[styles.heroAmount, { color: '#ffffff' }]}>{formatAmount(monthlyTotal)}</Text>
                </View>
                <View style={[styles.heroIcon, { backgroundColor: colors.navyMuted + '33' }]}>
                  <Feather name="trending-up" size={20} color={colors.accent} />
                </View>
              </View>
              <View style={styles.heroFooter}>
                <Text style={[styles.heroMonth, { color: colors.navyMuted }]}>{monthName}</Text>
                <Text style={[styles.heroHint, { color: colors.accent }]}>Keep it simple</Text>
              </View>
            </View>

            <View style={[styles.stats, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.stat}>
                <View style={styles.statHeading}>
                  <View style={[styles.statDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>SPENT TODAY</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{formatAmount(dailyTodayTotal)}</Text>
              </View>
              <View style={[styles.todayStatIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="sun" size={18} color={colors.primary} />
              </View>
            </View>

            <View style={styles.quickHeader}>
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
                  <Feather name="plus" size={20} color={colors.primaryForeground} />
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
                  <Feather name="calendar" size={18} color={colors.accentForeground} />
                </View>
                <View>
                  <Text style={[styles.quickActionTitle, { color: colors.accentForeground }]}>Monthly bill</Text>
                  <Text style={[styles.quickActionSub, { color: colors.accentForeground + 'b3' }]}>Rent, internet, more</Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.recentHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent activity</Text>
              {recent.length > 0 && <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{recent.length} {recent.length === 1 ? 'entry' : 'entries'}</Text>}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="inbox" size={22} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing logged yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Your recent expenses will appear here.</Text>
          </View>
        }
      />
      <QuickAddSheet visible={isAddVisible} initialType={addType} onClose={() => setIsAddVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  greeting: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.8 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' },
  hero: { borderRadius: 22, padding: 20, marginBottom: 12 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginBottom: 9 },
  heroAmount: { fontSize: 37, fontWeight: '700', letterSpacing: -1.1 },
  heroIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  heroMonth: { fontSize: 12, fontWeight: '600' },
  heroHint: { fontSize: 12, fontWeight: '600' },
  stats: { flexDirection: 'row', alignItems: 'center', borderRadius: 17, borderWidth: 1, paddingVertical: 17, paddingHorizontal: 16 },
  stat: { flex: 1 },
  statDivider: { width: 1, height: 38, marginHorizontal: 14 },
  todayStatIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  statHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  statDot: { width: 7, height: 7, borderRadius: 4 },
  statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.1 },
  statValue: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  quickHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 27, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  sectionHint: { fontSize: 12, fontWeight: '500' },
  quickActions: { flexDirection: 'row', gap: 10 },
  quickAction: { flex: 1, minHeight: 106, borderRadius: 17, padding: 14, justifyContent: 'space-between' },
  quickIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickActionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  quickActionSub: { fontSize: 10, fontWeight: '500' },
  recentHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 7 },
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