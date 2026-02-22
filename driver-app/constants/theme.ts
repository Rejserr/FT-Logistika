/**
 * Dark theme constants for FT Driver app (matches web app palette).
 * All exports are named.
 */

// ---- Colors ----
export const colors = {
  background: '#09090b', // zinc-950
  card: '#18181b', // zinc-900
  cardHover: '#27272a', // zinc-800
  border: '#3f3f46', // zinc-700
  borderSubtle: '#27272a', // zinc-800
  text: '#fafafa', // zinc-50
  textSecondary: '#a1a1aa', // zinc-400
  textMuted: '#71717a', // zinc-500
  primary: '#3b82f6', // blue-500, Electric Blue
  primaryDark: '#2563eb', // blue-600
  primaryLight: '#60a5fa', // blue-400
  primaryBg: 'rgba(59, 130, 246, 0.1)',
  success: '#22c55e', // green-500, Neon Green
  successBg: 'rgba(34, 197, 94, 0.1)',
  warning: '#f59e0b', // amber-500
  warningBg: 'rgba(245, 158, 11, 0.1)',
  danger: '#ef4444', // red-500
  dangerBg: 'rgba(239, 68, 68, 0.1)',
  info: '#3b82f6',
  infoBg: 'rgba(59, 130, 246, 0.1)',
} as const;

// ---- Spacing ----
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ---- Border radius ----
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

// ---- Font sizes ----
export const fontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
} as const;

// ---- Delivery status colors (pill/badge style) ----
export type DeliveryStatus = 'PENDING' | 'ARRIVED' | 'DELIVERED' | 'FAILED' | 'SKIPPED';

export const statusColors: Record<
  DeliveryStatus,
  { color: string; bg: string; label: string }
> = {
  PENDING: { color: colors.warning, bg: colors.warningBg, label: 'Čeka dostavu' },
  ARRIVED: { color: colors.primary, bg: colors.primaryBg, label: 'Na lokaciji' },
  DELIVERED: { color: colors.success, bg: colors.successBg, label: 'Dostavljeno' },
  FAILED: { color: colors.danger, bg: colors.dangerBg, label: 'Neuspjelo' },
  SKIPPED: { color: colors.textMuted, bg: colors.borderSubtle, label: 'Preskočeno' },
};

// Short labels for compact badges
export const statusLabelsShort: Record<DeliveryStatus, string> = {
  PENDING: 'Čeka',
  ARRIVED: 'Na lokaciji',
  DELIVERED: 'Dostavljeno',
  FAILED: 'Neuspjelo',
  SKIPPED: 'Preskočeno',
};
