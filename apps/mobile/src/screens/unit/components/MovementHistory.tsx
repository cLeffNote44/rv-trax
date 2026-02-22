import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import type { MovementEvent } from '@rv-trax/shared';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MovementHistoryProps {
  events: MovementEvent[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MovementHistory: React.FC<MovementHistoryProps> = ({ events }) => {
  const renderItem = ({ item, index }: { item: MovementEvent; index: number }) => {
    const fromLabel = item.from_zone || 'Unknown';
    const toLabel = item.to_zone || 'Unknown';

    return (
      <View style={styles.eventRow}>
        {/* Timeline */}
        <View style={styles.timelineColumn}>
          <View style={styles.dot} />
          {index < events.length - 1 && <View style={styles.line} />}
        </View>

        {/* Content */}
        <View style={styles.eventContent}>
          <Text style={styles.eventDate}>{formatDate(item.ended_at)}</Text>
          <Text style={styles.eventMove}>
            {fromLabel}{' '}
            <Text style={styles.arrow}>{'->'}</Text>{' '}
            {toLabel}
          </Text>
          {item.distance_m > 0 && (
            <Text style={styles.eventDistance}>
              {item.distance_m < 1000
                ? `${Math.round(item.distance_m)}m`
                : `${(item.distance_m / 1000).toFixed(1)}km`}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Movement History</Text>
      <Text style={styles.subtitle}>Last 14 days</Text>

      {events.length === 0 ? (
        <Text style={styles.emptyText}>No movement recorded.</Text>
      ) : (
        <FlatList
          data={events}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
  },
  subtitle: {
    fontSize: 12,
    color: colors.gray400,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray400,
    fontStyle: 'italic',
  },
  eventRow: {
    flexDirection: 'row',
    minHeight: 50,
  },
  timelineColumn: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.gray200,
    marginTop: 4,
  },
  eventContent: {
    flex: 1,
    paddingBottom: 16,
    paddingLeft: spacing.sm,
  },
  eventDate: {
    fontSize: 12,
    color: colors.gray500,
    marginBottom: 2,
  },
  eventMove: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray800,
  },
  arrow: {
    color: colors.gray400,
  },
  eventDistance: {
    fontSize: 12,
    color: colors.gray400,
    marginTop: 2,
  },
});
