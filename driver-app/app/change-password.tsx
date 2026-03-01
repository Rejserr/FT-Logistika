import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSizes } from '@/constants/theme';
import { useColors, type AppColors } from '@/hooks/useColors';
import { apiFetch } from '@/services/api';

export default function ChangePasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) { Alert.alert('Greška', 'Unesite novu lozinku i potvrdite je.'); return; }
    if (newPassword.length < 5) { Alert.alert('Greška', 'Lozinka mora imati najmanje 5 znakova.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Greška', 'Lozinke se ne podudaraju.'); return; }
    setLoading(true);
    try {
      await apiFetch('/driver/change-password', { method: 'POST', body: JSON.stringify({ new_password: newPassword }) });
      Alert.alert('Uspjeh', 'Lozinka je uspješno promijenjena.', [{ text: 'OK', onPress: () => router.replace('/(tabs)/home') }]);
    } catch (e: any) {
      let msg = 'Greška pri promjeni lozinke.';
      try {
        const parsed = JSON.parse(e.message);
        if (typeof parsed.detail === 'string') msg = parsed.detail;
        else if (Array.isArray(parsed.detail)) msg = parsed.detail.map((d: any) => d.msg || String(d)).join('; ');
      } catch {}
      Alert.alert('Greška', String(msg));
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={s.iconContainer}>
          <View style={s.iconCircle}><Ionicons name="lock-open" size={48} color={c.primary} /></View>
          <Text style={s.title}>Promjena lozinke</Text>
          <Text style={s.subtitle}>Administrator zahtijeva da promijenite lozinku prije nastavka.</Text>
        </View>
        <View style={s.form}>
          <View style={s.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={c.textMuted} style={s.inputIcon} />
            <TextInput style={s.input} placeholder="Nova lozinka (min. 5 znakova)" placeholderTextColor={c.textMuted} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoFocus />
          </View>
          <View style={s.inputContainer}>
            <Ionicons name="checkmark-circle-outline" size={20} color={c.textMuted} style={s.inputIcon} />
            <TextInput style={s.input} placeholder="Potvrdite novu lozinku" placeholderTextColor={c.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          </View>
          <TouchableOpacity style={[s.button, loading && { opacity: 0.7 }]} onPress={handleChangePassword} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.buttonText}>Spremi lozinku</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  iconContainer: { alignItems: 'center', marginBottom: spacing.xxxl },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  title: { fontSize: fontSizes.xxl, fontWeight: '700', color: c.text },
  subtitle: { fontSize: fontSizes.md, color: c.textSecondary, marginTop: spacing.sm, textAlign: 'center', lineHeight: 20 },
  form: { backgroundColor: c.card, borderRadius: borderRadius.lg, padding: spacing.xxl, borderWidth: 1, borderColor: c.border },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.border, borderRadius: borderRadius.md, marginBottom: spacing.lg, backgroundColor: c.background },
  inputIcon: { paddingLeft: spacing.md },
  input: { flex: 1, height: 50, paddingHorizontal: spacing.md, fontSize: fontSizes.lg, color: c.text },
  button: { backgroundColor: c.primary, borderRadius: borderRadius.md, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: '#FFFFFF', fontSize: fontSizes.xl, fontWeight: '600' },
});
