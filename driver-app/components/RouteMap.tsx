import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, statusColors } from '@/constants/theme';
import type { DriverRoute, RouteStop } from '@/types';

interface Props {
  route: DriverRoute;
  onStopPress?: (stop: RouteStop) => void;
}

function getStatusColor(status: string): string {
  return status in statusColors ? statusColors[status as keyof typeof statusColors].color : colors.warning;
}

export function RouteMap({ route, onStopPress }: Props) {
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    })();
  }, []);

  const stopsWithCoords = route.stops.filter((s) => s.lat && s.lng);

  const fitToMarkers = () => {
    if (mapRef.current && stopsWithCoords.length > 0) {
      const coords = stopsWithCoords.map((s) => ({
        latitude: s.lat!,
        longitude: s.lng!,
      }));
      if (userLocation) {
        coords.push({ latitude: userLocation.lat, longitude: userLocation.lng });
      }
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(fitToMarkers, 500);
    return () => clearTimeout(timer);
  }, [stopsWithCoords.length, userLocation]);

  // Default center: Croatia
  const initialRegion = {
    latitude: stopsWithCoords[0]?.lat || 45.8,
    longitude: stopsWithCoords[0]?.lng || 15.97,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Stop markers */}
        {stopsWithCoords.map((stop) => (
          <Marker
            key={`stop-${stop.id}`}
            coordinate={{ latitude: stop.lat!, longitude: stop.lng! }}
            onPress={() => onStopPress?.(stop)}
          >
            <View style={[styles.markerContainer, { borderColor: getStatusColor(stop.status) }]}>
              <Text style={[styles.markerText, { color: getStatusColor(stop.status) }]}>
                {stop.redoslijed}
              </Text>
            </View>
          </Marker>
        ))}

        {/* Route polyline */}
        {route.polyline && route.polyline.length > 0 && (
          <Polyline
            coordinates={route.polyline.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Fit to markers button */}
      <TouchableOpacity style={styles.fitButton} onPress={fitToMarkers}>
        <Ionicons name="scan" size={22} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  markerText: {
    fontSize: 14,
    fontWeight: '800',
  },
  fitButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
