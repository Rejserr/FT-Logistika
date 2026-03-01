import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, FlatList, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSizes } from '@/constants/theme';
import { useColors, type AppColors } from '@/hooks/useColors';
import { useDocumentStore } from '@/stores/documentStore';
import { updateDocumentStatus, fetchStatusi, type StatusOption } from '@/services/erp';

const STATUS_MAP: Record<string, { id: string; uid: string }> = {
  '30': { id: '30', uid: '109-2928' },
  '31': { id: '31', uid: '110-2928' },
  '32': { id: '32', uid: '445-2928' },
  '33': { id: '33', uid: '111-2928' },
  '40': { id: '40', uid: '444-2928' },
};

const STATUS_LABELS: Record<string, string> = {
  '30': 'Spremno za utovar',
  '31': 'Na dostavi',
  '32': 'Dostavljeno',
  '33': 'Isporučeno kupcu',
  '40': 'Dostavljeno kupcu',
};

export default function DocumentViewScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const doc = useDocumentStore((st) => st.document);
  const updateStatus = useDocumentStore((st) => st.updateStatus);

  const [loading, setLoading] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!doc) {
    return (
      <View style={s.errorContainer}>
        <Ionicons name="document-outline" size={64} color={c.textMuted} />
        <Text style={s.errorText}>Dokument nije učitan</Text>
        <TouchableOpacity style={s.errorButton} onPress={() => router.back()}>
          <Text style={s.errorButtonText}>Natrag</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleIsporuka = async () => {
    if (!doc.nalogProdajeUid) {
      Alert.alert('Greška', 'Nalog prodaje nije pronađen u vezanim dokumentima.');
      return;
    }
    setLoading(true);
    try {
      await updateDocumentStatus(doc.nalogProdajeUid, '33', '111-2928');
      updateStatus('33', 'Isporučeno kupcu', '111-2928');
      setSuccessMessage('Isporučeno kupcu');
      setShowSuccess(true);
    } catch (e: any) {
      let msg = 'Greška pri slanju statusa u ERP.';
      try { const p = JSON.parse(e.message); if (typeof p.detail === 'string') msg = p.detail; } catch {}
      Alert.alert('ERP Greška', String(msg));
    } finally { setLoading(false); }
  };

  const handleStatusSave = async () => {
    if (!selectedStatusId || !doc.nalogProdajeUid) return;
    const mapped = STATUS_MAP[selectedStatusId];
    if (!mapped) { Alert.alert('Greška', 'Status nije mapiran.'); return; }
    setLoading(true);
    try {
      await updateDocumentStatus(doc.nalogProdajeUid, mapped.id, mapped.uid);
      updateStatus(mapped.id, STATUS_LABELS[mapped.id] || mapped.id, mapped.uid);
      setShowStatusModal(false);
      setSuccessMessage(STATUS_LABELS[mapped.id] || 'Status ažuriran');
      setShowSuccess(true);
    } catch (e: any) {
      let msg = 'Greška pri slanju statusa.';
      try { const p = JSON.parse(e.message); if (typeof p.detail === 'string') msg = p.detail; } catch {}
      Alert.alert('ERP Greška', String(msg));
    } finally { setLoading(false); }
  };

  const statusOptions = Object.entries(STATUS_LABELS);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={[s.typeBadge, { backgroundColor: doc.type === 'MP' ? c.primaryBg : c.infoBg }]}>
            <Text style={[s.typeBadgeText, { color: doc.type === 'MP' ? c.primary : c.info }]}>{doc.typeLabel}</Text>
          </View>
          <Text style={s.headerBroj}>#{doc.broj}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
        {/* Document info card */}
        <View style={s.infoCard}>
          <InfoRow icon="calendar-outline" label="Datum" value={doc.datum} c={c} />
          <InfoRow icon="person-outline" label="Kupac" value={doc.kupac} c={c} />
          <InfoRow icon="business-outline" label="Skladište" value={doc.skladisteNaziv || doc.skladiste} c={c} />
          <InfoRow icon="car-outline" label="Isporuka" value={doc.vrstaIsporuke} c={c} />

          {/* Status badge */}
          <View style={s.statusRow}>
            <Text style={s.statusLabel}>Status</Text>
            <View style={[s.statusBadge, { backgroundColor: doc.statusNaziv ? c.successBg : c.warningBg }]}>
              <Text style={[s.statusBadgeText, { color: doc.statusNaziv ? c.success : c.warning }]}>
                {doc.statusNaziv || 'Bez statusa'}
              </Text>
            </View>
          </View>
        </View>

        {/* Stavke */}
        <Text style={s.sectionTitle}>Stavke ({doc.stavke.length})</Text>
        {doc.stavke.map((st, i) => (
          <View key={i} style={s.stavkaCard}>
            <View style={s.stavkaHeader}>
              <Text style={s.stavkaNaziv} numberOfLines={2}>{st.naziv || st.artikl}</Text>
              <Text style={s.stavkaKol}>x{st.kolicina}</Text>
            </View>
            <View style={s.stavkaMeta}>
              {st.artikl ? <Text style={s.stavkaArtikl}>{st.artikl}</Text> : null}
              {st.barcode ? <Text style={s.stavkaBarcode}>BC: {st.barcode}</Text> : null}
              {st.cijena != null && (
                <Text style={s.stavkaCijena}>{st.cijena.toFixed(2)} EUR</Text>
              )}
              {st.iznos != null && (
                <Text style={s.stavkaIznos}>= {st.iznos.toFixed(2)} EUR</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom action buttons */}
      <View style={s.bottomBar}>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: c.success }]} onPress={handleIsporuka} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="checkmark-circle" size={20} color="#FFF" />}
          <Text style={s.actionBtnText}>Isporuka</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.actionBtn, { backgroundColor: c.warning }]} onPress={() => { setSelectedStatusId(doc.status); setShowStatusModal(true); }}>
          <Ionicons name="swap-horizontal" size={20} color="#FFF" />
          <Text style={s.actionBtnText}>Status</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.actionBtn, { backgroundColor: c.info }]} onPress={() => Alert.alert('POD', 'POD funkcionalnost je dostupna kroz Dostave ekran.')}>
          <Ionicons name="camera" size={20} color="#FFF" />
          <Text style={s.actionBtnText}>POD</Text>
        </TouchableOpacity>
      </View>

      {/* Status modal */}
      <Modal visible={showStatusModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Promjena statusa</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalCurrentLabel}>Trenutni status:</Text>
            <View style={[s.statusBadge, { backgroundColor: c.successBg, alignSelf: 'flex-start', marginBottom: spacing.lg }]}>
              <Text style={[s.statusBadgeText, { color: c.success }]}>{doc.statusNaziv || 'Bez statusa'}</Text>
            </View>

            <Text style={s.modalSelectLabel}>Odaberite novi status:</Text>
            {statusOptions.map(([id, label]) => (
              <TouchableOpacity
                key={id}
                style={[s.statusOption, selectedStatusId === id && { borderColor: c.primary, backgroundColor: c.primaryBg }]}
                onPress={() => setSelectedStatusId(id)}
              >
                <View style={[s.radioCircle, selectedStatusId === id && { borderColor: c.primary, backgroundColor: c.primary }]}>
                  {selectedStatusId === id && <View style={s.radioDot} />}
                </View>
                <Text style={[s.statusOptionText, selectedStatusId === id && { color: c.primary, fontWeight: '700' }]}>{label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[s.modalSaveBtn, (!selectedStatusId || loading) && { opacity: 0.5 }]}
              onPress={handleStatusSave}
              disabled={!selectedStatusId || loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.modalSaveBtnText}>Spremi</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.successCard}>
            <Ionicons name="checkmark-circle" size={64} color={c.success} />
            <Text style={s.successTitle}>Uspješno!</Text>
            <Text style={s.successMessage}>{successMessage}</Text>
            <TouchableOpacity style={s.successBtn} onPress={() => setShowSuccess(false)}>
              <Text style={s.successBtnText}>U redu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, label, value, c }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; c: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 }}>
      <Ionicons name={icon} size={18} color={c.textMuted} />
      <Text style={{ fontSize: fontSizes.sm, color: c.textMuted, width: 70 }}>{label}</Text>
      <Text style={{ fontSize: fontSizes.md, color: c.text, fontWeight: '500', flex: 1 }}>{value || '—'}</Text>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 50, paddingBottom: spacing.md, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center', gap: 4 },
  typeBadge: { borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: 3 },
  typeBadgeText: { fontSize: fontSizes.sm, fontWeight: '700' },
  headerBroj: { fontSize: fontSizes.xxl, fontWeight: '700', color: c.text },
  body: { flex: 1 },
  bodyContent: { padding: spacing.lg, paddingBottom: 100 },
  infoCard: { backgroundColor: c.card, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border, marginBottom: spacing.xl },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.border },
  statusLabel: { fontSize: fontSizes.sm, color: c.textMuted, fontWeight: '600' },
  statusBadge: { borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 4 },
  statusBadgeText: { fontSize: fontSizes.sm, fontWeight: '700' },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: c.text, marginBottom: spacing.md },
  stavkaCard: { backgroundColor: c.card, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: c.border },
  stavkaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  stavkaNaziv: { flex: 1, fontSize: fontSizes.md, fontWeight: '600', color: c.text },
  stavkaKol: { fontSize: fontSizes.lg, fontWeight: '700', color: c.primary },
  stavkaMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  stavkaArtikl: { fontSize: fontSizes.xs, color: c.textMuted, backgroundColor: c.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  stavkaBarcode: { fontSize: fontSizes.xs, color: c.textMuted },
  stavkaCijena: { fontSize: fontSizes.sm, color: c.textSecondary, fontWeight: '500' },
  stavkaIznos: { fontSize: fontSizes.sm, color: c.text, fontWeight: '700' },
  bottomBar: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, paddingBottom: 30, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.border },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: borderRadius.md },
  actionBtnText: { color: '#FFF', fontSize: fontSizes.md, fontWeight: '700' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background, gap: spacing.lg },
  errorText: { fontSize: fontSizes.lg, color: c.textSecondary },
  errorButton: { backgroundColor: c.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md },
  errorButtonText: { color: '#FFF', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: c.cardSolid, borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl, padding: spacing.xxl, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  modalTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: c.text },
  modalCurrentLabel: { fontSize: fontSizes.sm, color: c.textMuted, marginBottom: spacing.xs },
  modalSelectLabel: { fontSize: fontSizes.sm, fontWeight: '600', color: c.textMuted, marginBottom: spacing.md },
  statusOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: c.border, marginBottom: spacing.sm },
  statusOptionText: { fontSize: fontSizes.md, color: c.text },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.textMuted, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF' },
  modalSaveBtn: { backgroundColor: c.primary, borderRadius: borderRadius.md, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl },
  modalSaveBtnText: { color: '#FFF', fontSize: fontSizes.lg, fontWeight: '700' },
  successCard: { backgroundColor: c.cardSolid, borderRadius: borderRadius.xxl, padding: spacing.xxxl, margin: spacing.xxl, alignItems: 'center', alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto' },
  successTitle: { fontSize: fontSizes.xxl, fontWeight: '700', color: c.text, marginTop: spacing.md },
  successMessage: { fontSize: fontSizes.lg, color: c.textSecondary, marginTop: spacing.xs },
  successBtn: { backgroundColor: c.success, borderRadius: borderRadius.md, paddingHorizontal: spacing.xxxl, paddingVertical: spacing.md, marginTop: spacing.xl },
  successBtnText: { color: '#FFF', fontSize: fontSizes.lg, fontWeight: '600' },
});
