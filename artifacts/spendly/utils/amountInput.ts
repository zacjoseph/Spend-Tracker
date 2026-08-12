export function formatAmountInput(value: string): string {
  const raw = value.replace(/,/g, '');
  const cleaned = raw.replace(/[^\d.]/g, '');

  const dotIndex = cleaned.indexOf('.');
  const integerPart = dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex);
  const decimalPart = dotIndex === -1 ? undefined : cleaned.slice(dotIndex + 1).replace(/\./g, '');

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (decimalPart !== undefined) {
    return `${formattedInteger}.${decimalPart.slice(0, 2)}`;
  }

  if (cleaned.endsWith('.')) {
    return `${formattedInteger}.`;
  }

  return formattedInteger;
}

export function parseAmountInput(value: string): number {
  return Number(value.replace(/,/g, ''));
}
