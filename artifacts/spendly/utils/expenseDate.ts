export function startOfLocalDay(date: Date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toExpenseDateString(date: Date) {
  const local = startOfLocalDay(date);
  local.setHours(12, 0, 0, 0);
  return local.toISOString();
}

export function formatExpenseDateLabel(date: Date) {
  const today = startOfLocalDay();
  const target = startOfLocalDay(date);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';

  return target.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: target.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}
