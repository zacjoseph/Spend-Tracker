import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';
import { getRateFreshness } from '@/utils/rateFreshness';

export function RateFreshnessIndicator() {
  const colors = useColors();
  const { lastRateUpdated, rateStatus, refreshRates, availableCurrencies, mainCurrency, expenses } = useSpending();
  const usesMultipleCurrencies =
    availableCurrencies.length > 1 || expenses.some((expense) => expense.currency !== mainCurrency);

  if (!usesMultipleCurrencies) return null;

  const freshness = getRateFreshness(lastRateUpdated, rateStatus);
  const dotColor =
    freshness.tone === 'fresh'
      ? colors.success
      : freshness.tone === 'stale'
        ? colors.warning
        : freshness.tone === 'error'
          ? colors.destructive
          : colors.mutedForeground;

  const handlePress = () => {
    if (rateStatus === 'refreshing') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    refreshRates().catch(() => undefined);
  };

  return (
    <Pressable
      testID="rate-freshness-indicator"
      accessibilityLabel={`${freshness.title}. ${freshness.detail}`}
      accessibilityHint="Refreshes exchange rates"
      onPress={handlePress}
      disabled={rateStatus === 'refreshing'}
      style={({ pressed }) => [styles.container, { opacity: pressed || rateStatus === 'refreshing' ? 0.65 : 1 }]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.label, { color: colors.mutedForeground }]} numberOfLines={1}>
        {rateStatus === 'refreshing' ? 'Updating rates…' : `${freshness.title} · ${freshness.detail}`}
      </Text>
      {rateStatus === 'refreshing' ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Feather name="refresh-cw" size={12} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { flex: 1, fontSize: 11, fontWeight: '500' },
});
