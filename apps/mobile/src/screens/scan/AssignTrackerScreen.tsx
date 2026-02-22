import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export const AssignTrackerScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assign Tracker</Text>
      <Text style={styles.subtitle}>
        Pair a BLE beacon or NFC tag with an RV unit.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  title: {
    ...typography.heading2,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    textAlign: 'center',
  },
});
