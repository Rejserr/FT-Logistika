import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/services/api';
import { useRouteStore } from '@/stores/routeStore';
import { StopDetails } from '@/components/StopDetails';
import { spacing, borderRadius, fontSizes, statusColors } from '@/constants/theme';
import { useColors, type AppColors } from '@/hooks/useColors';
import type { RouteStop } from '@/types';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stopId = parseInt(id!, 10);
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const selectedRoute = useRouteStore((st) => st.selectedRoute);
  const updateStopStatus = useRouteStore((st) => st.updateStopStatus);
  const stop = selectedRoute?.stops.find((st) => st.id === stopId);
  const [loading, setLoading] = useState(false);

  if (!stop) {
    return (
      <View style={s.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={c.danger} />
        <Text style={s.errorText}>Stop nije pronađen</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}><Text style={s.backButtonText}>Natrag</Text></TouchableOpacity>
      </View>
    );
  }

  const cfg = statusColors[stop.status] || statusColors.PENDING;

  const handleStatusUpdate = async (newStatus: RouteStop['status']) => {
    setLoading(true);
    try {
      await apiFetch(`/driver/stop/${stopId}/status?new_status=${newStatus}`, { method: 'PUT' });
      updateStopStatus(stopId, newStatus);
    } catch { Alert.alert('Greška', 'Nije moguće ažurirati status.'); }
    finally { setLoading(false); }
  };

  const openNavigation = () => {
    if (!stop.lat || !stop.lng) { Alert.alert('Greška', 'Koordinate nisu dostupne.'); return; }
    const url = Platform.select({
      android: `google.navigation:q=${stop.lat},${stop.lng}`,
      ios: `maps:?daddr=${stop.lat},${stop.lng}&dirflg=d`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`,
    });
    Linking.openURL(url!).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`));
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
      <View style={[s.statusBanner, { backgroundColor: cfg.bg }]}><Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text></View>
      {stop.lat && stop.lng && (
        <View style={s.mapContainer}><View style={s.mapPlaceholder}><Ionicons name="map" size={40} color={c.textMuted} /><Text style={s.mapPlaceholderText}>{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</Text></View></View>
      )}
      <View style={s.actionRow}>
        {stop.status === 'PENDING' && (
          <>
            <TouchableOpacity style={s.navButton} onPress={openNavigation}><Ionicons name="navigate" size={20} color="#FFFFFF" /><Text style={s.actionButtonText}>Navigacija</Text></TouchableOpacity>
            <TouchableOpacity style={[s.navButton, { backgroundColor: c.warning }]} onPress={() => handleStatusUpdate('ARRIVED')} disabled={loading}><Ionicons name="flag" size={20} color="#FFFFFF" /><Text style={s.actionButtonText}>Stigao sam</Text></TouchableOpacity>
          </>
        )}
        {stop.status === 'ARRIVED' && (
          <>
            <TouchableOpacity style={s.navButton} onPress={openNavigation}><Ionicons name="navigate" size={20} color="#FFFFFF" /><Text style={s.actionButtonText}>Navigacija</Text></TouchableOpacity>
            <TouchableOpacity style={[s.navButton, { backgroundColor: c.success }]} onPress={() => router.push(`/pod/${stopId}`)}><Ionicons name="camera" size={20} color="#FFFFFF" /><Text style={s.actionButtonText}>Dokaz dostave</Text></TouchableOpacity>
          </>
        )}
        {(stop.status === 'DELIVERED' || stop.status === 'FAILED') && (
          <View style={s.completedBanner}>
            <Ionicons name={stop.status === 'DELIVERED' ? 'checkmark-circle' : 'close-circle'} size={24} color={stop.status === 'DELIVERED' ? c.success : c.danger} />
            <Text style={s.completedText}>{stop.status === 'DELIVERED' ? 'Dostava završena' : 'Dostava neuspjela'}</Text>
          </View>
        )}
      </View>
      <StopDetails stop={stop} />
      {(stop.status === 'PENDING' || stop.status === 'ARRIVED') && (
        <TouchableOpacity style={s.rejectButton} onPress={() => Alert.alert('Odbij dostavu', 'Jeste li sigurni?', [{ text: 'Odustani', style: 'cancel' }, { text: 'Odbij', style: 'destructive', onPress: () => handleStatusUpdate('FAILED') }])}>
          <Ionicons name="close-circle-outline" size={18} color={c.danger} /><Text style={s.rejectText}>Odbij dostavu</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { paddingBottom: spacing.xxxl },
  statusBanner: { paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.sm, marginHorizontal: spacing.lg, marginTop: spacing.sm },
  statusText: { fontSize: fontSizes.md, fontWeight: '700', letterSpacing: 0.5 },
  mapContainer: { marginHorizontal: spacing.lg, marginVertical: spacing.md, borderRadius: borderRadius.md, overflow: 'hidden' },
  mapPlaceholder: { height: 160, backgroundColor: c.card, justifyContent: 'center', alignItems: 'center', borderRadius: borderRadius.md, gap: spacing.sm, borderWidth: 1, borderColor: c.border },
  mapPlaceholderText: { fontSize: fontSizes.md, color: c.textMuted },
  actionRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.md, gap: spacing.md },
  navButton: { flex: 1, flexDirection: 'row', backgroundColor: c.primary, borderRadius: borderRadius.md, height: 48, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  actionButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  completedBanner: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, backgroundColor: c.card, borderRadius: borderRadius.md, height: 48, borderWidth: 1, borderColor: c.border },
  completedText: { fontSize: 15, fontWeight: '600', color: c.text },
  rejectButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginHorizontal: spacing.lg, marginTop: spacing.sm, paddingVertical: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: c.danger, backgroundColor: c.dangerBg },
  rejectText: { color: c.danger, fontSize: fontSizes.md, fontWeight: '600' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, backgroundColor: c.background },
  errorText: { fontSize: fontSizes.xl, color: c.textSecondary },
  backButton: { backgroundColor: c.primary, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, borderRadius: borderRadius.sm },
  backButtonText: { color: '#FFFFFF', fontWeight: '600' },
});
