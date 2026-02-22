export const colors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',

  // Unit status colors
  statusAvailable: '#22C55E',
  statusNewArrival: '#3B82F6',
  statusHold: '#F97316',
  statusSold: '#EF4444',
  statusInService: '#EAB308',
  statusArchived: '#6B7280',

  // Semantic
  success: '#22C55E',
  warning: '#F97316',
  error: '#EF4444',
  info: '#3B82F6',

  // Neutral
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Background
  background: '#FFFFFF',
  surface: '#F9FAFB',
  border: '#E5E7EB',
} as const;

export type ColorName = keyof typeof colors;
