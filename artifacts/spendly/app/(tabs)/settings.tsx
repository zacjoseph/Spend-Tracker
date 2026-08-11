import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrencyCode, useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';

function formatUpdated(value: string | null) {
  if (!value) return 'Using saved reference rates';
  return `Updated ${new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    mainCurrency,
    availableCurrencies,
    currencyOptions,
    setMainCurrency,
    addCustomCurrency,
    removeCurrency,
    lastRateUpdated,
    rateStatus,
    refreshRates,
  } = useSpending();
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [customError, setCustomError] = useState('');
  const [isAddingCurrency, setIsAddingCurrency] = useState(false);

  const chooseMainCurrency = (currency: CurrencyCode) => {
    Haptics.selectionAsync().catch(() => undefined);
    setMainCurrency(currency);
  };

  const currencyName = (code: CurrencyCode) => currencyOptions.find((item) => item.code === code)?.name ?? code;
  const currencySymbol = (code: CurrencyCode) => currencyOptions.find((item) => item.code === code)?.symbol ?? code;

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
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom, 22) + 84, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>PREFERENCES</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        </View>
        <View style={[styles.settingsIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="sliders" size={20} color={colors.foreground} />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Main currency</Text>
      <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
        Your totals are converted into this currency.
      </Text>
      <View style={[styles.currencyCard, { backgroundColor: colors.navy }]}>
        <View style={[styles.mainSymbol, { backgroundColor: colors.navyMuted + '4d' }]}>
          <Text style={[styles.mainSymbolText, { color: colors.accent }]}>{currencySymbol(mainCurrency)}</Text>
        </View>
        <View style={styles.mainCopy}>
          <Text style={[styles.mainCode, { color: '#ffffff' }]}>{mainCurrency}</Text>
          <Text style={[styles.mainName, { color: colors.navyMuted }]}>{currencyName(mainCurrency)}</Text>
        </View>
        <Feather name="check-circle" size={22} color={colors.accent} />
      </View>

      <View style={styles.mainOptions}>
        {availableCurrencies.map((currency) => (
          <Pressable
            key={currency}
            testID={`main-currency-${currency}`}
            onPress={() => chooseMainCurrency(currency)}
            style={({ pressed }) => [
              styles.mainOption,
              { backgroundColor: mainCurrency === currency ? colors.accent : colors.card, borderColor: mainCurrency === currency ? colors.success : colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.optionCode, { color: mainCurrency === currency ? colors.accentForeground : colors.foreground }]}>{currency}</Text>
            <Text style={[styles.optionName, { color: mainCurrency === currency ? colors.accentForeground : colors.mutedForeground }]}>{currencyName(currency)}</Text>
            {mainCurrency === currency && <Feather name="check" size={16} color={colors.accentForeground} />}
          </Pressable>
        ))}
      </View>

      <View style={styles.availableHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Available currencies</Text>
          <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>Use these when logging an expense.</Text>
        </View>
        <Text style={[styles.count, { color: colors.primary }]}>{availableCurrencies.length}</Text>
      </View>

      <View style={[styles.availableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {availableCurrencies.map((currency, index) => (
          <View key={currency} style={[styles.availableRow, index < availableCurrencies.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={[styles.currencyBadge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.currencyBadgeText, { color: colors.foreground }]}>{currency}</Text>
            </View>
            <View style={styles.availableCopy}>
              <Text style={[styles.availableName, { color: colors.foreground }]}>{currencyName(currency)}</Text>
              <Text style={[styles.availableSymbol, { color: colors.mutedForeground }]}>{currencySymbol(currency)}</Text>
            </View>
            {currency === mainCurrency ? (
              <Text style={[styles.mainLabel, { color: colors.success }]}>MAIN</Text>
            ) : (
              <Pressable testID={`remove-currency-${currency}`} accessibilityLabel={`Remove ${currency}`} onPress={() => removeCurrency(currency)} hitSlop={10}>
                <Feather name="x-circle" size={19} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <Text style={[styles.addLabel, { color: colors.mutedForeground }]}>ADD A CUSTOM CURRENCY</Text>
      <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
        Enter an ISO currency code and Spendly will fetch its live rate and symbol automatically.
      </Text>
      <View style={[styles.customCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>CODE</Text>
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
          style={[styles.customInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
        />
        <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>NAME</Text>
        <TextInput
          testID="custom-currency-name"
          value={customName}
          onChangeText={setCustomName}
          placeholder="Japanese Yen"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.customInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
        />
        <Text style={[styles.lookupHint, { color: colors.mutedForeground }]}>
          Live rate and symbol are fetched when you add it, then refreshed automatically every 6 hours.
        </Text>
        {!!customError && <Text style={[styles.customError, { color: colors.destructive }]}>{customError}</Text>}
        <Pressable
          testID="save-custom-currency"
          onPress={saveCustomCurrency}
          disabled={isAddingCurrency}
          style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary, opacity: pressed || isAddingCurrency ? 0.65 : 1 }]}
        >
          {isAddingCurrency ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="plus" size={17} color={colors.primaryForeground} />}
          <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>{isAddingCurrency ? 'Fetching rate…' : 'Fetch & add currency'}</Text>
        </Pressable>
      </View>

      <View style={[styles.ratesCard, { backgroundColor: colors.secondary }]}>
        <View style={styles.ratesCopy}>
          <Text style={[styles.ratesTitle, { color: colors.foreground }]}>Exchange rates</Text>
          <Text style={[styles.ratesMeta, { color: colors.mutedForeground }]}>{rateStatus === 'refreshing' ? 'Refreshing rates…' : rateStatus === 'error' ? 'Could not refresh. Using saved rates.' : formatUpdated(lastRateUpdated)}</Text>
        </View>
        <Pressable
          testID="refresh-rates"
          accessibilityLabel="Refresh exchange rates"
          onPress={refreshRates}
          disabled={rateStatus === 'refreshing'}
          style={({ pressed }) => [styles.refreshButton, { backgroundColor: colors.card, opacity: pressed || rateStatus === 'refreshing' ? 0.55 : 1 }]}
        >
          {rateStatus === 'refreshing' ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="refresh-cw" size={17} color={colors.primary} />}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.8 },
  settingsIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  sectionDescription: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  currencyCard: { minHeight: 84, borderRadius: 18, flexDirection: 'row', alignItems: 'center', padding: 14, marginTop: 15 },
  mainSymbol: { width: 53, height: 53, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  mainSymbolText: { fontSize: 20, fontWeight: '700' },
  mainCopy: { flex: 1, marginLeft: 13 },
  mainCode: { fontSize: 18, fontWeight: '700', marginBottom: 3 },
  mainName: { fontSize: 12, fontWeight: '500' },
  mainOptions: { gap: 8, marginTop: 10 },
  mainOption: { minHeight: 48, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  optionCode: { width: 41, fontSize: 12, fontWeight: '700' },
  optionName: { flex: 1, fontSize: 12, fontWeight: '500' },
  availableHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 30, marginBottom: 12 },
  count: { fontSize: 13, fontWeight: '700' },
  availableCard: { borderRadius: 17, borderWidth: 1, paddingHorizontal: 14 },
  availableRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 11 },
  currencyBadge: { minWidth: 50, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  currencyBadgeText: { fontSize: 11, fontWeight: '700' },
  availableCopy: { flex: 1 },
  availableName: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  availableSymbol: { fontSize: 11, fontWeight: '500' },
  mainLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  addLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.3, marginTop: 24, marginBottom: 10 },
  customCard: { borderRadius: 17, borderWidth: 1, padding: 14, marginTop: 11 },
  inputLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.1, marginBottom: 5, marginTop: 5 },
  customInput: { minHeight: 44, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, fontSize: 13 },
  lookupHint: { fontSize: 10, lineHeight: 15, marginTop: 10 },
  customError: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  addButton: { minHeight: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: 13 },
  addButtonText: { fontSize: 13, fontWeight: '700' },
  ratesCard: { minHeight: 65, borderRadius: 15, marginTop: 28, padding: 13, flexDirection: 'row', alignItems: 'center' },
  ratesCopy: { flex: 1 },
  ratesTitle: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  ratesMeta: { fontSize: 10, fontWeight: '500' },
  refreshButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});