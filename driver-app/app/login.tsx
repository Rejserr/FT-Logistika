import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSizes } from '@/constants/theme';
import { login } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import type { RouteSummary } from '@/types';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<RouteSummary | null>(null);

  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Greška', 'Unesite korisničko ime i lozinku.');
      return;
    }

    console.log('[LOGIN] Attempting login:', {
      username: username.trim(),
      plate: plate.trim().toUpperCase(),
      passwordLength: password.trim().length,
    });

    setLoading(true);
    try {
      const data = await login(username.trim(), password.trim(), plate.trim().toUpperCase() || '');

      console.log('[LOGIN] Success:', {
        user: data.user,
        session_id: data.session_id,
        vozilo_id: data.vozilo_id,
        hasToken: !!data.access_token,
        hasSummary: !!data.summary,
      });

      setAuthenticated(data.user, data.session_id, data.vozilo_id, data.summary);

      if (data.force_password_change) {
        router.replace('/change-password');
      } else if (data.summary && data.summary.route_count > 0) {
        setSummary(data.summary);
        setShowSummary(true);
      } else {
        router.replace('/(tabs)/orders');
      }
    } catch (e: any) {
      console.log('[LOGIN] Failed:', e.message);
      let msg = 'Pogrešno korisničko ime ili lozinka.';
      try {
        const parsed = JSON.parse(e.message);
        if (parsed.detail) msg = parsed.detail;
      } catch {}
      Alert.alert('Greška', msg);
    } finally {
      setLoading(false);
    }
  };

  const dismissSummary = () => {
    setShowSummary(false);
    router.replace('/(tabs)/orders');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="car" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>FT Driver</Text>
          <Text style={styles.subtitle}>Prijava vozača</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Korisničko ime"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Lozinka"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="car-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Registracija (opcionalno ako imate rutu)"
              placeholderTextColor={colors.textMuted}
              value={plate}
              onChangeText={setPlate}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.buttonText}>Prijava</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Route summary popup after login */}
      <Modal visible={showSummary} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              <Text style={styles.summaryTitle}>Dobrodošli!</Text>
            </View>

            <Text style={styles.summarySubtitle}>Današnji pregled:</Text>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary?.route_count ?? 0}</Text>
                <Text style={styles.summaryLabel}>Ruta</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary?.stop_count ?? 0}</Text>
                <Text style={styles.summaryLabel}>Dostava</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary?.total_km ?? 0}</Text>
                <Text style={styles.summaryLabel}>km</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary?.total_min ?? 0}</Text>
                <Text style={styles.summaryLabel}>min</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.summaryButton} onPress={dismissSummary}>
              <Text style={styles.summaryButtonText}>Započni</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSizes.xxxl,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSizes.lg,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  inputIcon: {
    paddingLeft: spacing.md,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xxxl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: fontSizes.xxl,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  summarySubtitle: {
    fontSize: fontSizes.lg,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  summaryItem: {
    width: 80,
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryValue: {
    fontSize: fontSizes.xxl,
    fontWeight: '700',
    color: colors.primary,
  },
  summaryLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  summaryButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    height: 48,
    paddingHorizontal: spacing.xxxl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryButtonText: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '600',
  },
});
