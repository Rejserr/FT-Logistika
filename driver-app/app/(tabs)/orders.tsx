import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useRouteStore } from '@/stores/routeStore';
import { OrderCard } from '@/components/OrderCard';
import {
  colors,
  spacing,
  borderRadius,
  fontSizes,
} from '@/constants/theme';
import type { DriverRoute, RouteStop } from '@/types';

type Tab = 'todo' | 'completed';

export default function OrdersScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('todo');
  const [refreshing, setRefreshing] = useState(false);

  const user = useAuthStore((s) => s.user);

  const routes = useRouteStore((s) => s.routes);
  const selectedRoute = useRouteStore((s) => s.selectedRoute);
  const isLoading = useRouteStore((s) => s.isLoading);
  const setRoutes = useRouteStore((s) => s.setRoutes);
  const setSelectedRoute = useRouteStore((s) => s.setSelectedRoute);
  const setLoading = useRouteStore((s) => s.setLoading);
  const setError = useRouteStore((s) => s.setError);

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<DriverRoute[]>('/driver/routes');
      setRoutes(data);
      if (data.length === 1) {
        setSelectedRoute(data[0]);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRoutes();
    setRefreshing(false);
  }, [fetchRoutes]);

  const handleSelectRoute = (route: DriverRoute) => {
    setSelectedRoute(route);
    setActiveTab('todo');
  };

  const handleBackToRoutes = () => {
    setSelectedRoute(null);
  };

  const handleStopPress = (stop: RouteStop & { routeId: number }) => {
    const route = routes.find((r) => r.id === stop.routeId);
    if (route) {
      useRouteStore.getState().setSelectedRoute(route);
    }
    router.push(`/order/${stop.id}`);
  };

  // ---- Route selection view ----
  if (!selectedRoute && routes.length > 0) {
    return (
      <View style={styles.container}>
        <View style={styles.routeListHeader}>
          <Ionicons name="map-outline" size={20} color={colors.primary} />
          <Text style={styles.routeListTitle}>Odaberite rutu ({routes.length})</Text>
        </View>

        <FlatList
          data={routes}
          keyExtractor={(item) => `route-${item.id}`}
          contentContainerStyle={styles.routeList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          renderItem={({ item: route }) => {
            const pending = route.stops.filter((s) => s.status === 'PENDING' || s.status === 'ARRIVED').length;
            const done = route.stops.filter((s) => s.status === 'DELIVERED' || s.status === 'FAILED' || s.status === 'SKIPPED').length;
            const progress = route.stops.length > 0 ? done / route.stops.length : 0;

            return (
              <TouchableOpacity
                style={styles.routeCard}
                onPress={() => handleSelectRoute(route)}
                activeOpacity={0.7}
              >
                <View style={styles.routeCardHeader}>
                  <View style={styles.routeIdBadge}>
                    <Text style={styles.routeIdText}>#{route.id}</Text>
                  </View>
                  <View style={[
                    styles.routeStatusBadge,
                    { backgroundColor: route.status === 'IN_PROGRESS' ? colors.successBg : colors.primaryBg },
                  ]}>
                    <Text style={[
                      styles.routeStatusText,
                      { color: route.status === 'IN_PROGRESS' ? colors.success : colors.primary },
                    ]}>
                      {route.status === 'IN_PROGRESS' ? 'U tijeku' : 'Planirano'}
                    </Text>
                  </View>
                </View>

                {route.raspored && (
                  <View style={styles.routeDateRow}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.routeDateText}>Dostava: {route.raspored}</Text>
                  </View>
                )}

                <View style={styles.routeStatsRow}>
                  <View style={styles.routeStat}>
                    <Ionicons name="location" size={16} color={colors.warning} />
                    <Text style={styles.routeStatValue}>{pending}</Text>
                    <Text style={styles.routeStatLabel}>preostalo</Text>
                  </View>
                  <View style={styles.routeStat}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.routeStatValue}>{done}</Text>
                    <Text style={styles.routeStatLabel}>završeno</Text>
                  </View>
                  {route.distance_km != null && (
                    <View style={styles.routeStat}>
                      <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
                      <Text style={styles.routeStatValue}>{route.distance_km.toFixed(0)}</Text>
                      <Text style={styles.routeStatLabel}>km</Text>
                    </View>
                  )}
                  {route.duration_min != null && (
                    <View style={styles.routeStat}>
                      <Ionicons name="time-outline" size={16} color={colors.primaryLight} />
                      <Text style={styles.routeStatValue}>{route.duration_min}</Text>
                      <Text style={styles.routeStatLabel}>min</Text>
                    </View>
                  )}
                </View>

                {route.stops.length > 0 && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {done}/{route.stops.length} dostava
                    </Text>
                  </View>
                )}

                {route.vozilo_oznaka && (
                  <View style={styles.routeVehicleRow}>
                    <Ionicons name="car-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.routeVehicleText}>{route.vozilo_oznaka}</Text>
                  </View>
                )}

                <View style={styles.routeCardFooter}>
                  <Text style={styles.routeOpenText}>Otvori rutu</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  // ---- Stops view for selected route ----
  const stopsSource = selectedRoute ? selectedRoute.stops : [];
  const stopsWithRoute: (RouteStop & { routeId: number })[] = stopsSource.map((s) => ({
    ...s,
    routeId: selectedRoute?.id ?? 0,
  }));

  const todoStops = stopsWithRoute.filter((s) => s.status === 'PENDING' || s.status === 'ARRIVED');
  const completedStops = stopsWithRoute.filter(
    (s) => s.status === 'DELIVERED' || s.status === 'FAILED' || s.status === 'SKIPPED',
  );
  const displayStops = activeTab === 'todo' ? todoStops : completedStops;

  return (
    <View style={styles.container}>
      {/* Route header — back button if multiple routes */}
      {routes.length > 1 && selectedRoute && (
        <TouchableOpacity style={styles.routeBackBar} onPress={handleBackToRoutes} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={colors.primary} />
          <Text style={styles.routeBackText}>Sve rute</Text>
          <View style={styles.routeBackBadge}>
            <Text style={styles.routeBackBadgeText}>Ruta #{selectedRoute.id}</Text>
          </View>
          {selectedRoute.vozilo_oznaka && (
            <Text style={styles.routeBackVehicle}>{selectedRoute.vozilo_oznaka}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Stop summary */}
      {selectedRoute && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Ionicons name="location" size={16} color={colors.warning} />
            <Text style={styles.summaryText}>{todoStops.length} preostalo</Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.summaryText}>{completedStops.length} završeno</Text>
          </View>
          {selectedRoute.distance_km != null && (
            <View style={styles.summaryItem}>
              <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
              <Text style={styles.summaryText}>{selectedRoute.distance_km.toFixed(0)} km</Text>
            </View>
          )}
        </View>
      )}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'todo' && styles.tabActive]}
          onPress={() => setActiveTab('todo')}
        >
          <Text style={[styles.tabText, activeTab === 'todo' && styles.tabTextActive]}>
            Za dostavu ({todoStops.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            Završeno ({completedStops.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stop list */}
      {isLoading && routes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !selectedRoute && routes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="map-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyText}>Nemate dodijeljenih ruta</Text>
          <Text style={styles.emptySubtext}>Povucite prema dolje za osvježavanje</Text>
        </View>
      ) : displayStops.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name={activeTab === 'todo' ? 'checkmark-done-circle' : 'list-outline'}
            size={64}
            color={colors.textMuted}
          />
          <Text style={styles.emptyText}>
            {activeTab === 'todo'
              ? 'Sve dostave su završene!'
              : 'Nema završenih dostava'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayStops}
          keyExtractor={(item) => `stop-${item.id}`}
          renderItem={({ item }) => (
            <OrderCard stop={item} onPress={() => handleStopPress(item)} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Route selection
  routeListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  routeListTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  routeList: {
    paddingBottom: spacing.xl,
  },
  routeCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  routeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  routeIdBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  routeIdText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: fontSizes.md,
  },
  routeStatusBadge: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  routeStatusText: {
    fontWeight: '600',
    fontSize: fontSizes.sm,
  },
  routeDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  routeDateText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  routeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  routeStat: {
    alignItems: 'center',
    gap: 2,
  },
  routeStatValue: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  routeStatLabel: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 3,
  },
  progressText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  routeVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  routeVehicleText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  routeCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  routeOpenText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.primary,
  },

  // Route back bar
  routeBackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  routeBackText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.primary,
  },
  routeBackBadge: {
    backgroundColor: colors.primaryBg,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  routeBackBadgeText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.primary,
  },
  routeBackVehicle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginLeft: 'auto',
  },

  // Stops view
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.card,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  list: {
    paddingVertical: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSizes.lg,
    color: colors.textSecondary,
  },
  emptySubtext: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
});
