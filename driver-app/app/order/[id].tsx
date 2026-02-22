import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/services/api';
import { useRouteStore } from '@/stores/routeStore';
import { StopDetails } from '@/components/StopDetails';
import {
  colors,
  spacing,
  borderRadius,
  fontSizes,
  statusColors,
} from '@/constants/theme';
import type { RouteStop } from '@/types';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stopId = parseInt(id!, 10);

  const selectedRoute = useRouteStore((s) => s.selectedRoute);
  const updateStopStatus = useRouteStore((s) => s.updateStopStatus);

  const stop = selectedRoute?.stops.find((s) => s.id === stopId);
  const [loading, setLoading] = useState(false);

  if (!stop) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={colors.danger} />
        <Text style={styles.errorText}>Stop nije pronađen</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Natrag</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cfg = statusColors[stop.status] || statusColors.PENDING;

  const handleStatusUpdate = async (newStatus: RouteStop['status']) => {
    setLoading(true);
    try {
      await apiFetch(`/driver/stop/${stopId}/status?new_status=${newStatus}`, {
        method: 'PUT',
      });
      updateStopStatus(stopId, newStatus);
    } catch (e: any) {
      Alert.alert('Greška', 'Nije moguće ažurirati status.');
    } finally {
      setLoading(false);
    }
  };

  const openNavigation = () => {
    if (!stop.lat || !stop.lng) {
      Alert.alert('Greška', 'Koordinate nisu dostupne za ovaj nalog.');
      return;
    }

    const label = encodeURIComponent(stop.partner_naziv || 'Dostava');
    const url = Platform.select({
      android: `google.navigation:q=${stop.lat},${stop.lng}`,
      ios: `maps:?daddr=${stop.lat},${stop.lng}&dirflg=d`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`,
    });

    Linking.openURL(url!).catch(() => {
      // Fallback to browser
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`,
      );
    });
  };

  const goToPOD = () => {
    router.push(`/pod/${stopId}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Status banner */}
      <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>

      {/* Mini map placeholder */}
      {stop.lat && stop.lng && (
        <View style={styles.mapContainer}>
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={40} color={colors.textMuted} />
            <Text style={styles.mapPlaceholderText}>
              {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
            </Text>
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionRow}>
        {stop.status === 'PENDING' && (
          <>
            <TouchableOpacity style={styles.navButton} onPress={openNavigation}>
              <Ionicons name="navigate" size={20} color={colors.text} />
              <Text style={styles.navButtonText}>Navigacija</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.arrivedButton}
              onPress={() => handleStatusUpdate('ARRIVED')}
              disabled={loading}
            >
              <Ionicons name="flag" size={20} color={colors.text} />
              <Text style={styles.arrivedButtonText}>Stigao sam</Text>
            </TouchableOpacity>
          </>
        )}

        {stop.status === 'ARRIVED' && (
          <>
            <TouchableOpacity style={styles.navButton} onPress={openNavigation}>
              <Ionicons name="navigate" size={20} color={colors.text} />
              <Text style={styles.navButtonText}>Navigacija</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.podButton} onPress={goToPOD}>
              <Ionicons name="camera" size={20} color={colors.text} />
              <Text style={styles.podButtonText}>Dokaz dostave</Text>
            </TouchableOpacity>
          </>
        )}

        {(stop.status === 'DELIVERED' || stop.status === 'FAILED') && (
          <View style={styles.completedBanner}>
            <Ionicons
              name={stop.status === 'DELIVERED' ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={stop.status === 'DELIVERED' ? colors.success : colors.danger}
            />
            <Text style={styles.completedText}>
              {stop.status === 'DELIVERED' ? 'Dostava završena' : 'Dostava neuspjela'}
            </Text>
          </View>
        )}
      </View>

      {/* Stop details */}
      <StopDetails stop={stop} />

      {/* Reject button */}
      {(stop.status === 'PENDING' || stop.status === 'ARRIVED') && (
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => {
            Alert.alert(
              'Odbij dostavu',
              'Jeste li sigurni da želite odbiti ovu dostavu?',
              [
                { text: 'Odustani', style: 'cancel' },
                {
                  text: 'Odbij',
                  style: 'destructive',
                  onPress: () => handleStatusUpdate('FAILED'),
                },
              ],
            );
          }}
        >
          <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.rejectText}>Odbij dostavu</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  statusBanner: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  statusText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mapContainer: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    height: 160,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapPlaceholderText: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  navButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  arrivedButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.warning,
    borderRadius: borderRadius.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  arrivedButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  podButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  podButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  completedBanner: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
  },
  completedText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rejectButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  rejectText: {
    color: colors.danger,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: fontSizes.xl,
    color: colors.textSecondary,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
  },
  backButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
});
