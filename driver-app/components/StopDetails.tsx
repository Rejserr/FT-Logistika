import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSizes } from '@/constants/theme';
import type { RouteStop } from '@/types';

interface Props {
  stop: RouteStop;
}

export function StopDetails({ stop }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Detalji naloga</Text>

      <View style={styles.row}>
        <Ionicons name="document-text-outline" size={18} color={colors.textMuted} />
        <View style={styles.rowContent}>
          <Text style={styles.label}>Nalog UID</Text>
          <Text style={styles.value}>{stop.nalog_uid}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Ionicons name="person-outline" size={18} color={colors.textMuted} />
        <View style={styles.rowContent}>
          <Text style={styles.label}>Kupac</Text>
          <Text style={styles.value}>{stop.partner_naziv || '-'}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Ionicons name="location-outline" size={18} color={colors.textMuted} />
        <View style={styles.rowContent}>
          <Text style={styles.label}>Adresa</Text>
          <Text style={styles.value}>
            {stop.adresa || '-'}
            {stop.mjesto ? `, ${stop.mjesto}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Ionicons name="navigate-outline" size={18} color={colors.textMuted} />
        <View style={styles.rowContent}>
          <Text style={styles.label}>Koordinate</Text>
          <Text style={styles.value}>
            {stop.lat && stop.lng
              ? `${stop.lat.toFixed(6)}, ${stop.lng.toFixed(6)}`
              : 'Nedostupno'}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Ionicons name="time-outline" size={18} color={colors.textMuted} />
        <View style={styles.rowContent}>
          <Text style={styles.label}>ETA</Text>
          <Text style={styles.value}>
            {stop.eta ? new Date(stop.eta).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }) : '-'}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Ionicons name="flag-outline" size={18} color={colors.textMuted} />
        <View style={styles.rowContent}>
          <Text style={styles.label}>Redoslijed</Text>
          <Text style={styles.value}>Stop #{stop.redoslijed}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rowContent: {
    flex: 1,
  },
  label: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  value: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: '500',
  },
});
