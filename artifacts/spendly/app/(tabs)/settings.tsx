import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';
import { summarizeBackup, parseBackup, type SpendlyBackup } from '@/utils/backup';
import { exportBackupFile, exportCsvFile, pickBackupFile } from '@/utils/backupFile';
import { buildExpensesCsv } from '@/utils/expenseCsv';
import { CurrencySettings } from '@/components/CurrencySettings';
import { CategorySettings } from '@/components/CategorySettings';

const privacyPolicyUrl =
  typeof Constants.expoConfig?.extra?.privacyPolicyUrl === 'string'
    ? Constants.expoConfig.extra.privacyPolicyUrl
    : undefined;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    mainCurrency,
    createBackup,
    importBackup,
    clearAllExpenses,
    expenses,
    convertAmount,
    getTripById,
    spreadMonthlyIntoDaily,
    setSpreadMonthlyIntoDaily,
    restoreDefaults,
  } = useSpending();
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');

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

  const exportCsvData = async () => {
    if (isExportingCsv || !expenses.length) return;
    setIsExportingCsv(true);
    setBackupMessage('');
    const csv = buildExpensesCsv(expenses, mainCurrency, convertAmount, (tripId) => getTripById(tripId)?.name);
    const result = await exportCsvFile(csv);
    setIsExportingCsv(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setBackupMessage(`Exported ${expenses.length} expenses as CSV.`);
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

  const confirmRestoreDefaults = () => {
    Alert.alert(
      'Restore defaults?',
      'This resets categories, currencies, main currency (USD), and the daily-view spread setting. Your expenses and trips are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            restoreDefaults();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            setBackupMessage('Defaults restored.');
          },
        },
      ],
    );
  };

  const openPrivacyPolicy = async () => {
    if (!privacyPolicyUrl) return;
    Haptics.selectionAsync().catch(() => undefined);
    await WebBrowser.openBrowserAsync(privacyPolicyUrl);
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

      <View style={styles.sectionBlock}>
        <CurrencySettings onMessage={setBackupMessage} />
      </View>

      <View style={styles.sectionBlock}>
        <CategorySettings onMessage={setBackupMessage} />
      </View>

      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Defaults</Text>
        <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
          Reset categories, currencies, and daily-view preferences to their original setup.
        </Text>
        <Pressable
          testID="restore-defaults"
          accessibilityLabel="Restore defaults"
          onPress={confirmRestoreDefaults}
          style={({ pressed }) => [styles.restoreButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
        >
          <Feather name="rotate-ccw" size={16} color={colors.primary} />
          <Text style={[styles.restoreButtonText, { color: colors.foreground }]}>Restore defaults</Text>
        </Pressable>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Daily view</Text>
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
      </View>

      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Backup & restore</Text>
      <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
        Export a JSON backup to restore on another phone, or CSV to review expenses in a spreadsheet.
      </Text>
      <View style={[styles.backupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          testID="export-backup"
          accessibilityLabel="Export backup"
          onPress={exportData}
          disabled={isExporting || isExportingCsv || isImporting}
          style={({ pressed }) => [styles.backupButton, { backgroundColor: colors.secondary, opacity: pressed || isExporting ? 0.65 : 1 }]}
        >
          {isExporting ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="upload" size={17} color={colors.primary} />}
          <View style={styles.backupCopy}>
            <Text style={[styles.backupTitle, { color: colors.foreground }]}>Export JSON backup</Text>
            <Text style={[styles.backupMeta, { color: colors.mutedForeground }]}>{expenses.length} expenses · full restore file</Text>
          </View>
        </Pressable>
        <View style={[styles.backupDivider, { backgroundColor: colors.border }]} />
        <Pressable
          testID="export-csv"
          accessibilityLabel="Export CSV"
          onPress={exportCsvData}
          disabled={isExporting || isExportingCsv || isImporting || !expenses.length}
          style={({ pressed }) => [styles.backupButton, { backgroundColor: colors.secondary, opacity: pressed || isExportingCsv || !expenses.length ? 0.65 : 1 }]}
        >
          {isExportingCsv ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="file-text" size={17} color={colors.primary} />}
          <View style={styles.backupCopy}>
            <Text style={[styles.backupTitle, { color: colors.foreground }]}>Export CSV</Text>
            <Text style={[styles.backupMeta, { color: colors.mutedForeground }]}>{expenses.length} expenses · spreadsheet friendly</Text>
          </View>
        </Pressable>
        <View style={[styles.backupDivider, { backgroundColor: colors.border }]} />
        <Pressable
          testID="import-backup"
          accessibilityLabel="Import backup"
          onPress={importData}
          disabled={isExporting || isExportingCsv || isImporting}
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
      </View>

      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Data</Text>
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
      </View>

      {!!privacyPolicyUrl && (
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
          <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
            Learn how Multi Currency Spend handles your data.
          </Text>
          <Pressable
            testID="privacy-policy-link"
            accessibilityLabel="Open privacy policy"
            onPress={openPrivacyPolicy}
            style={({ pressed }) => [
              styles.legalButton,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="shield" size={17} color={colors.primary} />
            <View style={styles.backupCopy}>
              <Text style={[styles.backupTitle, { color: colors.foreground }]}>Privacy policy</Text>
              <Text style={[styles.backupMeta, { color: colors.mutedForeground }]}>Your data stays on this device</Text>
            </View>
            <Feather name="external-link" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.8 },
  settingsIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sectionBlock: { marginTop: 28, gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  sectionDescription: { fontSize: 12, lineHeight: 18 },
  spreadCard: {
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spreadCopy: { flex: 1 },
  spreadTitle: { fontSize: 13, fontWeight: '700', marginBottom: 5 },
  spreadMeta: { fontSize: 10, fontWeight: '500', lineHeight: 15 },
  backupCard: { borderRadius: 17, borderWidth: 1, overflow: 'hidden' },
  backupButton: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  backupCopy: { flex: 1 },
  backupTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  backupMeta: { fontSize: 10, fontWeight: '500', lineHeight: 15 },
  backupDivider: { height: 1 },
  backupMessage: { fontSize: 11, lineHeight: 16 },
  deleteAllButton: { minHeight: 68, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  deleteAllTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  legalButton: { minHeight: 68, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  restoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 13 },
  restoreButtonText: { fontSize: 14, fontWeight: '700' },
});