import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch, getToken, API_BASE } from '@/services/api';
import { getCurrentLocation } from '@/services/location';
import { useRouteStore } from '@/stores/routeStore';
import { colors, spacing, borderRadius, fontSizes } from '@/constants/theme';

export default function PODScreen() {
  const { stopId } = useLocalSearchParams<{ stopId: string }>();
  const sid = parseInt(stopId!, 10);

  const updateStopStatus = useRouteStore((s) => s.updateStopStatus);

  const [recipientName, setRecipientName] = useState('');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(true); // true = Completed, false = Failed
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Dozvola', 'Potrebna je dozvola za kameru.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Dozvola', 'Potrebna je dozvola za galeriju.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const captureSignature = async () => {
    // For now, use camera as signature capture (signature pad in future)
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Dozvola', 'Potrebna je dozvola za kameru.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      setSignature(result.assets[0].uri);
    }
  };

  const submitPOD = async () => {
    if (isCompleted && photos.length === 0 && !signature) {
      Alert.alert('Upozorenje', 'Dodajte barem jednu fotografiju ili potpis.');
      return;
    }

    setLoading(true);
    try {
      // Get current GPS location
      const location = await getCurrentLocation();

      const formData = new FormData();
      if (recipientName) formData.append('recipient_name', recipientName);
      if (comment) formData.append('comment', comment);
      if (location) {
        formData.append('gps_lat', location.coords.latitude.toString());
        formData.append('gps_lng', location.coords.longitude.toString());
      }

      if (signature) {
        const sigFile = {
          uri: signature,
          type: 'image/png',
          name: 'signature.png',
        } as any;
        formData.append('signature', sigFile);
      }

      for (const photo of photos) {
        const photoFile = {
          uri: photo,
          type: 'image/jpeg',
          name: `photo_${Date.now()}.jpg`,
        } as any;
        formData.append('photos', photoFile);
      }

      const token = await getToken();

      const url = `${API_BASE}/driver/stop/${sid}/pod`;
      console.log('[POD] Uploading to:', url);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.log('[POD] Upload failed:', res.status, errorText);
        throw new Error(`Upload failed: ${res.status}`);
      }

      console.log('[POD] Upload success');

      // Update status
      const finalStatus = isCompleted ? 'DELIVERED' : 'FAILED';
      if (!isCompleted) {
        await apiFetch(`/driver/stop/${sid}/status?new_status=FAILED`, { method: 'PUT' });
      }
      updateStopStatus(sid, finalStatus as any);

      Alert.alert('Uspjeh', 'Dokaz dostave je zabilježen.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Greška', 'Nije moguće poslati dokaz dostave. Pokušajte ponovo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Status toggle */}
      <View style={styles.statusToggle}>
        <TouchableOpacity
          style={[styles.statusOption, isCompleted && styles.statusOptionActive]}
          onPress={() => setIsCompleted(true)}
        >
          <Ionicons name="checkmark-circle" size={20} color={isCompleted ? colors.text : colors.success} />
          <Text style={[styles.statusOptionText, isCompleted && styles.statusOptionTextActive]}>
            Dostavljeno
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusOption, !isCompleted && styles.statusOptionFailed]}
          onPress={() => setIsCompleted(false)}
        >
          <Ionicons name="close-circle" size={20} color={!isCompleted ? colors.text : colors.danger} />
          <Text style={[styles.statusOptionText, !isCompleted && styles.statusOptionTextActive]}>
            Neuspjelo
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recipient name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Primatelj</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Ime primatelja"
          placeholderTextColor={colors.textMuted}
          value={recipientName}
          onChangeText={setRecipientName}
        />
      </View>

      {/* Comment */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bilješka</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Dodajte bilješku..."
          placeholderTextColor={colors.textMuted}
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Photos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fotografije</Text>
        <View style={styles.photoGrid}>
          {photos.map((uri, i) => (
            <View key={i} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                <Ionicons name="close-circle" size={22} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addPhotoButton} onPress={takePhoto}>
            <Ionicons name="camera" size={28} color={colors.primary} />
            <Text style={styles.addPhotoText}>Kamera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addPhotoButton} onPress={pickPhoto}>
            <Ionicons name="images" size={28} color={colors.primary} />
            <Text style={styles.addPhotoText}>Galerija</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Signature */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Potpis</Text>
        {signature ? (
          <View style={styles.signaturePreview}>
            <Image source={{ uri: signature }} style={styles.signatureImage} />
            <TouchableOpacity onPress={() => setSignature(null)} style={styles.removeSignature}>
              <Text style={styles.removeSignatureText}>Ukloni potpis</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.signatureButton} onPress={captureSignature}>
            <Ionicons name="pencil" size={24} color={colors.primary} />
            <Text style={styles.signatureButtonText}>Dodaj potpis</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Submit button */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={submitPOD}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Ionicons name="checkmark-done" size={20} color={colors.text} />
            <Text style={styles.submitButtonText}>Potvrdi dostavu</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  statusToggle: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  statusOptionActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  statusOptionFailed: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  statusOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  statusOptionTextActive: {
    color: colors.text,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  photoWrapper: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.card,
    borderRadius: 11,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    gap: 4,
  },
  addPhotoText: {
    fontSize: fontSizes.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  signaturePreview: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  signatureImage: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
  },
  removeSignature: {
    paddingVertical: 6,
  },
  removeSignatureText: {
    color: colors.danger,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingVertical: spacing.xxl,
  },
  signatureButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
});
