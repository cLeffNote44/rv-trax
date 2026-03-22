import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { ScanStackParamList } from '@/navigation/types';
import type { Unit, Tracker } from '@rv-trax/shared';
import { useUnitStore } from '@/stores/useUnitStore';
import { useTrackerStore } from '@/stores/useTrackerStore';
import { api } from '@/services/api';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

type AssignRoute = RouteProp<ScanStackParamList, 'AssignTracker'>;

type Step = 'tracker-info' | 'enter-stock' | 'confirm';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AssignmentFlow: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<AssignRoute>();
  const trackerId = route.params.unitId; // The scanned tracker/device ID

  const units = useUnitStore((s) => s.units);
  const assignTracker = useTrackerStore((s) => s.assignTracker);
  const unassignTracker = useTrackerStore((s) => s.unassignTracker);

  const [step, setStep] = useState<Step>('tracker-info');
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [currentUnit, setCurrentUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Stock number input
  const [stockInput, setStockInput] = useState('');
  const [matchedUnit, setMatchedUnit] = useState<Unit | null>(null);

  // Bulk mode
  const [bulkMode, setBulkMode] = useState(false);

  // Fetch tracker info on mount
  useEffect(() => {
    const fetchTracker = async () => {
      setLoading(true);
      try {
        const data = await api
          .get(`api/v1/trackers/${trackerId}`)
          .json<{ tracker: Tracker; unit: Unit | null }>();
        setTracker(data.tracker);
        if (data.unit) {
          setCurrentUnit(data.unit);
        } else {
          // Unassigned tracker, skip to step 2
          setStep('enter-stock');
        }
      } catch {
        setError('Unable to fetch tracker information.');
      } finally {
        setLoading(false);
      }
    };
    fetchTracker();
  }, [trackerId]);

  // Auto-complete stock number
  useEffect(() => {
    if (!stockInput.trim()) {
      setMatchedUnit(null);
      return;
    }
    const match = units.find(
      (u) => u.stock_number.toLowerCase() === stockInput.trim().toLowerCase(),
    );
    setMatchedUnit(match ?? null);
  }, [stockInput, units]);

  const suggestions = stockInput.trim()
    ? units
        .filter((u) =>
          u.stock_number.toLowerCase().startsWith(stockInput.trim().toLowerCase()),
        )
        .slice(0, 5)
    : [];

  const handleUnassign = useCallback(async () => {
    if (!tracker) return;
    setAssigning(true);
    setError(null);
    try {
      await unassignTracker(tracker.id);
      setCurrentUnit(null);
      setStep('enter-stock');
    } catch {
      setError('Failed to unassign tracker.');
    } finally {
      setAssigning(false);
    }
  }, [tracker, unassignTracker]);

  const handleProceedToConfirm = useCallback(() => {
    if (!matchedUnit) {
      setError('Please enter a valid stock number.');
      return;
    }
    setError(null);
    setStep('confirm');
  }, [matchedUnit]);

  const handleConfirmAssignment = useCallback(async () => {
    if (!tracker || !matchedUnit) return;
    setAssigning(true);
    setError(null);
    try {
      await assignTracker(tracker.id, matchedUnit.id);
      setSuccess(true);

      if (bulkMode) {
        // Go back to scanner after brief pause
        setTimeout(() => {
          navigation.goBack();
        }, 1200);
      }
    } catch {
      setError('Failed to assign tracker. Please try again.');
    } finally {
      setAssigning(false);
    }
  }, [tracker, matchedUnit, assignTracker, bulkMode, navigation]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Fetching tracker info...</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Success state
  // ---------------------------------------------------------------------------

  if (success) {
    return (
      <View style={styles.centered}>
        <View style={styles.successCircle}>
          <Text style={styles.successCheck}>{'\u2713'}</Text>
        </View>
        <Text style={styles.successTitle}>Assignment Complete</Text>
        <Text style={styles.successSubtext}>
          Tracker {tracker?.device_eui} assigned to #{matchedUnit?.stock_number}
        </Text>
        {!bulkMode && (
          <TouchableOpacity
            style={styles.viewMapButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.viewMapText}>View on Map</Text>
          </TouchableOpacity>
        )}
        {bulkMode && (
          <Text style={styles.bulkRedirectText}>
            Returning to scanner...
          </Text>
        )}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 1: Tracker Info
  // ---------------------------------------------------------------------------

  if (step === 'tracker-info' && tracker) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.stepLabel}>Step 1 of 3</Text>
          <Text style={styles.stepTitle}>Tracker Information</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Device ID</Text>
            <Text style={styles.cardValue}>{tracker.device_eui}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Status</Text>
            <Text style={styles.cardValue}>{tracker.status}</Text>
          </View>
          {tracker.battery_pct != null && (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Battery</Text>
              <Text style={styles.cardValue}>{tracker.battery_pct}%</Text>
            </View>
          )}
        </View>

        {currentUnit && (
          <>
            <Text style={styles.assignedLabel}>Currently Assigned To:</Text>
            <View style={styles.card}>
              <Text style={styles.unitTitle}>
                #{currentUnit.stock_number} - {currentUnit.year}{' '}
                {currentUnit.make} {currentUnit.model}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.unassignButton}
              onPress={handleUnassign}
              disabled={assigning}
              activeOpacity={0.8}
            >
              {assigning ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.unassignText}>Unassign Tracker</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
      </ScrollView>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 2: Enter Stock Number
  // ---------------------------------------------------------------------------

  if (step === 'enter-stock') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Bulk mode toggle */}
        <View style={styles.bulkToggleRow}>
          <Text style={styles.bulkToggleLabel}>Bulk Mode</Text>
          <Switch
            value={bulkMode}
            onValueChange={setBulkMode}
            trackColor={{ true: colors.primary, false: colors.gray300 }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.header}>
          <Text style={styles.stepLabel}>Step 2 of 3</Text>
          <Text style={styles.stepTitle}>Enter Stock Number</Text>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.stockInput}
            placeholder="Enter stock number"
            placeholderTextColor={colors.gray400}
            value={stockInput}
            onChangeText={setStockInput}
            autoCapitalize="characters"
            autoFocus
          />
        </View>

        {/* Autocomplete suggestions */}
        {suggestions.length > 0 && !matchedUnit && (
          <View style={styles.suggestionsBox}>
            {suggestions.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.suggestionItem}
                onPress={() => setStockInput(u.stock_number)}
              >
                <Text style={styles.suggestionStock}>
                  #{u.stock_number}
                </Text>
                <Text style={styles.suggestionDesc}>
                  {u.year} {u.make} {u.model}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Matched unit preview */}
        {matchedUnit && (
          <View style={styles.matchedCard}>
            <Text style={styles.matchedTitle}>Unit Found</Text>
            <Text style={styles.matchedDesc}>
              {matchedUnit.year} {matchedUnit.make} {matchedUnit.model}
            </Text>
            <Text style={styles.matchedVin}>
              VIN: {matchedUnit.vin || 'N/A'}
            </Text>
          </View>
        )}

        {/* Not found */}
        {stockInput.trim().length >= 3 &&
          suggestions.length === 0 &&
          !matchedUnit && (
            <View style={styles.notFoundBox}>
              <Text style={styles.notFoundText}>
                No unit found with stock #{stockInput.trim()}
              </Text>
              <TouchableOpacity
                style={styles.createNewButton}
                onPress={() =>
                  Alert.alert(
                    'Create Unit',
                    'Unit creation is available in the web dashboard. Enter the unit there and return to assign the tracker.',
                  )
                }
              >
                <Text style={styles.createNewText}>Create New Unit</Text>
              </TouchableOpacity>
            </View>
          )}

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.proceedButton,
            !matchedUnit && styles.proceedButtonDisabled,
          ]}
          onPress={handleProceedToConfirm}
          disabled={!matchedUnit}
          activeOpacity={0.8}
        >
          <Text style={styles.proceedText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 3: Confirm
  // ---------------------------------------------------------------------------

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <Text style={styles.stepLabel}>Step 3 of 3</Text>
        <Text style={styles.stepTitle}>Confirm Assignment</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.confirmLabel}>Tracker</Text>
        <Text style={styles.confirmValue}>{tracker?.device_eui}</Text>
      </View>

      <View style={styles.arrowContainer}>
        <Text style={styles.arrowText}>{'\\u2193'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.confirmLabel}>Unit</Text>
        <Text style={styles.confirmValue}>
          #{matchedUnit?.stock_number}
        </Text>
        <Text style={styles.confirmDesc}>
          {matchedUnit?.year} {matchedUnit?.make} {matchedUnit?.model}
        </Text>
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <TouchableOpacity
        style={styles.confirmButton}
        onPress={handleConfirmAssignment}
        disabled={assigning}
        activeOpacity={0.8}
      >
        {assigning ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.confirmButtonText}>Confirm Assignment</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backStepButton}
        onPress={() => setStep('enter-stock')}
        disabled={assigning}
      >
        <Text style={styles.backStepText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
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
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: spacing.md,
  },

  // Bulk toggle
  bulkToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 10,
    marginBottom: spacing.md,
  },
  bulkToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray700,
  },

  // Steps
  header: {
    marginBottom: spacing.lg,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.gray900,
  },

  // Card
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  cardLabel: {
    fontSize: 14,
    color: colors.gray500,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray800,
  },

  assignedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray600,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  unitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },
  unassignButton: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  unassignText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },

  // Stock input
  inputRow: {
    marginBottom: spacing.md,
  },
  stockInput: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
  },

  // Suggestions
  suggestionsBox: {
    backgroundColor: colors.white,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionStock: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
  },
  suggestionDesc: {
    fontSize: 13,
    color: colors.gray500,
    marginTop: 2,
  },

  // Matched
  matchedCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success,
  },
  matchedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
    marginBottom: 4,
  },
  matchedDesc: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },
  matchedVin: {
    fontSize: 13,
    color: colors.gray500,
    marginTop: 4,
  },

  // Not found
  notFoundBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: 14,
    color: colors.gray700,
    marginBottom: spacing.sm,
  },
  createNewButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.warning,
    borderRadius: 8,
  },
  createNewText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  // Proceed
  proceedButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  proceedButtonDisabled: {
    opacity: 0.4,
  },
  proceedText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // Confirm
  arrowContainer: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  arrowText: {
    fontSize: 24,
    color: colors.gray400,
  },
  confirmLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray500,
    marginBottom: 4,
  },
  confirmValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
  },
  confirmDesc: {
    fontSize: 14,
    color: colors.gray600,
    marginTop: 4,
  },
  confirmButton: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  backStepButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  backStepText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },

  // Error
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },

  // Success
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  successCheck: {
    fontSize: 40,
    color: colors.white,
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  successSubtext: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  viewMapButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
  },
  viewMapText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  bulkRedirectText: {
    fontSize: 14,
    color: colors.gray500,
    fontStyle: 'italic',
  },
});
