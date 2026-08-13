import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ReorderControls } from '@/components/ReorderControls';
import { CurrencyCode, useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';
import { formatUpdated } from '@/utils/rateFreshness';

type Props = {
  onMessage?: (message: string) => void;
};

export function CurrencySettings({ onMessage }: Props) {
  const colors = useColors();
  const {
    mainCurrency,
    availableCurrencies,
    currencyOptions,
    ratesToUsd,
    setMainCurrency,
    addCustomCurrency,
    removeCurrency,
    reorderCurrency,
    lastRateUpdated,
    rateStatus,
    refreshRates,
  } = useSpending();
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [customError, setCustomError] = useState('');
  const [isAddingCurrency, setIsAddingCurrency] = useState(false);
  const [showAddCurrency, setShowAddCurrency] = useState(false);

  const currencyName = (code: CurrencyCode) => currencyOptions.find((item) => item.code === code)?.name ?? code;
  const formatRate = (value: number) => {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString('en-US', { maximumFractionDigits: value < 0.01 ? 6 : value < 1 ? 4 : 2 });
  };

  const chooseMainCurrency = (currency: CurrencyCode) => {
    Haptics.selectionAsync().catch(() => undefined);
    setMainCurrency(currency);
  };

  const saveCustomCurrency = async () => {
    if (isAddingCurrency) return;
    setIsAddingCurrency(true);
    setCustomError('');
    const result = await addCustomCurrency({ code: customCode, name: customName });
    setIsAddingCurrency(false);
    if (!result.success) {
      setCustomError(result.message ?? 'Could not add this currency.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setCustomCode('');
    setCustomName('');
    setCustomError('');
    setShowAddCurrency(false);
    onMessage?.(`${result.currency?.code ?? customCode} added.`);
  };

  const rateLabel = (currency: CurrencyCode) => {
    if (currency === mainCurrency) return 'Main currency';
    const mainRateToUsd = ratesToUsd[mainCurrency] ?? 1;
    const currencyRateToUsd = ratesToUsd[currency] ?? 1;
    const mainToCurrency = mainRateToUsd / currencyRateToUsd;
    return `1 ${mainCurrency} = ${formatRate(mainToCurrency)} ${currency}`;
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Currencies</Text>
      <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
        Tap a currency to set it as main. Use the arrows to reorder the list.
      </Text>

      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          {rateStatus === 'refreshing'
            ? 'Updating rates…'
            : rateStatus === 'error'
              ? 'Could not refresh · using saved rates'
              : formatUpdated(lastRateUpdated)}
        </Text>
        <Pressable
          testID="refresh-rates"
          accessibilityLabel="Refresh exchange rates"
          onPress={() => refreshRates().catch(() => undefined)}
          disabled={rateStatus === 'refreshing'}
          style={({ pressed }) => [styles.refreshButton, { backgroundColor: colors.secondary, opacity: pressed || rateStatus === 'refreshing' ? 0.55 : 1 }]}
        >
          {rateStatus === 'refreshing' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="refresh-cw" size={15} color={colors.primary} />
          )}
        </Pressable>
      </View>

      <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {availableCurrencies.map((currency, index) => {
          const isMain = currency === mainCurrency;
          return (
            <View
              key={currency}
              style={[styles.row, index < availableCurrencies.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <ReorderControls
                index={index}
                total={availableCurrencies.length}
                testIdPrefix={`currency-${currency.toLowerCase()}`}
                onMoveUp={() => reorderCurrency(index, index - 1)}
                onMoveDown={() => reorderCurrency(index, index + 1)}
              />
              <Pressable
                testID={`main-currency-${currency}`}
                accessibilityLabel={`Set ${currency} as main currency`}
                onPress={() => chooseMainCurrency(currency)}
                style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.72 : 1 }]}
              >
                <View style={[styles.badge, { backgroundColor: isMain ? colors.accent : colors.secondary }]}>
                  <Text style={[styles.badgeText, { color: isMain ? colors.accentForeground : colors.foreground }]}>{currency}</Text>
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{currencyName(currency)}</Text>
                  <Text style={[styles.rate, { color: colors.mutedForeground }]}>{rateLabel(currency)}</Text>
                </View>
                {isMain ? (
                  <View style={[styles.mainPill, { backgroundColor: colors.accent }]}>
                    <Feather name="check" size={12} color={colors.accentForeground} />
                    <Text style={[styles.mainPillText, { color: colors.accentForeground }]}>Main</Text>
                  </View>
                ) : (
                  <Feather name="circle" size={18} color={colors.border} />
                )}
              </Pressable>
              {!isMain && (
                <Pressable
                  testID={`remove-currency-${currency}`}
                  accessibilityLabel={`Remove ${currency}`}
                  onPress={() => removeCurrency(currency)}
                  hitSlop={10}
                  style={({ pressed }) => [styles.removeButton, { opacity: pressed ? 0.55 : 0.85 }]}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      <Pressable
        testID="toggle-add-currency"
        onPress={() => {
          setShowAddCurrency((current) => !current);
          setCustomError('');
        }}
        style={({ pressed }) => [styles.addToggle, { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
      >
        <Feather name={showAddCurrency ? 'minus' : 'plus'} size={16} color={colors.primary} />
        <Text style={[styles.addToggleText, { color: colors.foreground }]}>{showAddCurrency ? 'Hide add currency' : 'Add custom currency'}</Text>
      </Pressable>

      {showAddCurrency && (
        <View style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Code</Text>
          <TextInput
            testID="custom-currency-code"
            value={customCode}
            onChangeText={(value) => {
              setCustomCode(value.replace(/[^a-z]/gi, '').toUpperCase());
              setCustomError('');
            }}
            placeholder="JPY"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            maxLength={3}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
          />
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Name</Text>
          <TextInput
            testID="custom-currency-name"
            value={customName}
            onChangeText={setCustomName}
            placeholder="Japanese Yen"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
          />
          {!!customError && <Text style={[styles.error, { color: colors.destructive }]}>{customError}</Text>}
          <Pressable
            testID="save-custom-currency"
            onPress={saveCustomCurrency}
            disabled={isAddingCurrency}
            style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary, opacity: pressed || isAddingCurrency ? 0.65 : 1 }]}
          >
            {isAddingCurrency ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="plus" size={17} color={colors.primaryForeground} />}
            <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>{isAddingCurrency ? 'Fetching rate…' : 'Fetch & add'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  sectionDescription: { fontSize: 12, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  metaText: { flex: 1, fontSize: 11, fontWeight: '500' },
  refreshButton: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listCard: { borderRadius: 17, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 6 },
  rowMain: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 8, paddingVertical: 10 },
  badge: { minWidth: 50, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  copy: { flex: 1, gap: 3 },
  name: { fontSize: 13, fontWeight: '600' },
  rate: { fontSize: 11, fontWeight: '500' },
  mainPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  mainPillText: { fontSize: 10, fontWeight: '700' },
  removeButton: { width: 40, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  addToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12 },
  addToggleText: { fontSize: 13, fontWeight: '600' },
  addCard: { borderRadius: 17, borderWidth: 1, padding: 14, gap: 8 },
  inputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  input: { minHeight: 44, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, fontSize: 13 },
  error: { fontSize: 11, lineHeight: 16 },
  addButton: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: 4 },
  addButtonText: { fontSize: 13, fontWeight: '700' },
});
