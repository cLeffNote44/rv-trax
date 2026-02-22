// ---------------------------------------------------------------------------
// RV Trax Mobile — OfflineBanner Component
// ---------------------------------------------------------------------------

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineStore } from '../stores/offlineStore';
import { colors } from '../theme/colors';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const OfflineBanner: React.FC = () => {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top > 0 ? insets.top : 8 }]}>
      <Text style={styles.text}>
        You're offline — showing cached data
      </Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warning,
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
