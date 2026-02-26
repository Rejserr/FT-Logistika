import { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Switch } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSizes } from '@/constants/theme';
import { useColors, type AppColors } from '@/hooks/useColors';
import { useAuthStore } from '@/stores/authStore';
import { useRouteStore } from '@/stores/routeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { logout } from '@/services/auth';
import { stopLocationTracking } from '@/services/location';
import Constants from 'expo-constants';
import type { NavApp } from '@/types';

const NAV_OPTIONS: { id: NavApp; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'google', label: 'Google Maps', icon: 'navigate' },
  { id: 'waze', label: 'Waze', icon: 'compass' },
  { id: 'tomtom', label: 'TomTom', icon: 'map' },
];

export default function SettingsScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const user = useAuthStore((st) => st.user);
  const resetAuth = useAuthStore((st) => st.reset);
  const resetRoutes = useRouteStore((st) => st.reset);

  const navApp = useSettingsStore((st) => st.navApp);
  const setNavApp = useSettingsStore((st) => st.setNavApp);
  const theme = useSettingsStore((st) => st.theme);
  const setTheme = useSettingsStore((st) => st.setTheme);
  const loadSettings = useSettingsStore((st) => st.loadSettings);

  useEffect(() => { loadSettings(); }, []);

  const handleLogout = () => {
    Alert.alert('Odjava', 'Jeste li sigurni da se želite odjaviti?', [
      { text: 'Odustani', style: 'cancel' },
      {
        text: 'Odjavi se', style: 'destructive',
        onPress: async () => {
          stopLocationTracking();
          await logout();
          resetAuth();
          resetRoutes();
          router.replace('/login');
        },
      },
    ]);
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
      <View style={s.userCard}>
        <View style={s.avatar}><Ionicons name="person" size={32} color={c.primary} /></View>
        <View style={s.userInfo}>
          <Text style={s.userName}>{user?.full_name || user?.username || 'Vozač'}</Text>
          <Text style={s.userRole}>{user?.role || 'Vozac'}</Text>
        </View>
      </View>

      {/* Theme */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Tema</Text>
        <View style={s.themeRow}>
          <TouchableOpacity
            style={[s.themeOption, theme === 'light' && { borderColor: c.primary, backgroundColor: c.primaryBg }]}
            onPress={() => setTheme('light')}
          >
            <Ionicons name="sunny" size={22} color={theme === 'light' ? c.primary : c.textMuted} />
            <Text style={[s.themeLabel, theme === 'light' && { color: c.primary, fontWeight: '700' }]}>Svijetla</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.themeOption, theme === 'dark' && { borderColor: c.primary, backgroundColor: c.primaryBg }]}
            onPress={() => setTheme('dark')}
          >
            <Ionicons name="moon" size={22} color={theme === 'dark' ? c.primary : c.textMuted} />
            <Text style={[s.themeLabel, theme === 'dark' && { color: c.primary, fontWeight: '700' }]}>Tamna</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation app */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Navigacija</Text>
        {NAV_OPTIONS.map((opt) => (
          <TouchableOpacity key={opt.id} style={s.settingRow} onPress={() => setNavApp(opt.id)}>
            <View style={s.settingLeft}>
              <View style={[s.settingIcon, { backgroundColor: c.primaryBg }]}>
                <Ionicons name={opt.icon} size={20} color={c.primary} />
              </View>
              <Text style={s.settingLabel}>{opt.label}</Text>
            </View>
            {navApp === opt.id && <Ionicons name="checkmark-circle" size={22} color={c.primary} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* App info */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Aplikacija</Text>
        <View style={s.settingRow}>
          <View style={s.settingLeft}>
            <View style={[s.settingIcon, { backgroundColor: c.primaryBg }]}><Ionicons name="information-circle" size={20} color={c.primaryLight} /></View>
            <View><Text style={s.settingLabel}>Verzija</Text><Text style={s.settingDescription}>{appVersion}</Text></View>
          </View>
        </View>
      </View>

      <TouchableOpacity style={s.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={c.danger} />
        <Text style={s.logoutText}>Odjavi se</Text>
      </TouchableOpacity>

      <Text style={s.footer}>FT Driver v{appVersion}</Text>
    </ScrollView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { paddingBottom: 40 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, padding: spacing.xl, gap: spacing.lg, borderBottomWidth: 1, borderBottomColor: c.border },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.primaryBg, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  userInfo: { flex: 1 },
  userName: { fontSize: fontSizes.xl, fontWeight: '700', color: c.text },
  userRole: { fontSize: fontSizes.md, color: c.textSecondary, marginTop: 2 },
  section: { marginTop: spacing.xl, backgroundColor: c.card, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border },
  sectionTitle: { fontSize: fontSizes.md, fontWeight: '600', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 6 },
  themeRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  themeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: borderRadius.md, borderWidth: 2, borderColor: c.border },
  themeLabel: { fontSize: fontSizes.md, fontWeight: '500', color: c.textSecondary },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.borderSubtle },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  settingIcon: { width: 36, height: 36, borderRadius: borderRadius.sm, justifyContent: 'center', alignItems: 'center' },
  settingLabel: { fontSize: 15, fontWeight: '500', color: c.text },
  settingDescription: { fontSize: fontSizes.sm, color: c.textMuted, marginTop: 1 },
  logoutButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxxl, marginHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: c.danger, backgroundColor: c.card },
  logoutText: { fontSize: fontSizes.lg, fontWeight: '600', color: c.danger },
  footer: { textAlign: 'center', fontSize: fontSizes.sm, color: c.textMuted, marginTop: spacing.xl },
});
