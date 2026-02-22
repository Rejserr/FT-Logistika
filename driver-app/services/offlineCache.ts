import * as SecureStore from 'expo-secure-store';
import type { DriverRoute } from '@/types';

const CACHE_KEY = 'offline_routes';
const PENDING_LOCATIONS_KEY = 'pending_locations';
const PENDING_PODS_KEY = 'pending_pods';

// --- Route caching for offline ---

export async function cacheRoutes(routes: DriverRoute[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(routes));
  } catch (e) {
    console.warn('Failed to cache routes:', e);
  }
}

export async function getCachedRoutes(): Promise<DriverRoute[]> {
  try {
    const data = await SecureStore.getItemAsync(CACHE_KEY);
    if (data) {
      return JSON.parse(data) as DriverRoute[];
    }
  } catch (e) {
    console.warn('Failed to read cached routes:', e);
  }
  return [];
}

export async function clearCachedRoutes(): Promise<void> {
  await SecureStore.deleteItemAsync(CACHE_KEY);
}

// --- Pending location updates (offline queue) ---

interface PendingLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}

export async function queueLocation(loc: PendingLocation): Promise<void> {
  try {
    const existing = await SecureStore.getItemAsync(PENDING_LOCATIONS_KEY);
    const queue: PendingLocation[] = existing ? JSON.parse(existing) : [];
    queue.push(loc);

    // Keep max 500 entries
    if (queue.length > 500) {
      queue.splice(0, queue.length - 500);
    }

    await SecureStore.setItemAsync(PENDING_LOCATIONS_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to queue location:', e);
  }
}

export async function getPendingLocations(): Promise<PendingLocation[]> {
  try {
    const data = await SecureStore.getItemAsync(PENDING_LOCATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function clearPendingLocations(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_LOCATIONS_KEY);
}

// --- Pending POD submissions (offline queue) ---

interface PendingPOD {
  stopId: number;
  recipientName?: string;
  comment?: string;
  gpsLat?: number;
  gpsLng?: number;
  photoUris: string[];
  signatureUri?: string;
  isCompleted: boolean;
  timestamp: number;
}

export async function queuePOD(pod: PendingPOD): Promise<void> {
  try {
    const existing = await SecureStore.getItemAsync(PENDING_PODS_KEY);
    const queue: PendingPOD[] = existing ? JSON.parse(existing) : [];
    queue.push(pod);
    await SecureStore.setItemAsync(PENDING_PODS_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to queue POD:', e);
  }
}

export async function getPendingPODs(): Promise<PendingPOD[]> {
  try {
    const data = await SecureStore.getItemAsync(PENDING_PODS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function clearPendingPODs(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_PODS_KEY);
}
