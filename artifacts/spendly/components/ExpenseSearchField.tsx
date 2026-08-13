import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  testID?: string;
};

export function ExpenseSearchField({ value, onChangeText, testID = 'expense-search' }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.field, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="search" size={17} color={colors.mutedForeground} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder="Search notes, categories, amounts…"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={[styles.input, { color: colors.foreground }]}
      />
      {!!value && (
        <Pressable
          testID={`${testID}-clear`}
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={8}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="x-circle" size={17} color={colors.mutedForeground} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 10 },
});
