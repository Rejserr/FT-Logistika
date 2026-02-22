import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RouteMap } from '@/components/RouteMap';
import { useRouteStore } from '@/stores/routeStore';
import { colors, spacing, borderRadius, fontSizes } from '@/constants/theme';
import type { RouteStop, DriverRoute } from '@/types';

export default function MapScreen() {
  const routes = useRouteStore((s) => s.routes);
  const setSelectedRoute = useRouteStore((s) => s.setSelectedRoute);

  const [selectedStop, setSelectedStop] = useState<(RouteStop & { route: DriverRoute }) | null>(null);

  // Use first active route for display, or first route
  const activeRoute = routes.find((r) => r.status === 'IN_PROGRESS') || routes[0];

  if (!activeRoute) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="map-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyText}>Nema aktivnih ruta</Text>
      </View>
    );
  }

  const handleStopPress = (stop: RouteStop) => {
    setSelectedStop({ ...stop, route: activeRoute });
  };

  const openStopDetail = () => {
    if (!selectedStop) return;
    setSelectedRoute(activeRoute);
    setSelectedStop(null);
    router.push(`/order/${selectedStop.id}`);
  };

  return (
    <View style={styles.container}>
      {/* Route selector if multiple routes */}
      {routes.length > 1 && (
        <View style={styles.routeSelector}>
          {routes.map((r, i) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.routeChip, r.id === activeRoute.id && styles.routeChipActive]}
            >
              <Text style={[styles.routeChipText, r.id === activeRoute.id && styles.routeChipTextActive]}>
                Ruta {i + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Map */}
      <RouteMap route={activeRoute} onStopPress={handleStopPress} />

      {/* Route info bar */}
      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={styles.infoText}>{activeRoute.stops.length} stopova</Text>
        </View>
        {activeRoute.distance_km && (
          <View style={styles.infoItem}>
            <Ionicons name="speedometer" size={16} color={colors.warning} />
            <Text style={styles.infoText}>{activeRoute.distance_km.toFixed(1)} km</Text>
          </View>
        )}
        {activeRoute.duration_min && (
          <View style={styles.infoItem}>
            <Ionicons name="time" size={16} color={colors.success} />
            <Text style={styles.infoText}>{activeRoute.duration_min} min</Text>
          </View>
        )}
      </View>

      {/* Stop info card (bottom sheet) */}
      {selectedStop && (
        <View style={styles.stopCard}>
          <View style={styles.stopCardHeader}>
            <View style={styles.stopCardLeft}>
              <View style={styles.stopBadge}>
                <Text style={styles.stopBadgeText}>{selectedStop.redoslijed}</Text>
              </View>
              <View>
                <Text style={styles.stopCardName} numberOfLines={1}>
                  {selectedStop.partner_naziv || 'Nepoznat'}
                </Text>
                <Text style={styles.stopCardAddress} numberOfLines={1}>
                  {selectedStop.adresa || '-'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedStop(null)}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.stopCardActions}>
            <TouchableOpacity style={styles.detailButton} onPress={openStopDetail}>
              <Ionicons name="document-text" size={18} color={colors.text} />
              <Text style={styles.detailButtonText}>Detalji</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: fontSizes.lg,
    color: colors.textSecondary,
  },
  routeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  routeChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.cardHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  routeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  routeChipText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  routeChipTextActive: {
    color: colors.text,
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.card,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  stopCard: {
    position: 'absolute',
    bottom: 56,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stopCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stopCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  stopBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBadgeText: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.primary,
  },
  stopCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  stopCardAddress: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  stopCardActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  detailButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  detailButtonText: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
});
