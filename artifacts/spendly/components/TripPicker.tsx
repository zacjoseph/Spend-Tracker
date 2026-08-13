import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';
import { findTripById, type Trip } from '@/utils/trips';

export function TripPicker() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { trips, activeTripId, setActiveTripId, addTrip, removeTrip } = useSpending();
  const [isOpen, setIsOpen] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [tripError, setTripError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const activeTrip = findTripById(trips, activeTripId);
  const label = activeTrip ? activeTrip.name : 'All trips';

  useEffect(() => {
    if (!isOpen) {
      setShowCreate(false);
      setNewTripName('');
      setTripError('');
    }
  }, [isOpen]);

  const selectTrip = (tripId: string | null) => {
    Haptics.selectionAsync().catch(() => undefined);
    setActiveTripId(tripId);
    setIsOpen(false);
  };

  const saveTrip = () => {
    const result = addTrip(newTripName);
    if (!result.success || !result.trip) {
      setTripError(result.message ?? 'Could not create trip.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setActiveTripId(result.trip.id);
    setIsOpen(false);
  };

  const confirmDeleteTrip = (trip: Trip) => {
    Alert.alert(
      'Delete trip?',
      `"${trip.name}" will be removed. Expenses keep their amounts but lose this tag.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.selectionAsync().catch(() => undefined);
            removeTrip(trip.id);
          },
        },
      ],
    );
  };

  return (
    <>
      <Pressable
        testID="trip-picker-trigger"
        accessibilityLabel={`Active trip: ${label}`}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: colors.card,
            borderColor: activeTrip ? colors.success : colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Feather name="map-pin" size={13} color={activeTrip ? colors.success : colors.mutedForeground} />
        <Text style={[styles.triggerText, { color: colors.foreground }]} numberOfLines={1}>
          {label}
        </Text>
        <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={() => setIsOpen(false)}>
        <View style={[styles.overlay, { backgroundColor: colors.navy + '66' }]}>
          <Pressable style={styles.dismissArea} onPress={() => setIsOpen(false)} accessibilityLabel="Close trips" />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                paddingBottom: Math.max(insets.bottom, 16),
                maxHeight: '82%',
              },
            ]}
          >
            <View style={styles.grabber} />
            <KeyboardAwareScrollViewCompat
              bottomOffset={28}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}
            >
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Trips</Text>
              <Text style={[styles.sheetHint, { color: colors.mutedForeground }]}>
                Filter Home and auto-tag new daily expenses.
              </Text>

              <Pressable
                testID="trip-option-all"
                onPress={() => selectTrip(null)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: !activeTripId ? colors.accent : colors.card,
                    borderColor: !activeTripId ? colors.success : colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Feather name="globe" size={16} color={!activeTripId ? colors.accentForeground : colors.mutedForeground} />
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionTitle, { color: colors.foreground }]}>All trips</Text>
                  <Text style={[styles.optionMeta, { color: colors.mutedForeground }]}>No filter · expenses stay untagged</Text>
                </View>
              </Pressable>

              {trips.map((trip) => {
                const selected = activeTripId === trip.id;
                return (
                  <View key={trip.id} style={styles.tripRow}>
                    <Pressable
                      testID={`trip-option-${trip.id}`}
                      onPress={() => selectTrip(trip.id)}
                      style={({ pressed }) => [
                        styles.option,
                        styles.tripOption,
                        {
                          backgroundColor: selected ? colors.accent : colors.card,
                          borderColor: selected ? colors.success : colors.border,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                    >
                      <Feather name="map-pin" size={16} color={selected ? colors.accentForeground : colors.mutedForeground} />
                      <View style={styles.optionCopy}>
                        <Text style={[styles.optionTitle, { color: colors.foreground }]}>{trip.name}</Text>
                        <Text style={[styles.optionMeta, { color: colors.mutedForeground }]}>New daily expenses tag here</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      testID={`trip-delete-${trip.id}`}
                      accessibilityLabel={`Delete ${trip.name}`}
                      onPress={() => confirmDeleteTrip(trip)}
                      hitSlop={10}
                      style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.55 : 0.85 }]}
                    >
                      <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                );
              })}

              {showCreate ? (
                <View style={styles.createBlock}>
                  <TextInput
                    testID="trip-name-input"
                    value={newTripName}
                    onChangeText={(value) => {
                      setNewTripName(value);
                      if (tripError) setTripError('');
                    }}
                    placeholder="Trip name"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.createInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                    returnKeyType="done"
                    onSubmitEditing={saveTrip}
                    autoFocus
                  />
                  {!!tripError && <Text style={[styles.createError, { color: colors.destructive }]}>{tripError}</Text>}
                  <View style={styles.createActions}>
                    <Pressable
                      testID="trip-create-cancel"
                      onPress={() => {
                        setShowCreate(false);
                        setNewTripName('');
                        setTripError('');
                      }}
                      style={({ pressed }) => [styles.secondaryButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      testID="trip-create-save"
                      onPress={saveTrip}
                      style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
                    >
                      <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Create trip</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  testID="trip-create-open"
                  onPress={() => setShowCreate(true)}
                  style={({ pressed }) => [styles.newTripButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
                >
                  <Feather name="plus" size={16} color={colors.primary} />
                  <Text style={[styles.newTripText, { color: colors.foreground }]}>New trip</Text>
                </Pressable>
              )}
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    maxWidth: 148,
    flexShrink: 1,
  },
  triggerText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  grabber: { alignSelf: 'center', width: 42, height: 5, borderRadius: 4, backgroundColor: '#c8cec8', marginTop: 10, marginBottom: 8 },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 8, gap: 8 },
  sheetTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  sheetHint: { fontSize: 12, fontWeight: '500', marginBottom: 6, lineHeight: 17 },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  tripOption: { flex: 1 },
  optionCopy: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 14, fontWeight: '700' },
  optionMeta: { fontSize: 11, fontWeight: '500' },
  deleteButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  newTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  newTripText: { fontSize: 14, fontWeight: '700' },
  createBlock: { gap: 10, marginTop: 4 },
  createInput: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 14 },
  createError: { fontSize: 12, fontWeight: '500' },
  createActions: { flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },
  primaryButton: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 14, fontWeight: '700' },
});
