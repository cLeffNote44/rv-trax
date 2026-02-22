// ---------------------------------------------------------------------------
// RV Trax Mobile — LoadingScreen Component
// ---------------------------------------------------------------------------

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LoadingScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.title}>RV Trax</Text>
      <Text style={styles.subtitle}>Loading...</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    ...typography.heading2,
    color: colors.primary,
    marginTop: 20,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    marginTop: 8,
  },
});
