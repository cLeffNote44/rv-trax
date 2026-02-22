// ---------------------------------------------------------------------------
// RV Trax Mobile — useLocation Hook (device GPS)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Geolocation, {
  type GeolocationResponse,
} from '@react-native-community/geolocation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseLocationReturn {
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // iOS asks automatically when Geolocation APIs are called.
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Location Permission',
      message: 'RV Trax needs access to your location to show your position on the lot map.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLocation(): UseLocationReturn {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const startWatching = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setError('Location permission denied');
      setIsLoading(false);
      return;
    }

    watchId.current = Geolocation.watchPosition(
      (position: GeolocationResponse) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setHeading(position.coords.heading ?? null);
        setIsLoading(false);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5,
        interval: 5000,
        fastestInterval: 2000,
      },
    );
  }, []);

  useEffect(() => {
    void startWatching();

    return () => {
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [startWatching]);

  const refresh = useCallback(() => {
    if (watchId.current !== null) {
      Geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    void startWatching();
  }, [startWatching]);

  return { latitude, longitude, heading, isLoading, error, refresh };
}
