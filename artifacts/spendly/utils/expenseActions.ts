import { Alert } from 'react-native';
import type { Expense } from '@/context/SpendingContext';

export function showExpenseActions(
  expense: Expense,
  handlers: { onEdit: () => void; onRemove: () => void },
) {
  Alert.alert(expense.category, expense.note || 'What would you like to do with this entry?', [
    { text: 'Edit', onPress: handlers.onEdit },
    {
      text: 'Remove',
      style: 'destructive',
      onPress: () =>
        Alert.alert('Remove expense?', 'This entry will be removed from your totals.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: handlers.onRemove },
        ]),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
