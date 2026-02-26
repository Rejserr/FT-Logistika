import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSizes } from '@/constants/theme';
import { useColors, type AppColors } from '@/hooks/useColors';
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

  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const setAuthenticated = useAuthStore((st) => st.setAuthenticated);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) { Alert.alert('Greška', 'Unesite korisničko ime i lozinku.'); return; }
    setLoading(true);
    try {
      const data = await login(username.trim(), password.trim(), plate.trim().toUpperCase() || '');
      setAuthenticated(data.user, data.session_id, data.vozilo_id, data.summary);
      if (data.force_password_change) {
        router.replace('/change-password');
      } else if (data.summary && data.summary.route_count > 0) {
        setSummary(data.summary); setShowSummary(true);
      } else {
        router.replace('/(tabs)/orders');
      }
    } catch (e: any) {
      let msg = 'Pogrešno korisničko ime ili lozinka.';
      try {
        const parsed = JSON.parse(e.message);
        if (typeof parsed.detail === 'string') msg = parsed.detail;
        else if (Array.isArray(parsed.detail)) msg = parsed.detail.map((d: any) => d.msg || String(d)).join('; ');
      } catch {}
      Alert.alert('Greška', String(msg));
    } finally { setLoading(false); }
  };

  const dismissSummary = () => { setShowSummary(false); router.replace('/(tabs)/orders'); };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={s.logoContainer}>
          <View style={s.logoCircle}><Ionicons name="car" size={48} color={c.primary} /></View>
          <Text style={s.title}>FT Driver</Text>
          <Text style={s.subtitle}>Prijava vozača</Text>
        </View>
        <View style={s.form}>
          <View style={s.inputContainer}>
            <Ionicons name="person-outline" size={20} color={c.textMuted} style={s.inputIcon} />
            <TextInput style={s.input} placeholder="Korisničko ime" placeholderTextColor={c.textMuted} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
          </View>
          <View style={s.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={c.textMuted} style={s.inputIcon} />
            <TextInput style={s.input} placeholder="Lozinka" placeholderTextColor={c.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
          </View>
          <View style={s.inputContainer}>
            <Ionicons name="car-outline" size={20} color={c.textMuted} style={s.inputIcon} />
            <TextInput style={s.input} placeholder="Registracija (opcionalno)" placeholderTextColor={c.textMuted} value={plate} onChangeText={setPlate} autoCapitalize="characters" autoCorrect={false} />
          </View>
          <TouchableOpacity style={[s.button, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.buttonText}>Prijava</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Modal visible={showSummary} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.summaryCard}>
            <Ionicons name="checkmark-circle" size={48} color={c.success} />
            <Text style={s.summaryTitle}>Dobrodošli!</Text>
            <Text style={s.summarySubtitle}>Današnji pregled:</Text>
            <View style={s.summaryGrid}>
              {[
                { val: summary?.route_count ?? 0, lbl: 'Ruta' },
                { val: summary?.stop_count ?? 0, lbl: 'Dostava' },
                { val: summary?.total_km ?? 0, lbl: 'km' },
                { val: summary?.total_min ?? 0, lbl: 'min' },
              ].map((it) => (
                <View key={it.lbl} style={s.summaryItem}>
                  <Text style={s.summaryValue}>{it.val}</Text>
                  <Text style={s.summaryLabel}>{it.lbl}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={s.summaryButton} onPress={dismissSummary}>
              <Text style={s.summaryButtonText}>Započni</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  logoContainer: { alignItems: 'center', marginBottom: spacing.xxxl },
  logoCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  title: { fontSize: fontSizes.xxxl, fontWeight: '700', color: c.text },
  subtitle: { fontSize: fontSizes.lg, color: c.textSecondary, marginTop: spacing.xs },
  form: { backgroundColor: c.card, borderRadius: borderRadius.lg, padding: spacing.xxl, borderWidth: 1, borderColor: c.border },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.border, borderRadius: borderRadius.md, marginBottom: spacing.lg, backgroundColor: c.background },
  inputIcon: { paddingLeft: spacing.md },
  input: { flex: 1, height: 50, paddingHorizontal: spacing.md, fontSize: fontSizes.lg, color: c.text },
  button: { backgroundColor: c.primary, borderRadius: borderRadius.md, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: '#FFFFFF', fontSize: fontSizes.xl, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  summaryCard: { backgroundColor: c.cardSolid, borderRadius: borderRadius.xl, padding: spacing.xxxl, width: '100%', maxWidth: 360, alignItems: 'center', borderWidth: 1, borderColor: c.border },
  summaryTitle: { fontSize: fontSizes.xxl, fontWeight: '700', color: c.text, marginTop: spacing.sm },
  summarySubtitle: { fontSize: fontSizes.lg, color: c.textSecondary, marginBottom: spacing.xl },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.lg, marginBottom: spacing.xxl },
  summaryItem: { width: 80, alignItems: 'center', backgroundColor: c.primaryBg, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
  summaryValue: { fontSize: fontSizes.xxl, fontWeight: '700', color: c.primary },
  summaryLabel: { fontSize: fontSizes.sm, color: c.textSecondary, marginTop: 2 },
  summaryButton: { flexDirection: 'row', backgroundColor: c.primary, borderRadius: borderRadius.md, height: 48, paddingHorizontal: spacing.xxxl, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  summaryButtonText: { color: '#FFFFFF', fontSize: fontSizes.lg, fontWeight: '600' },
});
