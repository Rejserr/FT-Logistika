import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSizes, statusColors, statusLabelsShort } from '@/constants/theme';
import { useColors, type AppColors } from '@/hooks/useColors';
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
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const status = (stop.status in statusColors ? stop.status : 'PENDING') as keyof typeof statusColors;
  const cfg = statusColors[status];
  const icon = STATUS_ICONS[status] || 'time-outline';

  const formatEta = (eta: string | null) => {
    if (!eta) return '--:--';
    try {
      const d = new Date(eta);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch { return '--:--'; }
  };

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.7}>
      <View style={s.leftSection}>
        <View style={[s.stopBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[s.stopNumber, { color: cfg.color }]}>{stop.redoslijed}</Text>
        </View>
        <View style={[s.statusDot, { backgroundColor: cfg.color }]} />
      </View>
      <View style={s.content}>
        <Text style={s.partnerName} numberOfLines={1}>{stop.partner_naziv || 'Nepoznat kupac'}</Text>
        <View style={s.addressRow}>
          <Ionicons name="location-outline" size={14} color={c.textSecondary} />
          <Text style={s.address} numberOfLines={1}>{stop.adresa || 'Adresa nepoznata'}{stop.mjesto ? `, ${stop.mjesto}` : ''}</Text>
        </View>
        <View style={s.bottomRow}>
          <View style={[s.statusChip, { backgroundColor: cfg.bg }]}>
            <Ionicons name={icon} size={12} color={cfg.color} />
            <Text style={{ fontSize: fontSizes.xs, fontWeight: '600', color: cfg.color }}>{statusLabelsShort[status] || cfg.label}</Text>
          </View>
        </View>
      </View>
      <View style={s.rightSection}>
        <Text style={s.eta}>{formatEta(stop.eta)}</Text>
        <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: c.card, borderRadius: borderRadius.md, marginHorizontal: spacing.lg, marginVertical: 6, padding: spacing.md, borderWidth: 1, borderColor: c.border },
  leftSection: { alignItems: 'center', marginRight: spacing.md, gap: 6 },
  stopBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  stopNumber: { fontSize: fontSizes.lg, fontWeight: '700' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  content: { flex: 1, gap: 4 },
  partnerName: { fontSize: 15, fontWeight: '600', color: c.text },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  address: { fontSize: fontSizes.md, color: c.textSecondary, flex: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm },
  rightSection: { alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: spacing.sm },
  eta: { fontSize: fontSizes.xl, fontWeight: '700', color: c.text },
});
