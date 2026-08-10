/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#18202b',
    tint: '#ee735d',
    background: '#f7f8f5',
    foreground: '#18202b',
    card: '#ffffff',
    cardForeground: '#18202b',
    primary: '#ee735d',
    primaryForeground: '#ffffff',
    secondary: '#eef0eb',
    secondaryForeground: '#18202b',
    muted: '#eef0eb',
    mutedForeground: '#7a817c',
    accent: '#dcebe5',
    accentForeground: '#244b43',
    destructive: '#c95353',
    destructiveForeground: '#ffffff',
    border: '#e3e7e1',
    input: '#e3e7e1',
    navy: '#19333a',
    navyMuted: '#31525a',
    success: '#4e9d7c',
    warning: '#d99a53',
  },

  dark: {
    text: '#f4f6f2',
    tint: '#f28a73',
    background: '#152126',
    foreground: '#f4f6f2',
    card: '#203138',
    cardForeground: '#f4f6f2',
    primary: '#f28a73',
    primaryForeground: '#152126',
    secondary: '#2a3b40',
    secondaryForeground: '#f4f6f2',
    muted: '#2a3b40',
    mutedForeground: '#a9b4b0',
    accent: '#31534e',
    accentForeground: '#dcebe5',
    destructive: '#ef7777',
    destructiveForeground: '#152126',
    border: '#34474b',
    input: '#34474b',
    navy: '#10252b',
    navyMuted: '#63817f',
    success: '#76c39d',
    warning: '#e6b36e',
  },

  radius: 8,
};

export default colors;
