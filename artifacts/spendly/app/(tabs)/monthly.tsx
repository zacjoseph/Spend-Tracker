import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuickAddSheet } from '@/components/QuickAddSheet';
import { Expense, useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const money = (value: number) => currency.format(value);

function BillRow({ expense, onRemove }: { expense: Expense; onRemove: (id: string) => void }) {
  const colors = useColors();
  const icon = expense.category === 'Rent' ? 'home' : expense.category === 'Electricity' ? 'zap' : expense.category === 'Internet' ? 'wifi' : expense.category === 'Phone' ? 'smartphone' : 'more-horizontal';
  return (
    <View style={[styles.billRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.billIcon, { backgroundColor: colors.accent }]}>
        <Feather name={icon as React.ComponentProps<typeof Feather>['name']} size={19} color={colors.accentForeground} />
      </View>
      <View style={styles.billCopy}>
        <Text style={[styles.billTitle, { color: colors.foreground }]}>{expense.category}</Text>
        <Text style={[styles.billMeta, { color: colors.mutedForeground }]}>{expense.note || 'Recurring monthly bill'}</Text>
      </View>
      <Text style={[styles.billAmount, { color: colors.foreground }]}>{money(expense.amount)}</Text>
      <Pressable
        testID={`delete-monthly-${expense.id}`}
        accessibilityLabel={`Delete ${expense.category}`}
        hitSlop={10}
        onPress={() =>
          Alert.alert('Remove bill?', 'This bill will be removed from this month.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => onRemove(expense.id) },
          ])
        }
      >
        <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

export default function MonthlyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { expenses, monthlyBillsTotal, removeExpense } = useSpending();
  const [isAddVisible, setIsAddVisible] = useState(false);
  const monthName = new Date().toLocaleDateString([], { month: 'long' });
  const bills = useMemo(() => expenses.filter((expense) => expense.type === 'monthly'), [expenses]);

  const openAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setIsAddVisible(true);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={bills}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BillRow expense={item} onRemove={removeExpense} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom, 22) + 92, paddingHorizontal: 20 }}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>RECURRING COSTS</Text>
                <Text style={[styles.title, { color: colors.foreground }]}>Monthly bills</Text>
              </View>
              <Pressable
                testID="add-monthly-bill"
                accessibilityLabel="Add monthly bill"
                onPress={openAdd}
                style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 }]}
              >
                <Feather name="plus" size={21} color={colors.primaryForeground} />
              </Pressable>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.accent }]}>
              <View>
                <Text style={[styles.summaryLabel, { color: colors.accentForeground + 'b3' }]}>BILLS THIS MONTH</Text>
                <Text style={[styles.summaryAmount, { color: colors.accentForeground }]}>{money(monthlyBillsTotal)}</Text>
              </View>
              <View style={[styles.summaryIcon, { backgroundColor: colors.accentForeground + '17' }]}>
                <Feather name="repeat" size={20} color={colors.accentForeground} />
              </View>
            </View>
            <View style={styles.listHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your bills</Text>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{monthName}</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="calendar" size={22} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No monthly bills yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Add rent, utilities, and other recurring costs.</Text>
            <Pressable testID="empty-add-monthly" onPress={openAdd} style={({ pressed }) => [styles.emptyButton, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.emptyButtonText, { color: colors.primary }]}>Add a bill</Text>
            </Pressable>
          </View>
        }
      />
      <QuickAddSheet visible={isAddVisible} initialType="monthly" onClose={() => setIsAddVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.8 },
  addButton: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { minHeight: 130, borderRadius: 21, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginBottom: 8 },
  summaryAmount: { fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  summaryIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionHint: { fontSize: 12, fontWeight: '500' },
  billRow: { minHeight: 76, borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 },
  billIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  billCopy: { flex: 1 },
  billTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  billMeta: { fontSize: 11, fontWeight: '500' },
  billAmount: { fontSize: 14, fontWeight: '700', marginRight: 3 },
  empty: { alignItems: 'center', borderRadius: 17, borderWidth: 1, paddingVertical: 28, paddingHorizontal: 18 },
  emptyIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 5 },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 17 },
  emptyButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  emptyButtonText: { fontSize: 12, fontWeight: '700' },
});