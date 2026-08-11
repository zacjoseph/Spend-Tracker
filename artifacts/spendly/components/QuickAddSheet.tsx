import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { CurrencyCode, ExpenseType, useSpending } from '@/context/SpendingContext';

type Props = {
  visible: boolean;
  initialType?: ExpenseType;
  onClose: () => void;
};

const dailyCategories = [
  { label: 'Food', icon: 'coffee' },
  { label: 'Transport', icon: 'navigation' },
  { label: 'Shopping', icon: 'shopping-bag' },
  { label: 'Health', icon: 'heart' },
  { label: 'Other', icon: 'more-horizontal' },
];

const monthlyCategories = [
  { label: 'Rent', icon: 'home' },
  { label: 'Electricity', icon: 'zap' },
  { label: 'Internet', icon: 'wifi' },
  { label: 'Phone', icon: 'smartphone' },
  { label: 'Other', icon: 'more-horizontal' },
];

export function QuickAddSheet({ visible, initialType = 'daily', onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addExpense, availableCurrencies, currencyOptions, entryCurrency, mainCurrency, convertAmount, formatAmount, setEntryCurrency } = useSpending();
  const [type, setType] = useState<ExpenseType>(initialType);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(entryCurrency);
  const [category, setCategory] = useState(initialType === 'daily' ? 'Food' : 'Rent');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setType(initialType);
    setCategory(initialType === 'daily' ? 'Food' : 'Rent');
    setError('');
  }, [visible, initialType]);

  const categories = type === 'daily' ? dailyCategories : monthlyCategories;
  const parsedAmount = Number(amount.replace(',', '.'));
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const selectedCurrency = currencyOptions.find((option) => option.code === currency);

  const switchType = (nextType: ExpenseType) => {
    setType(nextType);
    setCategory(nextType === 'daily' ? 'Food' : 'Rent');
    setError('');
  };

  const close = (nextCurrency: CurrencyCode = entryCurrency) => {
    Keyboard.dismiss();
    setAmount('');
    setNote('');
    setError('');
    setCurrency(nextCurrency);
    setType(initialType);
    setCategory(initialType === 'daily' ? 'Food' : 'Rent');
    onClose();
  };

  const save = () => {
    const parsedAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    addExpense({ type, amount: parsedAmount, currency, category, note: note.trim() });
    setEntryCurrency(currency);
    close(currency);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => close()}>
      <View style={[styles.overlay, { backgroundColor: colors.navy + '66' }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetEyebrow, { color: colors.primary }]}>QUICK ADD</Text>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Log an expense</Text>
            </View>
            <Pressable
              accessibilityLabel="Close"
              testID="close-add-expense"
              onPress={() => close()}
              style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.65 : 1 }]}
            >
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <KeyboardAwareScrollViewCompat
            bottomOffset={28}
            contentContainerStyle={styles.formContent}
            keyboardDismissMode="interactive"
          >
            <View style={[styles.typeSwitch, { backgroundColor: colors.secondary }]}>
              {(['daily', 'monthly'] as ExpenseType[]).map((option) => (
                <Pressable
                  key={option}
                  testID={`expense-type-${option}`}
                  onPress={() => switchType(option)}
                  style={[
                    styles.typeOption,
                    type === option && { backgroundColor: colors.card, shadowColor: colors.navy },
                  ]}
                >
                  <Text style={[styles.typeOptionText, { color: type === option ? colors.foreground : colors.mutedForeground }]}>
                    {option === 'daily' ? 'Daily spending' : 'Monthly bill'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>AMOUNT</Text>
            <View style={[styles.amountField, { backgroundColor: colors.card, borderColor: error ? colors.destructive : colors.border }]}>
              <Text style={[styles.currency, { color: colors.mutedForeground }]}>{selectedCurrency?.symbol ?? currency}</Text>
              <TextInput
                autoFocus
                testID="expense-amount"
                value={amount}
                onChangeText={(value) => {
                  setAmount(value);
                  if (error) setError('');
                }}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                style={[styles.amountInput, { color: colors.foreground }]}
                returnKeyType="next"
              />
            </View>
            {hasValidAmount && currency !== mainCurrency && (
              <Text style={[styles.conversionPreview, { color: colors.mutedForeground }]}>
                ≈ {formatAmount(convertAmount(parsedAmount, currency), mainCurrency)} in {mainCurrency}
              </Text>
            )}
            {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CURRENCY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencyList}>
              {availableCurrencies.map((option) => (
                <Pressable
                  key={option}
                  testID={`expense-currency-${option}`}
                  onPress={() => setCurrency(option)}
                  style={({ pressed }) => [
                    styles.currencyChip,
                    { backgroundColor: currency === option ? colors.navy : colors.card, borderColor: currency === option ? colors.navy : colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.currencyChipCode, { color: currency === option ? '#ffffff' : colors.foreground }]}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CATEGORY</Text>
            <View style={styles.categoryGrid}>
              {categories.map((item) => {
                const selected = category === item.label;
                return (
                  <Pressable
                    key={item.label}
                    testID={`category-${item.label.toLowerCase()}`}
                    onPress={() => setCategory(item.label)}
                    style={({ pressed }) => [
                      styles.category,
                      { backgroundColor: selected ? colors.accent : colors.card, borderColor: selected ? colors.success : colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name={item.icon as React.ComponentProps<typeof Feather>['name']} size={18} color={selected ? colors.accentForeground : colors.mutedForeground} />
                    <Text style={[styles.categoryText, { color: selected ? colors.accentForeground : colors.foreground }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>NOTE <Text style={{ color: colors.mutedForeground, fontWeight: '400' }}>OPTIONAL</Text></Text>
            <TextInput
              testID="expense-note"
              value={note}
              onChangeText={setNote}
              placeholder="What was this for?"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.noteInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              returnKeyType="done"
              onSubmitEditing={save}
            />

            <Pressable
              testID="save-expense"
              onPress={save}
              style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
            >
              <Feather name="check" size={19} color={colors.primaryForeground} />
              <Text style={[styles.saveText, { color: colors.primaryForeground }]}>Save expense</Text>
            </Pressable>
          </KeyboardAwareScrollViewCompat>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' },
  grabber: { alignSelf: 'center', width: 42, height: 5, borderRadius: 4, backgroundColor: '#c8cec8', marginTop: 10, marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  sheetEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, marginBottom: 5 },
  sheetTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  formContent: { padding: 22, paddingTop: 20, gap: 12 },
  typeSwitch: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 8 },
  typeOption: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingVertical: 11 },
  typeOptionText: { fontSize: 13, fontWeight: '600' },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.3, marginTop: 7, marginBottom: 2 },
  amountField: { height: 68, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 },
  currency: { fontSize: 29, fontWeight: '600', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 34, fontWeight: '700', letterSpacing: -1 },
  error: { fontSize: 12, marginTop: -5 },
  conversionPreview: { fontSize: 11, fontWeight: '600', marginTop: -5, marginLeft: 4 },
  currencyList: { gap: 8, paddingVertical: 1 },
  currencyChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  currencyChipCode: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { minWidth: '30%', flexGrow: 1, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 10 },
  categoryText: { fontSize: 12, fontWeight: '600' },
  noteInput: { minHeight: 50, borderRadius: 13, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 13, fontSize: 14 },
  saveButton: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, marginTop: 10 },
  saveText: { fontSize: 16, fontWeight: '700' },
});