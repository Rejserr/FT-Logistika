import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { spacing, borderRadius, fontSizes } from '@/constants/theme';
import { useColors, type AppColors } from '@/hooks/useColors';

export default function HomeScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const user = useAuthStore((st) => st.user);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.greeting}>Pozdrav, {user?.full_name?.split(' ')[0] || 'Vozač'} 👋</Text>
        <Text style={s.subtitle}>Što želite raditi?</Text>
      </View>

      <View style={s.cardsContainer}>
        {/* Dostave card */}
        <TouchableOpacity
          style={s.card}
          onPress={() => router.push('/(tabs)/orders')}
          activeOpacity={0.7}
        >
          <View style={[s.iconCircle, { backgroundColor: c.primaryBg }]}>
            <Ionicons name="cube" size={36} color={c.primary} />
          </View>
          <Text style={s.cardTitle}>Dostave</Text>
          <Text style={s.cardSubtitle}>Pregled ruta i naloga</Text>
          <View style={s.cardArrow}>
            <Ionicons name="arrow-forward-circle" size={28} color={c.primary} />
          </View>
        </TouchableOpacity>

        {/* QR card */}
        <TouchableOpacity
          style={s.card}
          onPress={() => router.push('/qr-scan')}
          activeOpacity={0.7}
        >
          <View style={[s.iconCircle, { backgroundColor: c.infoBg }]}>
            <Ionicons name="qr-code" size={36} color={c.info} />
          </View>
          <Text style={s.cardTitle}>QR Skeniranje</Text>
          <Text style={s.cardSubtitle}>Skeniraj dokument</Text>
          <View style={s.cardArrow}>
            <Ionicons name="arrow-forward-circle" size={28} color={c.info} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, paddingHorizontal: spacing.xl },
  header: { paddingTop: spacing.xxl, paddingBottom: spacing.xxxl },
  greeting: { fontSize: fontSizes.xxl, fontWeight: '700', color: c.text },
  subtitle: { fontSize: fontSizes.lg, color: c.textSecondary, marginTop: spacing.xs },
  cardsContainer: { gap: spacing.xl },
  card: {
    backgroundColor: c.card,
    borderRadius: borderRadius.xxl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  cardTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: c.text },
  cardSubtitle: { fontSize: fontSizes.md, color: c.textSecondary, marginTop: spacing.xs },
  cardArrow: { position: 'absolute', right: spacing.xxl, bottom: spacing.xxl },
});
