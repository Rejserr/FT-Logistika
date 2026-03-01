import { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSizes } from '@/constants/theme';
import { useColors, type AppColors } from '@/hooks/useColors';
import { useDocumentStore } from '@/stores/documentStore';
import { detectDocumentType, fetchDocument, parseDocument } from '@/services/erp';

export default function QRScanScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const setDocument = useDocumentStore((st) => st.setDocument);
  const setError = useDocumentStore((st) => st.setError);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    const docType = detectDocumentType(data);
    if (!docType) {
      Alert.alert('Greška', 'Vrsta dokumenta nije prepoznata.\n\nOčekivani format:\n.LUCEED.04.xxx (MP Račun)\n.LUCEED.01.xxx (Skladišni dok.)', [
        { text: 'Pokušaj ponovo', onPress: () => { setScanned(false); setLoading(false); } },
        { text: 'Natrag', onPress: () => router.back() },
      ]);
      return;
    }

    try {
      const resp = await fetchDocument(data);
      const parsed = parseDocument(resp);
      setDocument(parsed);
      router.replace('/document-view');
    } catch (e: any) {
      let msg = 'Nije moguće dohvatiti dokument iz ERP-a.';
      try {
        const parsed = JSON.parse(e.message);
        if (typeof parsed.detail === 'string') msg = parsed.detail;
      } catch {}
      Alert.alert('ERP Greška', String(msg), [
        { text: 'Pokušaj ponovo', onPress: () => { setScanned(false); setLoading(false); } },
        { text: 'Natrag', onPress: () => router.back() },
      ]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return <View style={s.container}><ActivityIndicator size="large" color={c.primary} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={s.container}>
        <View style={s.permissionCard}>
          <Ionicons name="camera-outline" size={64} color={c.textMuted} />
          <Text style={s.permissionTitle}>Pristup kameri</Text>
          <Text style={s.permissionText}>Potrebna je dozvola za kameru kako biste skenirali QR kodove.</Text>
          <TouchableOpacity style={s.permissionButton} onPress={requestPermission}>
            <Text style={s.permissionButtonText}>Dopusti pristup</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <CameraView
        style={s.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={s.overlay}>
          <TouchableOpacity style={s.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={s.scanFrame}>
            <View style={[s.corner, s.cornerTL]} />
            <View style={[s.corner, s.cornerTR]} />
            <View style={[s.corner, s.cornerBL]} />
            <View style={[s.corner, s.cornerBR]} />
          </View>

          <View style={s.bottomBar}>
            {loading ? (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={s.loadingText}>Dohvaćam dokument...</Text>
              </View>
            ) : (
              <>
                <Ionicons name="qr-code-outline" size={28} color="#FFFFFF" />
                <Text style={s.instructionText}>Usmjerite kameru na QR kod dokumenta</Text>
              </>
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const CORNER_SIZE = 30;
const CORNER_WIDTH = 4;

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  backButton: { position: 'absolute', top: 50, left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 8 },
  scanFrame: { alignSelf: 'center', width: 260, height: 260, marginTop: 'auto', marginBottom: 'auto' },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: c.primary },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderBottomRightRadius: 12 },
  bottomBar: { alignItems: 'center', paddingBottom: 60, gap: spacing.md },
  loadingContainer: { alignItems: 'center', gap: spacing.md },
  loadingText: { color: '#FFFFFF', fontSize: fontSizes.lg, fontWeight: '600' },
  instructionText: { color: 'rgba(255,255,255,0.8)', fontSize: fontSizes.md, textAlign: 'center', paddingHorizontal: spacing.xxl },
  permissionCard: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background, gap: spacing.lg, paddingHorizontal: spacing.xxxl },
  permissionTitle: { fontSize: fontSizes.xxl, fontWeight: '700', color: c.text },
  permissionText: { fontSize: fontSizes.md, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },
  permissionButton: { backgroundColor: c.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.xxxl, paddingVertical: spacing.md, marginTop: spacing.lg },
  permissionButtonText: { color: '#FFFFFF', fontSize: fontSizes.lg, fontWeight: '600' },
});
