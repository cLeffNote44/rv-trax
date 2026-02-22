import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TasksStackParamList } from '@/navigation/types';
import type { WorkOrder, Unit } from '@rv-trax/shared';
import { api } from '@/services/api';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

type TasksNav = NativeStackNavigationProp<TasksStackParamList>;

type TaskTab = 'my' | 'all';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
      return colors.error;
    case 'normal':
      return colors.info;
    case 'low':
      return colors.gray400;
    default:
      return colors.gray400;
  }
}

function getOrderTypeBadgeColor(type: string): string {
  switch (type) {
    case 'pdi':
      return colors.info;
    case 'detail':
      return colors.success;
    case 'warranty':
    case 'recall':
      return colors.warning;
    case 'customer_repair':
      return colors.error;
    default:
      return colors.gray500;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

interface TaskWithUnit extends WorkOrder {
  unit?: Unit;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TasksScreen: React.FC = () => {
  const navigation = useNavigation<TasksNav>();
  const [activeTab, setActiveTab] = useState<TaskTab>('my');
  const [tasks, setTasks] = useState<TaskWithUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const endpoint =
        activeTab === 'my'
          ? 'api/v1/work-orders?assigned_to=me'
          : 'api/v1/work-orders';

      const response = await api
        .get(endpoint)
        .json<{ data: TaskWithUnit[] }>();
      setTasks(response.data);
    } catch {
      // Keep existing data on error
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    fetchTasks().finally(() => setLoading(false));
  }, [fetchTasks]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  }, [fetchTasks]);

  const handleTaskPress = useCallback(
    (task: TaskWithUnit) => {
      navigation.navigate('UnitDetail', { unitId: task.unit_id });
    },
    [navigation],
  );

  const handleComplete = useCallback(
    async (task: TaskWithUnit) => {
      try {
        await api.patch(`api/v1/work-orders/${task.id}`, {
          json: { status: 'complete' },
        });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: 'complete' as any } : t,
          ),
        );
      } catch {
        Alert.alert('Error', 'Failed to complete task. Please try again.');
      }
    },
    [],
  );

  const renderTask = useCallback(
    ({ item }: { item: TaskWithUnit }) => {
      const isComplete = item.status === 'complete';
      return (
        <TouchableOpacity
          style={[styles.taskCard, isComplete && styles.taskCardComplete]}
          onPress={() => handleTaskPress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.taskCardContent}>
            {/* Unit thumbnail */}
            {item.unit?.thumbnail_url ? (
              <Image
                source={{ uri: item.unit.thumbnail_url }}
                style={styles.taskThumb}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.taskThumb, styles.taskThumbPlaceholder]}>
                <Text style={styles.taskThumbText}>RV</Text>
              </View>
            )}

            {/* Task info */}
            <View style={styles.taskInfo}>
              <Text style={styles.taskStock} numberOfLines={1}>
                #{item.unit?.stock_number || item.unit_id}
              </Text>

              <View style={styles.badgeRow}>
                {/* Order type badge */}
                <View
                  style={[
                    styles.typeBadge,
                    {
                      backgroundColor: getOrderTypeBadgeColor(
                        item.order_type,
                      ),
                    },
                  ]}
                >
                  <Text style={styles.typeBadgeText}>
                    {formatStatus(item.order_type)}
                  </Text>
                </View>

                {/* Priority badge */}
                <View
                  style={[
                    styles.priorityBadge,
                    {
                      borderColor: getPriorityColor(item.priority),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityText,
                      { color: getPriorityColor(item.priority) },
                    ]}
                  >
                    {formatStatus(item.priority)}
                  </Text>
                </View>
              </View>

              <View style={styles.taskMeta}>
                <Text style={styles.taskStatus}>
                  {formatStatus(item.status)}
                </Text>
                {item.due_date && (
                  <Text style={styles.taskDue}>
                    Due {formatDate(item.due_date)}
                  </Text>
                )}
              </View>
            </View>

            {/* Complete button */}
            {!isComplete && (
              <TouchableOpacity
                style={styles.completeButton}
                onPress={() => handleComplete(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={styles.completeCircle} />
              </TouchableOpacity>
            )}
            {isComplete && (
              <View style={styles.completedCheck}>
                <Text style={styles.completedCheckText}>{'\\u2713'}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [handleTaskPress, handleComplete],
  );

  return (
    <View style={styles.container}>
      {/* Tab headers */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.tabActive]}
          onPress={() => setActiveTab('my')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'my' && styles.tabTextActive,
            ]}
          >
            My Tasks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'all' && styles.tabTextActive,
            ]}
          >
            All Tasks
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No tasks</Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'my'
              ? "You don't have any assigned tasks."
              : 'No tasks found for this dealership.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          renderItem={renderTask}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
    flex: 1,
    backgroundColor: colors.surface,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.gray100,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray600,
  },
  tabTextActive: {
    color: colors.white,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  taskCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  taskCardComplete: {
    opacity: 0.6,
  },
  taskCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  taskThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  taskThumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskThumbText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray400,
  },
  taskInfo: {
    flex: 1,
    marginLeft: 12,
  },
  taskStock: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  taskStatus: {
    fontSize: 12,
    color: colors.gray500,
  },
  taskDue: {
    fontSize: 12,
    color: colors.gray400,
  },
  completeButton: {
    padding: spacing.sm,
  },
  completeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray300,
  },
  completedCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  completedCheckText: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '700',
  },
});
