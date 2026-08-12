import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrencyCode, useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';
import { summarizeBackup, parseBackup, type SpendlyBackup } from '@/utils/backup';
import { exportBackupFile, pickBackupFile } from '@/utils/backupFile';

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
    ratesToUsd,
    setMainCurrency,
    addCustomCurrency,
    removeCurrency,
    lastRateUpdated,
    rateStatus,
    refreshRates,
    createBackup,
    importBackup,
    clearAllExpenses,
    expenses,
    spreadMonthlyIntoDaily,
    setSpreadMonthlyIntoDaily,
  } = useSpending();
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [customError, setCustomError] = useState('');
  const [isAddingCurrency, setIsAddingCurrency] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');

  const chooseMainCurrency = (currency: CurrencyCode) => {
    Haptics.selectionAsync().catch(() => undefined);
    setMainCurrency(currency);
  };

  const currencyName = (code: CurrencyCode) => currencyOptions.find((item) => item.code === code)?.name ?? code;
  const currencySymbol = (code: CurrencyCode) => currencyOptions.find((item) => item.code === code)?.symbol ?? code;
  const formatRate = (value: number) => {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString('en-US', { maximumFractionDigits: value < 0.01 ? 6 : value < 1 ? 4 : 2 });
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
  };

  const exportData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setBackupMessage('');
    const result = await exportBackupFile(createBackup());
    setIsExporting(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setBackupMessage(`Exported ${expenses.length} expenses as JSON.`);
      return;
    }
    setBackupMessage(result.message);
  };

  const finishImport = (mode: 'replace' | 'merge', backup: SpendlyBackup) => {
    const result = importBackup(backup, mode);
    setIsImporting(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    setBackupMessage(result.message);
  };

  const importData = async () => {
    if (isImporting) return;
    setIsImporting(true);
    setBackupMessage('');
    const picked = await pickBackupFile();
    if (!picked.success) {
      setIsImporting(false);
      if (picked.message !== 'Import canceled.') setBackupMessage(picked.message);
      return;
    }

    const parsed = parseBackup(picked.content);
    if (!parsed.success) {
      setIsImporting(false);
      setBackupMessage(parsed.message);
      return;
    }

    const summary = summarizeBackup(parsed.backup);
    Alert.alert(
      'Import backup?',
      `Found ${summary.expenseCount} expenses exported on ${summary.dateLabel}. Replace everything on this device, or merge in only new expenses?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setIsImporting(false) },
        {
          text: 'Merge',
          onPress: () => finishImport('merge', parsed.backup),
        },
        {
          text: 'Replace all',
          style: 'destructive',
          onPress: () => finishImport('replace', parsed.backup),
        },
      ],
    );
  };

  const confirmDeleteAllExpenses = () => {
    if (!expenses.length) {
      setBackupMessage('There are no expenses to delete.');
      return;
    }

    Alert.alert(
      'Delete all expenses?',
      `This will permanently remove all ${expenses.length} daily and monthly entries from this device. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Every expense will be erased from this phone. Export a backup first if you want to keep a copy.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete everything',
                  style: 'destructive',
                  onPress: () => {
                    clearAllExpenses();
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
                    setBackupMessage('All expenses have been deleted.');
                  },
                },
              ],
            );
          },
        },
      ],
    );
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

      <View style={styles.ratesHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Exchange rates</Text>
          <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>Compared with your main currency.</Text>
        </View>
        <Text style={[styles.ratesUpdated, { color: colors.mutedForeground }]}>{rateStatus === 'refreshing' ? 'Updating…' : formatUpdated(lastRateUpdated)}</Text>
      </View>
      <View style={[styles.rateList, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {availableCurrencies.map((currency, index) => {
          const mainRateToUsd = ratesToUsd[mainCurrency] ?? 1;
          const currencyRateToUsd = ratesToUsd[currency] ?? 1;
          const mainToCurrency = mainRateToUsd / currencyRateToUsd;
          return (
            <View key={`rate-${currency}`} style={[styles.rateRow, index < availableCurrencies.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <View style={[styles.rateBadge, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.rateBadgeText, { color: colors.foreground }]}>{currency}</Text>
              </View>
              <View style={styles.rateCopy}>
                <Text style={[styles.rateTitle, { color: colors.foreground }]}>1 {mainCurrency} = {formatRate(mainToCurrency)} {currency}</Text>
                <Text style={[styles.rateMeta, { color: colors.mutedForeground }]}>{currencyName(currency)}</Text>
              </View>
            </View>
          );
        })}
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
          <Text style={[styles.ratesTitle, { color: colors.foreground }]}>Refresh exchange rates</Text>
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

      <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 30 }]}>Daily view</Text>
      <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
        Spread this month’s bills evenly across each day so daily totals reflect your true cost of living.
      </Text>
      <View style={[styles.spreadCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.spreadCopy}>
          <Text style={[styles.spreadTitle, { color: colors.foreground }]}>Include monthly bills in daily totals</Text>
          <Text style={[styles.spreadMeta, { color: colors.mutedForeground }]}>
            Rent logged on the 15th still counts for the whole month — divided by days in that month, not only payment day.
          </Text>
        </View>
        <Switch
          testID="spread-monthly-toggle"
          accessibilityLabel="Include monthly bills in daily totals"
          value={spreadMonthlyIntoDaily}
          onValueChange={(value) => {
            Haptics.selectionAsync().catch(() => undefined);
            setSpreadMonthlyIntoDaily(value);
          }}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#ffffff"
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 30 }]}>Backup & restore</Text>
      <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
        Save a JSON backup to move data between phones or keep a copy while traveling. JSON keeps expenses, currencies, and exchange rates together.
      </Text>
      <View style={[styles.backupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          testID="export-backup"
          accessibilityLabel="Export backup"
          onPress={exportData}
          disabled={isExporting || isImporting}
          style={({ pressed }) => [styles.backupButton, { backgroundColor: colors.secondary, opacity: pressed || isExporting ? 0.65 : 1 }]}
        >
          {isExporting ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="upload" size={17} color={colors.primary} />}
          <View style={styles.backupCopy}>
            <Text style={[styles.backupTitle, { color: colors.foreground }]}>Export backup</Text>
            <Text style={[styles.backupMeta, { color: colors.mutedForeground }]}>{expenses.length} expenses · JSON file</Text>
          </View>
        </Pressable>
        <View style={[styles.backupDivider, { backgroundColor: colors.border }]} />
        <Pressable
          testID="import-backup"
          accessibilityLabel="Import backup"
          onPress={importData}
          disabled={isExporting || isImporting}
          style={({ pressed }) => [styles.backupButton, { backgroundColor: colors.secondary, opacity: pressed || isImporting ? 0.65 : 1 }]}
        >
          {isImporting ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="download" size={17} color={colors.primary} />}
          <View style={styles.backupCopy}>
            <Text style={[styles.backupTitle, { color: colors.foreground }]}>Import backup</Text>
            <Text style={[styles.backupMeta, { color: colors.mutedForeground }]}>Replace all data or merge new expenses</Text>
          </View>
        </Pressable>
      </View>
      {!!backupMessage && <Text style={[styles.backupMessage, { color: colors.mutedForeground }]}>{backupMessage}</Text>}

      <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 30 }]}>Data</Text>
      <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
        Permanently remove all logged expenses from this device.
      </Text>
      <Pressable
        testID="delete-all-expenses"
        accessibilityLabel="Delete all expenses"
        onPress={confirmDeleteAllExpenses}
        disabled={!expenses.length}
        style={({ pressed }) => [
          styles.deleteAllButton,
          {
            backgroundColor: colors.card,
            borderColor: colors.destructive,
            opacity: pressed ? 0.7 : expenses.length ? 1 : 0.45,
          },
        ]}
      >
        <Feather name="trash-2" size={17} color={colors.destructive} />
        <View style={styles.backupCopy}>
          <Text style={[styles.deleteAllTitle, { color: colors.destructive }]}>Delete all expenses</Text>
          <Text style={[styles.backupMeta, { color: colors.mutedForeground }]}>
            {expenses.length ? `${expenses.length} entries will be removed` : 'No expenses to delete'}
          </Text>
        </View>
      </Pressable>
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
  ratesHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 30, marginBottom: 12 },
  ratesUpdated: { fontSize: 9, fontWeight: '500', maxWidth: 125, textAlign: 'right' },
  rateList: { borderRadius: 17, borderWidth: 1, paddingHorizontal: 14 },
  rateRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rateBadge: { minWidth: 50, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  rateBadgeText: { fontSize: 11, fontWeight: '700' },
  rateCopy: { flex: 1 },
  rateTitle: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  rateMeta: { fontSize: 10, fontWeight: '500' },
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
  spreadCard: {
    borderRadius: 17,
    borderWidth: 1,
    marginTop: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spreadCopy: { flex: 1 },
  spreadTitle: { fontSize: 13, fontWeight: '700', marginBottom: 5 },
  spreadMeta: { fontSize: 10, fontWeight: '500', lineHeight: 15 },
  backupCard: { borderRadius: 17, borderWidth: 1, marginTop: 15, overflow: 'hidden' },
  backupButton: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  backupCopy: { flex: 1 },
  backupTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  backupMeta: { fontSize: 10, fontWeight: '500', lineHeight: 15 },
  backupDivider: { height: 1 },
  backupMessage: { fontSize: 11, lineHeight: 16, marginTop: 10 },
  deleteAllButton: { minHeight: 68, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 15 },
  deleteAllTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
});