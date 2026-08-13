import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ReorderControls } from '@/components/ReorderControls';
import { ExpenseType, useSpending } from '@/context/SpendingContext';
import { useColors } from '@/hooks/useColors';
import { PROTECTED_CATEGORY } from '@/utils/categories';

type Props = {
  onMessage?: (message: string) => void;
};

function CategoryList({
  type,
  categories,
  onRemove,
  onAdd,
  onReorder,
}: {
  type: ExpenseType;
  categories: string[];
  onRemove: (name: string) => void;
  onAdd: (name: string) => { success: boolean; message?: string };
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const colors = useColors();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const title = type === 'daily' ? 'Daily categories' : 'Monthly categories';

  const saveCategory = () => {
    const result = onAdd(newName);
    if (!result.success) {
      setError(result.message ?? 'Could not add category.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setNewName('');
    setShowAdd(false);
    setError('');
  };

  return (
    <View style={styles.block}>
      <Text style={[styles.blockTitle, { color: colors.foreground }]}>{title}</Text>
      <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {categories.map((name, index) => (
          <View
            key={`${type}-${name}`}
            style={[styles.row, index < categories.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
          >
            <ReorderControls
              index={index}
              total={categories.length}
              testIdPrefix={`${type}-category-${name.toLowerCase().replace(/\s+/g, '-')}`}
              onMoveUp={() => onReorder(index, index - 1)}
              onMoveDown={() => onReorder(index, index + 1)}
            />
            <Text style={[styles.name, { color: colors.foreground }]}>{name}</Text>
            {name !== PROTECTED_CATEGORY ? (
              <Pressable
                testID={`remove-${type}-category-${name.toLowerCase().replace(/\s+/g, '-')}`}
                accessibilityLabel={`Remove ${name}`}
                onPress={() =>
                  Alert.alert('Remove category?', `"${name}" will be removed from your list. Existing expenses keep their category.`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => onRemove(name) },
                  ])
                }
                hitSlop={10}
                style={({ pressed }) => [styles.removeButton, { opacity: pressed ? 0.55 : 0.85 }]}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            ) : (
              <View style={styles.removeButton} />
            )}
          </View>
        ))}
      </View>
      {showAdd ? (
        <View style={styles.addRow}>
          <TextInput
            testID={`${type}-category-name-input`}
            value={newName}
            onChangeText={(value) => {
              setNewName(value);
              if (error) setError('');
            }}
            placeholder="Category name"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
            onSubmitEditing={saveCategory}
            autoFocus
          />
          <Pressable
            testID={`${type}-category-save`}
            onPress={saveCategory}
            style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
          >
            <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>Add</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          testID={`${type}-category-add-open`}
          onPress={() => setShowAdd(true)}
          style={({ pressed }) => [styles.addToggle, { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
        >
          <Feather name="plus" size={15} color={colors.primary} />
          <Text style={[styles.addToggleText, { color: colors.foreground }]}>Add category</Text>
        </Pressable>
      )}
      {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
    </View>
  );
}

export function CategorySettings({ onMessage }: Props) {
  const colors = useColors();
  const { dailyCategories, monthlyCategories, addCategory, removeCategory, reorderCategories } = useSpending();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Categories</Text>
      <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
        Reorder with the arrows. This order is used in the add-expense sheet.
      </Text>
      <CategoryList
        type="daily"
        categories={dailyCategories}
        onRemove={(name) => {
          const result = removeCategory('daily', name);
          if (!result.success) onMessage?.(result.message ?? 'Could not remove category.');
        }}
        onAdd={(name) => addCategory('daily', name)}
        onReorder={(fromIndex, toIndex) => reorderCategories('daily', fromIndex, toIndex)}
      />
      <CategoryList
        type="monthly"
        categories={monthlyCategories}
        onRemove={(name) => {
          const result = removeCategory('monthly', name);
          if (!result.success) onMessage?.(result.message ?? 'Could not remove category.');
        }}
        onAdd={(name) => addCategory('monthly', name)}
        onReorder={(fromIndex, toIndex) => reorderCategories('monthly', fromIndex, toIndex)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  sectionDescription: { fontSize: 12, lineHeight: 18 },
  block: { gap: 8 },
  blockTitle: { fontSize: 13, fontWeight: '700' },
  listCard: { borderRadius: 17, borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingRight: 8, gap: 8 },
  name: { flex: 1, fontSize: 13, fontWeight: '600' },
  removeButton: { width: 36, alignItems: 'center', justifyContent: 'center' },
  addToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 11 },
  addToggleText: { fontSize: 13, fontWeight: '600' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 13 },
  addButton: { minHeight: 44, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { fontSize: 13, fontWeight: '700' },
  error: { fontSize: 11, fontWeight: '500' },
});
