import * as Location from 'expo-location';
import { apiFetch } from './api';

let _watchSubscription: Location.LocationSubscription | null = null;

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function requestBackgroundPermission(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    const granted = await requestLocationPermission();
    if (!granted) return null;
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch {
    return null;
  }
}

export async function sendLocation(
  lat: number,
  lng: number,
  accuracy?: number,
  speed?: number,
  heading?: number,
): Promise<void> {
  try {
    await apiFetch('/driver/location', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, accuracy, speed, heading }),
    });
  } catch (e) {
    console.warn('Failed to send location:', e);
  }
}

export async function startLocationTracking(intervalMs: number = 60000): Promise<void> {
  const granted = await requestLocationPermission();
  if (!granted) return;

  stopLocationTracking();

  _watchSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: intervalMs,
      distanceInterval: 50,
    },
    (location) => {
      sendLocation(
        location.coords.latitude,
        location.coords.longitude,
        location.coords.accuracy ?? undefined,
        location.coords.speed ?? undefined,
        location.coords.heading ?? undefined,
      );
    },
  );
}

export function stopLocationTracking(): void {
  if (_watchSubscription) {
    _watchSubscription.remove();
    _watchSubscription = null;
  }
}
