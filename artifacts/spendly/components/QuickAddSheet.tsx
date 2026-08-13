import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { CurrencyCode, Expense, ExpenseType, useSpending } from '@/context/SpendingContext';
import { formatAmountInput, parseAmountInput } from '@/utils/amountInput';
import {
  categoriesInclude,
  defaultCategoryForType,
  PROTECTED_CATEGORY,
} from '@/utils/categories';
import { formatExpenseDateLabel, startOfLocalDay } from '@/utils/expenseDate';

type Props = {
  visible: boolean;
  initialType?: ExpenseType;
  initialDate?: Date;
  expense?: Expense;
  onClose: () => void;
};

export function QuickAddSheet({ visible, initialType = 'daily', initialDate, expense, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isEditing = !!expense;
  const {
    addExpense,
    updateExpense,
    addCategory,
    removeCategory,
    availableCurrencies,
    currencyOptions,
    dailyCategories,
    monthlyCategories,
    trips,
    activeTripId,
    entryCurrency,
    mainCurrency,
    convertAmount,
    formatAmount,
    setEntryCurrency,
  } = useSpending();
  const [type, setType] = useState<ExpenseType>(initialType);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(entryCurrency);
  const [category, setCategory] = useState(() => defaultCategoryForType(initialType, dailyCategories, monthlyCategories));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => startOfLocalDay(initialDate ?? new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [tripId, setTripId] = useState<string | null>(null);
  const showCurrencyControl = availableCurrencies.length > 1;
  const showTripControl = trips.length > 0;
  const defaultTripIdForType = (expenseType: ExpenseType) =>
    expenseType === 'daily' ? activeTripId : null;

  const categories = type === 'daily' ? dailyCategories : monthlyCategories;
  const displayCategories =
    category && !categoriesInclude(categories, category) ? [...categories, category] : categories;
  const parsedAmount = parseAmountInput(amount);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const currencySymbol = currencyOptions.find((option) => option.code === currency)?.symbol ?? currency;

  useEffect(() => {
    if (!visible) return;
    if (expense) {
      setType(expense.type);
      setAmount(formatAmountInput(String(expense.amount)));
      setCurrency(expense.currency);
      setCategory(expense.category);
      setNote(expense.note);
      setTripId(expense.tripId ?? null);
      setExpenseDate(startOfLocalDay(new Date(expense.date)));
    } else {
      setType(initialType);
      setCategory(defaultCategoryForType(initialType, dailyCategories, monthlyCategories));
      setAmount('');
      setNote('');
      setCurrency(entryCurrency);
      setTripId(defaultTripIdForType(initialType));
      setExpenseDate(startOfLocalDay(initialDate ?? new Date()));
    }
    setShowDatePicker(false);
    setShowCurrencyPicker(false);
    setShowAddCategory(false);
    setNewCategoryName('');
    setCategoryError('');
    setError('');
  }, [visible, initialType, initialDate, expense, entryCurrency, dailyCategories, monthlyCategories, activeTripId, trips.length]);

  const switchType = (nextType: ExpenseType) => {
    setType(nextType);
    setCategory(defaultCategoryForType(nextType, dailyCategories, monthlyCategories));
    setTripId(defaultTripIdForType(nextType));
    setShowAddCategory(false);
    setNewCategoryName('');
    setCategoryError('');
    setError('');
  };

  const close = (nextCurrency: CurrencyCode = entryCurrency) => {
    Keyboard.dismiss();
    setAmount('');
    setNote('');
    setError('');
    setCategoryError('');
    setCurrency(nextCurrency);
    setType(initialType);
    setCategory(defaultCategoryForType(initialType, dailyCategories, monthlyCategories));
    setTripId(defaultTripIdForType(initialType));
    setExpenseDate(startOfLocalDay(initialDate ?? new Date()));
    setShowDatePicker(false);
    setShowCurrencyPicker(false);
    setShowAddCategory(false);
    setNewCategoryName('');
    onClose();
  };

  const handleDateChange = (event: DateTimePickerEvent, nextDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed' || !nextDate) return;
    setExpenseDate(startOfLocalDay(nextDate));
  };

  const saveNewCategory = () => {
    const result = addCategory(type, newCategoryName);
    if (!result.success) {
      setCategoryError(result.message ?? 'Could not add category.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (result.name) setCategory(result.name);
    setNewCategoryName('');
    setShowAddCategory(false);
    setCategoryError('');
  };

  const confirmRemoveCategory = (label: string) => {
    if (label === PROTECTED_CATEGORY) return;
    Alert.alert('Remove category?', `"${label}" will be removed from your list. Existing expenses keep their category.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const result = removeCategory(type, label);
          if (!result.success) {
            setCategoryError(result.message ?? 'Could not remove category.');
            return;
          }
          Haptics.selectionAsync().catch(() => undefined);
          if (category === label) {
            setCategory(defaultCategoryForType(type, dailyCategories, monthlyCategories));
          }
          setCategoryError('');
        },
      },
    ]);
  };

  const save = () => {
    const parsed = parseAmountInput(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    const payload = { type, amount: parsed, currency, category, note: note.trim(), date: expenseDate, tripId };
    if (isEditing && expense) {
      updateExpense({ ...payload, id: expense.id });
      close(currency);
      return;
    }
    addExpense(payload);
    setEntryCurrency(currency);
    close(currency);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => close()}>
      <View style={[styles.overlay, { backgroundColor: colors.navy + '66' }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetEyebrow, { color: colors.primary }]}>{isEditing ? 'EDIT' : 'QUICK ADD'}</Text>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{isEditing ? 'Edit expense' : 'Log an expense'}</Text>
            </View>
            <Pressable
              accessibilityLabel="Close"
              testID={isEditing ? 'close-edit-expense' : 'close-add-expense'}
              onPress={() => close()}
              style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.65 : 1 }]}
            >
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <KeyboardAwareScrollViewCompat
            style={styles.formScroll}
            bottomOffset={112}
            contentContainerStyle={styles.formContent}
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.typeSwitch, { backgroundColor: colors.secondary }]}>
              {(['daily', 'monthly'] as ExpenseType[]).map((option) => (
                <Pressable
                  key={option}
                  testID={`expense-type-${option}`}
                  onPress={() => switchType(option)}
                  style={[styles.typeOption, type === option && { backgroundColor: colors.card }]}
                >
                  <Text style={[styles.typeOptionText, { color: type === option ? colors.foreground : colors.mutedForeground }]}>
                    {option === 'daily' ? 'Daily' : 'Monthly'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={[styles.amountField, { backgroundColor: colors.card, borderColor: error ? colors.destructive : colors.border }]}>
              <Text style={[styles.amountSymbol, { color: colors.mutedForeground }]}>{currencySymbol}</Text>
              <TextInput
                autoFocus={!isEditing}
                testID="expense-amount"
                value={amount}
                onChangeText={(value) => {
                  setAmount(formatAmountInput(value));
                  if (error) setError('');
                }}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                style={[styles.amountInput, { color: colors.foreground }]}
              />
              {showCurrencyControl && (
                <Pressable
                  testID="expense-currency-toggle"
                  accessibilityLabel="Change currency"
                  onPress={() => setShowCurrencyPicker((current) => !current)}
                  style={({ pressed }) => [
                    styles.currencyChip,
                    { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.currencyChipText, { color: colors.foreground }]}>{currency}</Text>
                  <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            {showCurrencyControl && showCurrencyPicker && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencyList}>
                {availableCurrencies.map((option) => (
                  <Pressable
                    key={option}
                    testID={`expense-currency-${option}`}
                    onPress={() => {
                      setCurrency(option);
                      setShowCurrencyPicker(false);
                      Haptics.selectionAsync().catch(() => undefined);
                    }}
                    style={({ pressed }) => [
                      styles.currencyOption,
                      {
                        backgroundColor: currency === option ? colors.navy : colors.card,
                        borderColor: currency === option ? colors.navy : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.currencyOptionText, { color: currency === option ? '#ffffff' : colors.foreground }]}>{option}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {hasValidAmount && currency !== mainCurrency && (
              <Text style={[styles.conversionPreview, { color: colors.mutedForeground }]}>
                ≈ {formatAmount(convertAmount(parsedAmount, currency), mainCurrency)} in {mainCurrency}
              </Text>
            )}

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Category</Text>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Long-press to remove</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
              {displayCategories.map((label) => {
                const selected = category === label;
                return (
                  <Pressable
                    key={label}
                    testID={`category-${label.toLowerCase().replace(/\s+/g, '-')}`}
                    onPress={() => setCategory(label)}
                    onLongPress={() => confirmRemoveCategory(label)}
                    delayLongPress={350}
                    style={({ pressed }) => [
                      styles.categoryChip,
                      {
                        backgroundColor: selected ? colors.accent : colors.card,
                        borderColor: selected ? colors.success : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.categoryChipText, { color: selected ? colors.accentForeground : colors.foreground }]}>{label}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                testID="category-add"
                accessibilityLabel="Add category"
                onPress={() => {
                  setShowAddCategory((current) => !current);
                  setCategoryError('');
                }}
                style={({ pressed }) => [
                  styles.addCategoryChip,
                  { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name={showAddCategory ? 'minus' : 'plus'} size={16} color={colors.primary} />
              </Pressable>
            </ScrollView>

            {showAddCategory && (
              <View style={styles.addCategoryRow}>
                <TextInput
                  testID="category-name-input"
                  value={newCategoryName}
                  onChangeText={(value) => {
                    setNewCategoryName(value);
                    if (categoryError) setCategoryError('');
                  }}
                  placeholder="New category"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.addCategoryInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  returnKeyType="done"
                  onSubmitEditing={saveNewCategory}
                  autoFocus
                />
                <Pressable
                  testID="category-save"
                  onPress={saveNewCategory}
                  style={({ pressed }) => [styles.addCategoryButton, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
                >
                  <Text style={[styles.addCategoryButtonText, { color: colors.primaryForeground }]}>Add</Text>
                </Pressable>
              </View>
            )}
            {!!categoryError && <Text style={[styles.inlineError, { color: colors.destructive }]}>{categoryError}</Text>}

            {showTripControl && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Trip</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tripList}>
                  <Pressable
                    testID="trip-none"
                    onPress={() => setTripId(null)}
                    style={({ pressed }) => [
                      styles.tripChip,
                      {
                        backgroundColor: tripId === null ? colors.accent : colors.card,
                        borderColor: tripId === null ? colors.success : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.tripChipText, { color: tripId === null ? colors.accentForeground : colors.foreground }]}>None</Text>
                  </Pressable>
                  {trips.map((trip) => {
                    const selected = tripId === trip.id;
                    return (
                      <Pressable
                        key={trip.id}
                        testID={`trip-${trip.id}`}
                        onPress={() => setTripId(trip.id)}
                        style={({ pressed }) => [
                          styles.tripChip,
                          {
                            backgroundColor: selected ? colors.accent : colors.card,
                            borderColor: selected ? colors.success : colors.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.tripChipText, { color: selected ? colors.accentForeground : colors.foreground }]}>{trip.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Date</Text>
            <Pressable
              testID="expense-date-toggle"
              accessibilityLabel="Change expense date"
              onPress={() => setShowDatePicker((current) => !current)}
              style={({ pressed }) => [
                styles.dateButton,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="calendar" size={18} color={colors.primary} />
              <Text style={[styles.dateButtonText, { color: colors.foreground }]}>{formatExpenseDateLabel(expenseDate)}</Text>
              <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
            </Pressable>

            {showDatePicker && (
              <DateTimePicker
                testID="expense-date-picker"
                value={expenseDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                style={styles.datePicker}
              />
            )}

            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Note</Text>
            <TextInput
              testID="expense-note"
              value={note}
              onChangeText={setNote}
              placeholder="Optional details"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.noteInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              returnKeyType="done"
              onSubmitEditing={save}
            />
          </KeyboardAwareScrollViewCompat>

          <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
            <Pressable
              testID={isEditing ? 'save-expense-edit' : 'save-expense'}
              onPress={save}
              style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
            >
              <Feather name="check" size={19} color={colors.primaryForeground} />
              <Text style={[styles.saveText, { color: colors.primaryForeground }]}>{isEditing ? 'Save changes' : 'Save expense'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, minHeight: '72%', maxHeight: '94%' },
  grabber: { alignSelf: 'center', width: 42, height: 5, borderRadius: 4, backgroundColor: '#c8cec8', marginTop: 10, marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, marginBottom: 8 },
  sheetEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginBottom: 4 },
  sheetTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  formScroll: { flexShrink: 1 },
  formContent: { paddingHorizontal: 22, paddingBottom: 16, gap: 14 },
  typeSwitch: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  typeOption: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingVertical: 12 },
  typeOptionText: { fontSize: 14, fontWeight: '600' },
  amountField: { minHeight: 74, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 12, gap: 10 },
  amountSymbol: { fontSize: 14, fontWeight: '700', minWidth: 36 },
  amountInput: { flex: 1, fontSize: 36, fontWeight: '700', letterSpacing: -1, paddingVertical: 10 },
  currencyChip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  currencyChipText: { fontSize: 12, fontWeight: '700' },
  currencyList: { gap: 8, paddingVertical: 2 },
  currencyOption: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  currencyOptionText: { fontSize: 12, fontWeight: '700' },
  conversionPreview: { fontSize: 12, fontWeight: '600', marginTop: -6, marginLeft: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 },
  sectionLabel: { fontSize: 14, fontWeight: '700' },
  sectionHint: { fontSize: 11, fontWeight: '500' },
  categoryList: { gap: 10, paddingVertical: 2 },
  categoryChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  categoryChipText: { fontSize: 13, fontWeight: '600' },
  tripList: { gap: 10, paddingVertical: 2 },
  tripChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  tripChipText: { fontSize: 13, fontWeight: '600' },
  addCategoryChip: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  addCategoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addCategoryInput: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 14 },
  addCategoryButton: { minHeight: 46, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  addCategoryButtonText: { fontSize: 14, fontWeight: '700' },
  inlineError: { fontSize: 12, fontWeight: '500', marginTop: -6 },
  dateButton: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  dateButtonText: { flex: 1, fontSize: 15, fontWeight: '600' },
  noteInput: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 14, paddingVertical: 12 },
  datePicker: { alignSelf: 'center' },
  footer: { borderTopWidth: 1, paddingHorizontal: 22, paddingTop: 14, gap: 8 },
  error: { fontSize: 12, fontWeight: '500' },
  saveButton: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  saveText: { fontSize: 16, fontWeight: '700' },
});
