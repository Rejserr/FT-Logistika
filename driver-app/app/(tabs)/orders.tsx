import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { spacing, borderRadius, fontSizes } from '@/constants/theme';
import { useColors, type AppColors } from '@/hooks/useColors';
import type { DriverRoute, RouteStop } from '@/types';

type Tab = 'todo' | 'completed';

export default function OrdersScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('todo');
  const [refreshing, setRefreshing] = useState(false);

  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const routes = useRouteStore((st) => st.routes);
  const selectedRoute = useRouteStore((st) => st.selectedRoute);
  const isLoading = useRouteStore((st) => st.isLoading);
  const setRoutes = useRouteStore((st) => st.setRoutes);
  const setSelectedRoute = useRouteStore((st) => st.setSelectedRoute);
  const setLoading = useRouteStore((st) => st.setLoading);
  const setError = useRouteStore((st) => st.setError);

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<DriverRoute[]>('/driver/routes');
      setRoutes(data);
      if (data.length === 1) setSelectedRoute(data[0]);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRoutes();
    setRefreshing(false);
  }, [fetchRoutes]);

  const handleSelectRoute = (route: DriverRoute) => { setSelectedRoute(route); setActiveTab('todo'); };
  const handleBackToRoutes = () => { setSelectedRoute(null); };
  const handleStopPress = (stop: RouteStop & { routeId: number }) => {
    const route = routes.find((r) => r.id === stop.routeId);
    if (route) useRouteStore.getState().setSelectedRoute(route);
    router.push(`/order/${stop.id}`);
  };

  if (!selectedRoute && routes.length > 0) {
    return (
      <View style={s.container}>
        <View style={s.routeListHeader}>
          <Ionicons name="map-outline" size={20} color={c.primary} />
          <Text style={s.routeListTitle}>Odaberite rutu ({routes.length})</Text>
        </View>
        <FlatList
          data={routes}
          keyExtractor={(item) => `route-${item.id}`}
          contentContainerStyle={s.routeList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.primary]} />}
          renderItem={({ item: route }) => {
            const pending = route.stops.filter((st) => st.status === 'PENDING' || st.status === 'ARRIVED').length;
            const done = route.stops.filter((st) => st.status === 'DELIVERED' || st.status === 'FAILED' || st.status === 'SKIPPED').length;
            const progress = route.stops.length > 0 ? done / route.stops.length : 0;
            return (
              <TouchableOpacity style={s.routeCard} onPress={() => handleSelectRoute(route)} activeOpacity={0.7}>
                <View style={s.routeCardHeader}>
                  <View style={s.routeIdBadge}><Text style={s.routeIdText}>#{route.id}</Text></View>
                  <View style={[s.routeStatusBadge, { backgroundColor: route.status === 'IN_PROGRESS' ? c.successBg : c.primaryBg }]}>
                    <Text style={{ fontWeight: '600', fontSize: fontSizes.sm, color: route.status === 'IN_PROGRESS' ? c.success : c.primary }}>
                      {route.status === 'IN_PROGRESS' ? 'U tijeku' : 'Planirano'}
                    </Text>
                  </View>
                </View>
                {route.raspored && (
                  <View style={s.routeDateRow}>
                    <Ionicons name="calendar-outline" size={14} color={c.textMuted} />
                    <Text style={s.routeDateText}>Dostava: {route.raspored}</Text>
                  </View>
                )}
                <View style={s.routeStatsRow}>
                  <View style={s.routeStat}>
                    <Ionicons name="location" size={16} color={c.warning} />
                    <Text style={s.routeStatValue}>{pending}</Text>
                    <Text style={s.routeStatLabel}>preostalo</Text>
                  </View>
                  <View style={s.routeStat}>
                    <Ionicons name="checkmark-circle" size={16} color={c.success} />
                    <Text style={s.routeStatValue}>{done}</Text>
                    <Text style={s.routeStatLabel}>završeno</Text>
                  </View>
                  {route.distance_km != null && (
                    <View style={s.routeStat}>
                      <Ionicons name="speedometer-outline" size={16} color={c.primary} />
                      <Text style={s.routeStatValue}>{route.distance_km.toFixed(0)}</Text>
                      <Text style={s.routeStatLabel}>km</Text>
                    </View>
                  )}
                  {route.duration_min != null && (
                    <View style={s.routeStat}>
                      <Ionicons name="time-outline" size={16} color={c.primaryLight} />
                      <Text style={s.routeStatValue}>{route.duration_min}</Text>
                      <Text style={s.routeStatLabel}>min</Text>
                    </View>
                  )}
                </View>
                {route.stops.length > 0 && (
                  <View style={s.progressContainer}>
                    <View style={s.progressBar}><View style={[s.progressFill, { width: `${progress * 100}%` }]} /></View>
                    <Text style={s.progressText}>{done}/{route.stops.length} dostava</Text>
                  </View>
                )}
                {route.vozilo_oznaka && (
                  <View style={s.routeVehicleRow}>
                    <Ionicons name="car-outline" size={14} color={c.textSecondary} />
                    <Text style={s.routeVehicleText}>{route.vozilo_oznaka}</Text>
                  </View>
                )}
                <View style={s.routeCardFooter}>
                  <Text style={s.routeOpenText}>Otvori rutu</Text>
                  <Ionicons name="chevron-forward" size={18} color={c.primary} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  const stopsSource = selectedRoute ? selectedRoute.stops : [];
  const stopsWithRoute: (RouteStop & { routeId: number })[] = stopsSource.map((st) => ({ ...st, routeId: selectedRoute?.id ?? 0 }));
  const todoStops = stopsWithRoute.filter((st) => st.status === 'PENDING' || st.status === 'ARRIVED');
  const completedStops = stopsWithRoute.filter((st) => st.status === 'DELIVERED' || st.status === 'FAILED' || st.status === 'SKIPPED');
  const displayStops = activeTab === 'todo' ? todoStops : completedStops;

  return (
    <View style={s.container}>
      {routes.length > 1 && selectedRoute && (
        <TouchableOpacity style={s.routeBackBar} onPress={handleBackToRoutes} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={c.primary} />
          <Text style={s.routeBackText}>Sve rute</Text>
          <View style={s.routeBackBadge}><Text style={s.routeBackBadgeText}>Ruta #{selectedRoute.id}</Text></View>
          {selectedRoute.vozilo_oznaka && <Text style={s.routeBackVehicle}>{selectedRoute.vozilo_oznaka}</Text>}
        </TouchableOpacity>
      )}
      {selectedRoute && (
        <View style={s.summaryBar}>
          <View style={s.summaryItem}><Ionicons name="location" size={16} color={c.warning} /><Text style={s.summaryText}>{todoStops.length} preostalo</Text></View>
          <View style={s.summaryItem}><Ionicons name="checkmark-circle" size={16} color={c.success} /><Text style={s.summaryText}>{completedStops.length} završeno</Text></View>
          {selectedRoute.distance_km != null && <View style={s.summaryItem}><Ionicons name="speedometer-outline" size={16} color={c.primary} /><Text style={s.summaryText}>{selectedRoute.distance_km.toFixed(0)} km</Text></View>}
        </View>
      )}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab, activeTab === 'todo' && { borderBottomColor: c.primary }]} onPress={() => setActiveTab('todo')}>
          <Text style={[s.tabText, activeTab === 'todo' && { color: c.primary }]}>Za dostavu ({todoStops.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'completed' && { borderBottomColor: c.primary }]} onPress={() => setActiveTab('completed')}>
          <Text style={[s.tabText, activeTab === 'completed' && { color: c.primary }]}>Završeno ({completedStops.length})</Text>
        </TouchableOpacity>
      </View>
      {isLoading && routes.length === 0 ? (
        <View style={s.emptyContainer}><ActivityIndicator size="large" color={c.primary} /></View>
      ) : !selectedRoute && routes.length === 0 ? (
        <View style={s.emptyContainer}>
          <Ionicons name="map-outline" size={64} color={c.textMuted} />
          <Text style={s.emptyText}>Nemate dodijeljenih ruta</Text>
          <Text style={s.emptySubtext}>Povucite prema dolje za osvježavanje</Text>
        </View>
      ) : displayStops.length === 0 ? (
        <View style={s.emptyContainer}>
          <Ionicons name={activeTab === 'todo' ? 'checkmark-done-circle' : 'list-outline'} size={64} color={c.textMuted} />
          <Text style={s.emptyText}>{activeTab === 'todo' ? 'Sve dostave su završene!' : 'Nema završenih dostava'}</Text>
        </View>
      ) : (
        <FlatList
          data={displayStops}
          keyExtractor={(item) => `stop-${item.id}`}
          renderItem={({ item }) => <OrderCard stop={item} onPress={() => handleStopPress(item)} />}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.primary]} />}
        />
      )}
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  routeListHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  routeListTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: c.text },
  routeList: { paddingBottom: spacing.xl },
  routeCard: { backgroundColor: c.card, borderRadius: borderRadius.lg, marginHorizontal: spacing.lg, marginVertical: spacing.sm, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  routeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  routeIdBadge: { backgroundColor: c.primary, borderRadius: borderRadius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  routeIdText: { color: '#FFFFFF', fontWeight: '700', fontSize: fontSizes.md },
  routeStatusBadge: { borderRadius: borderRadius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  routeDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  routeDateText: { fontSize: fontSizes.md, color: c.textSecondary, fontWeight: '500' },
  routeStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.md },
  routeStat: { alignItems: 'center', gap: 2 },
  routeStatValue: { fontSize: fontSizes.xl, fontWeight: '700', color: c.text },
  routeStatLabel: { fontSize: fontSizes.xs, color: c.textSecondary },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressBar: { flex: 1, height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: c.success, borderRadius: 3 },
  progressText: { fontSize: fontSizes.sm, color: c.textSecondary, fontWeight: '500' },
  routeVehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  routeVehicleText: { fontSize: fontSizes.md, color: c.textSecondary },
  routeCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  routeOpenText: { fontSize: fontSizes.md, fontWeight: '600', color: c.primary },
  routeBackBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.card, paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  routeBackText: { fontSize: fontSizes.md, fontWeight: '600', color: c.primary },
  routeBackBadge: { backgroundColor: c.primaryBg, borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: c.border },
  routeBackBadgeText: { fontSize: fontSizes.sm, fontWeight: '700', color: c.primary },
  routeBackVehicle: { fontSize: fontSizes.sm, color: c.textSecondary, marginLeft: 'auto' },
  summaryBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: c.card, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryText: { fontSize: fontSizes.md, color: c.textSecondary },
  tabBar: { flexDirection: 'row', backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: fontSizes.md, fontWeight: '600', color: c.textMuted },
  list: { paddingVertical: spacing.sm },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: fontSizes.lg, color: c.textSecondary },
  emptySubtext: { fontSize: fontSizes.md, color: c.textMuted },
});
