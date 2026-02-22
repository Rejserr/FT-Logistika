import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSizes, statusColors, statusLabelsShort } from '@/constants/theme';
import type { RouteStop } from '@/types';

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  PENDING: 'time-outline',
  ARRIVED: 'location',
  DELIVERED: 'checkmark-circle',
  FAILED: 'close-circle',
  SKIPPED: 'remove-circle',
};

interface Props {
  stop: RouteStop;
  onPress: () => void;
}

export function OrderCard({ stop, onPress }: Props) {
  const status = (stop.status in statusColors ? stop.status : 'PENDING') as keyof typeof statusColors;
  const cfg = statusColors[status];
  const icon = STATUS_ICONS[status] || 'time-outline';

  const formatEta = (eta: string | null) => {
    if (!eta) return '--:--';
    try {
      const d = new Date(eta);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return '--:--';
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.leftSection}>
        <View style={[styles.stopBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.stopNumber, { color: cfg.color }]}>{stop.redoslijed}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.partnerName} numberOfLines={1}>
          {stop.partner_naziv || 'Nepoznat kupac'}
        </Text>
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.address} numberOfLines={1}>
            {stop.adresa || 'Adresa nepoznata'}
            {stop.mjesto ? `, ${stop.mjesto}` : ''}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
            <Ionicons name={icon} size={12} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{statusLabelsShort[status] || cfg.label}</Text>
          </View>
        </View>
      </View>

      <View style={styles.rightSection}>
        <Text style={styles.eta}>{formatEta(stop.eta)}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginVertical: 6,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leftSection: {
    alignItems: 'center',
    marginRight: spacing.md,
    gap: 6,
  },
  stopBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopNumber: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  partnerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  address: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: spacing.sm,
  },
  eta: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
});
