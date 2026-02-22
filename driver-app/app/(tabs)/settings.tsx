import { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSizes } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { useRouteStore } from '@/stores/routeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { logout, setDutyStatus } from '@/services/auth';
import { stopLocationTracking } from '@/services/location';
import Constants from 'expo-constants';
import type { NavApp } from '@/types';

const NAV_OPTIONS: { id: NavApp; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'google', label: 'Google Maps', icon: 'navigate' },
  { id: 'waze', label: 'Waze', icon: 'compass' },
  { id: 'tomtom', label: 'TomTom', icon: 'map' },
];

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const onDuty = useAuthStore((s) => s.onDuty);
  const setOnDuty = useAuthStore((s) => s.setOnDuty);
  const resetAuth = useAuthStore((s) => s.reset);
  const resetRoutes = useRouteStore((s) => s.reset);

  const navApp = useSettingsStore((s) => s.navApp);
  const setNavApp = useSettingsStore((s) => s.setNavApp);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  const handleDutyToggle = async (value: boolean) => {
    try {
      await setDutyStatus(value);
      setOnDuty(value);
    } catch {}
  };

  const handleLogout = () => {
    Alert.alert('Odjava', 'Jeste li sigurni da se želite odjaviti?', [
      { text: 'Odustani', style: 'cancel' },
      {
        text: 'Odjavi se',
        style: 'destructive',
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* User info */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color={colors.primary} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.full_name || user?.username || 'Vozač'}</Text>
          <Text style={styles.userRole}>{user?.role || 'Vozac'}</Text>
        </View>
      </View>

      {/* ON DUTY */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: onDuty ? colors.successBg : colors.cardHover }]}>
              <Ionicons name="radio-button-on" size={20} color={onDuty ? colors.success : colors.textMuted} />
            </View>
            <View>
              <Text style={styles.settingLabel}>ON DUTY</Text>
              <Text style={styles.settingDescription}>
                {onDuty ? 'Aktivno - primam naloge' : 'Neaktivno'}
              </Text>
            </View>
          </View>
          <Switch
            value={onDuty}
            onValueChange={handleDutyToggle}
            trackColor={{ false: colors.border, true: colors.success }}
            thumbColor={onDuty ? colors.success : colors.textMuted}
          />
        </View>
      </View>

      {/* Navigation app */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Navigacija</Text>
        {NAV_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={styles.settingRow}
            onPress={() => setNavApp(opt.id)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.primaryBg }]}>
                <Ionicons name={opt.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.settingLabel}>{opt.label}</Text>
            </View>
            {navApp === opt.id && (
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* App info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aplikacija</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="information-circle" size={20} color={colors.primaryLight} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Verzija</Text>
              <Text style={styles.settingDescription}>{appVersion}</Text>
            </View>
          </View>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.successBg }]}>
              <Ionicons name="server" size={20} color={colors.success} />
            </View>
            <View>
              <Text style={styles.settingLabel}>API</Text>
              <Text style={styles.settingDescription}>
                {__DEV__ ? 'Development (localhost)' : 'Production'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Odjavi se</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>FT Driver v{appVersion}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.xl,
    gap: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  userRole: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 6,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  settingDescription: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxxl,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.card,
  },
  logoutText: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.danger,
  },
  footer: {
    textAlign: 'center',
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
});
