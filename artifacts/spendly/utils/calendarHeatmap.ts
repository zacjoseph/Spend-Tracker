export function getFillOpacity(amount: number, maximum: number) {
  if (!amount || !maximum) return 0;
  const ratio = amount / maximum;
  return 0.34 + ratio * 0.58;
}

export function toHexAlpha(opacity: number) {
  return Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
}

export const LEGEND_OPACITIES = [0.38, 0.58, 0.78] as const;

export function getHeatmapCellColors(
  total: number,
  maximum: number,
  primaryColor: string,
  options: {
    isSelected: boolean;
    isHighlighted: boolean;
    selectedBorderColor: string;
    emptyBorderColor: string;
    highlightColor: string;
    secondaryColor: string;
    foregroundColor: string;
    primaryForeground: string;
  },
) {
  const fillOpacity = getFillOpacity(total, maximum);
  const strongFill = fillOpacity > 0.52;
  const fillBorderOpacity = total ? Math.min(fillOpacity + 0.18, 0.92) : 0;

  return {
    fillOpacity,
    strongFill,
    backgroundColor: total
      ? `${primaryColor}${toHexAlpha(fillOpacity)}`
      : options.isSelected
        ? options.secondaryColor
        : options.secondaryColor + '88',
    borderColor: options.isSelected
      ? options.selectedBorderColor
      : options.isHighlighted
        ? options.highlightColor
        : total
          ? `${primaryColor}${toHexAlpha(fillBorderOpacity)}`
          : options.emptyBorderColor,
    borderWidth: options.isSelected ? 2 : 1,
    labelColor: strongFill ? options.primaryForeground : options.foregroundColor,
    amountColor: strongFill ? options.primaryForeground : options.foregroundColor,
  };
}
