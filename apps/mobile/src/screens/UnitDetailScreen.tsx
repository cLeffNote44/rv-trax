import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MapStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

/**
 * UnitDetailScreen is shared across multiple tab stacks (Map, Search, Tasks).
 * It always receives { unitId: string } as route params.
 *
 * We type it against MapStackParamList here; callers from other stacks pass
 * the same shape so this is safe at runtime.
 */
type Props = NativeStackScreenProps<MapStackParamList, 'UnitDetail'>;

export const UnitDetailScreen: React.FC<Props> = ({ route }) => {
  const { unitId } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unit Detail</Text>
      <Text style={styles.unitId}>ID: {unitId}</Text>
      <Text style={styles.subtitle}>
        Full unit information, location history, and tracker data will appear
        here.
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
    marginBottom: spacing.xs,
  },
  unitId: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    textAlign: 'center',
  },
});
