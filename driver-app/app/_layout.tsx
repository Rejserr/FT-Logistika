import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColors } from '@/hooks/useColors';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { checkAuth, getSession } from '@/services/auth';
import { startLocationTracking, stopLocationTracking } from '@/services/location';
import { registerForPushNotifications } from '@/services/notifications';

export default function RootLayout() {
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setLoading = useAuthStore((s) => s.setLoading);
  const reset = useAuthStore((s) => s.reset);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onDuty = useAuthStore((s) => s.onDuty);
  const colors = useColors();

  useEffect(() => {
    (async () => {
      setLoading(true);
      await useSettingsStore.getState().loadSettings();
      const ok = await checkAuth();
      if (ok) {
        try {
          const session = await getSession();
          if (session.active) {
            setAuthenticated(
              { id: 0, username: '', full_name: '', role: 'Vozac', warehouse_id: null },
              session.session_id!,
              session.vozilo_id ?? null,
              null,
            );
          } else { reset(); }
        } catch { reset(); }
      } else { reset(); }
    })();
  }, []);

  useEffect(() => {
    if (isAuthenticated && onDuty) {
      const interval = useSettingsStore.getState().locationTrackingInterval * 1000;
      startLocationTracking(interval);
    } else { stopLocationTracking(); }
    return () => stopLocationTracking();
  }, [isAuthenticated, onDuty]);

  useEffect(() => { if (isAuthenticated) registerForPushNotifications(); }, [isAuthenticated]);

  return (
    <>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="qr-scan" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen
          name="document-view"
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="order/[id]"
          options={{
            headerShown: true,
            title: 'Detalji naloga',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="pod/[stopId]"
          options={{
            headerShown: true,
            title: 'Dokaz dostave',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </>
  );
}
