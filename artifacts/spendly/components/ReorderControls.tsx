import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  testIdPrefix: string;
};

export function ReorderControls({ index, total, onMoveUp, onMoveDown, testIdPrefix }: Props) {
  const colors = useColors();
  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;

  return (
    <View style={styles.container}>
      <Pressable
        testID={`${testIdPrefix}-move-up`}
        accessibilityLabel="Move up"
        disabled={!canMoveUp}
        onPress={onMoveUp}
        hitSlop={6}
        style={({ pressed }) => [styles.button, { opacity: !canMoveUp ? 0.25 : pressed ? 0.55 : 0.85 }]}
      >
        <Feather name="chevron-up" size={16} color={colors.mutedForeground} />
      </Pressable>
      <Pressable
        testID={`${testIdPrefix}-move-down`}
        accessibilityLabel="Move down"
        disabled={!canMoveDown}
        onPress={onMoveDown}
        hitSlop={6}
        style={({ pressed }) => [styles.button, { opacity: !canMoveDown ? 0.25 : pressed ? 0.55 : 0.85 }]}
      >
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 28, alignItems: 'center', justifyContent: 'center', gap: 2 },
  button: { width: 28, height: 22, alignItems: 'center', justifyContent: 'center' },
});
