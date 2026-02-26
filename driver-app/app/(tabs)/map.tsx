import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RouteMap } from '@/components/RouteMap';
import { useRouteStore } from '@/stores/routeStore';
import { spacing, borderRadius, fontSizes } from '@/constants/theme';
import { useColors, type AppColors } from '@/hooks/useColors';
import type { RouteStop, DriverRoute } from '@/types';

export default function MapScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const routes = useRouteStore((st) => st.routes);
  const setSelectedRoute = useRouteStore((st) => st.setSelectedRoute);
  const [selectedStop, setSelectedStop] = useState<(RouteStop & { route: DriverRoute }) | null>(null);

  const activeRoute = routes.find((r) => r.status === 'IN_PROGRESS') || routes[0];

  if (!activeRoute) {
    return (
      <View style={s.emptyContainer}>
        <Ionicons name="map-outline" size={64} color={c.textMuted} />
        <Text style={s.emptyText}>Nema aktivnih ruta</Text>
      </View>
    );
  }

  const handleStopPress = (stop: RouteStop) => { setSelectedStop({ ...stop, route: activeRoute }); };
  const openStopDetail = () => {
    if (!selectedStop) return;
    setSelectedRoute(activeRoute);
    setSelectedStop(null);
    router.push(`/order/${selectedStop.id}`);
  };

  return (
    <View style={s.container}>
      {routes.length > 1 && (
        <View style={s.routeSelector}>
          {routes.map((r, i) => (
            <TouchableOpacity key={r.id} style={[s.routeChip, r.id === activeRoute.id && { backgroundColor: c.primary, borderColor: c.primary }]}>
              <Text style={[s.routeChipText, r.id === activeRoute.id && { color: '#FFFFFF' }]}>Ruta {i + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <RouteMap route={activeRoute} onStopPress={handleStopPress} />
      <View style={s.infoBar}>
        <View style={s.infoItem}><Ionicons name="location" size={16} color={c.primary} /><Text style={s.infoText}>{activeRoute.stops.length} stopova</Text></View>
        {activeRoute.distance_km && <View style={s.infoItem}><Ionicons name="speedometer" size={16} color={c.warning} /><Text style={s.infoText}>{activeRoute.distance_km.toFixed(1)} km</Text></View>}
        {activeRoute.duration_min && <View style={s.infoItem}><Ionicons name="time" size={16} color={c.success} /><Text style={s.infoText}>{activeRoute.duration_min} min</Text></View>}
      </View>
      {selectedStop && (
        <View style={s.stopCard}>
          <View style={s.stopCardHeader}>
            <View style={s.stopCardLeft}>
              <View style={s.stopBadge}><Text style={s.stopBadgeText}>{selectedStop.redoslijed}</Text></View>
              <View>
                <Text style={s.stopCardName} numberOfLines={1}>{selectedStop.partner_naziv || 'Nepoznat'}</Text>
                <Text style={s.stopCardAddress} numberOfLines={1}>{selectedStop.adresa || '-'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedStop(null)}><Ionicons name="close" size={24} color={c.textMuted} /></TouchableOpacity>
          </View>
          <View style={s.stopCardActions}>
            <TouchableOpacity style={s.detailButton} onPress={openStopDetail}>
              <Ionicons name="document-text" size={18} color="#FFFFFF" />
              <Text style={s.detailButtonText}>Detalji</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, backgroundColor: c.background },
  emptyText: { fontSize: fontSizes.lg, color: c.textSecondary },
  routeSelector: { flexDirection: 'row', backgroundColor: c.card, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
  routeChip: { paddingHorizontal: spacing.lg, paddingVertical: 6, borderRadius: borderRadius.lg, backgroundColor: c.cardSolid, borderWidth: 1, borderColor: c.border },
  routeChipText: { fontSize: fontSizes.md, fontWeight: '600', color: c.textSecondary },
  infoBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: c.card, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: fontSizes.md, color: c.textSecondary, fontWeight: '500' },
  stopCard: { position: 'absolute', bottom: 56, left: spacing.lg, right: spacing.lg, backgroundColor: c.cardSolid, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  stopCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  stopCardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  stopBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.primaryBg, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  stopBadgeText: { fontSize: fontSizes.lg, fontWeight: '700', color: c.primary },
  stopCardName: { fontSize: 15, fontWeight: '600', color: c.text },
  stopCardAddress: { fontSize: fontSizes.md, color: c.textSecondary },
  stopCardActions: { flexDirection: 'row', gap: spacing.md },
  detailButton: { flex: 1, flexDirection: 'row', backgroundColor: c.primary, borderRadius: borderRadius.sm, height: 42, justifyContent: 'center', alignItems: 'center', gap: 6 },
  detailButtonText: { color: '#FFFFFF', fontSize: fontSizes.md, fontWeight: '600' },
});
