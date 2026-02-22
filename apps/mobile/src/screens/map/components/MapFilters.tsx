import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
} from 'react-native';
import { UnitStatus, UnitType } from '@rv-trax/shared';
import { useMapStore } from '@/stores/useMapStore';
import { useUnitStore } from '@/stores/useUnitStore';
import { getStatusColor } from './UnitMarker';
import { colors } from '@/theme/colors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const ALL_STATUSES = Object.values(UnitStatus);
const ALL_UNIT_TYPES = Object.values(UnitType);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MapFiltersProps {
  visible: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MapFilters: React.FC<MapFiltersProps> = ({ visible, onClose }) => {
  const filters = useMapStore((s) => s.filters);
  const setFilters = useMapStore((s) => s.setFilters);
  const units = useUnitStore((s) => s.units);

  // Local filter state so changes are not applied until user taps "Apply"
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    filters?.statuses ?? [],
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    filters?.types ?? [],
  );
  const [selectedMakes, setSelectedMakes] = useState<string[]>(
    filters?.makes ?? [],
  );

  // Derive available makes from the unit list
  const availableMakes = useMemo(() => {
    const makes = new Set(units.map((u) => u.make));
    return Array.from(makes).sort();
  }, [units]);

  // Count matching units
  const matchCount = useMemo(() => {
    return units.filter((u) => {
      if (selectedStatuses.length && !selectedStatuses.includes(u.status))
        return false;
      if (selectedTypes.length && !selectedTypes.includes(u.unit_type))
        return false;
      if (selectedMakes.length && !selectedMakes.includes(u.make))
        return false;
      return true;
    }).length;
  }, [units, selectedStatuses, selectedTypes, selectedMakes]);

  const toggleItem = useCallback(
    (list: string[], setList: (v: string[]) => void, item: string) => {
      setList(
        list.includes(item)
          ? list.filter((i) => i !== item)
          : [...list, item],
      );
    },
    [],
  );

  const handleApply = useCallback(() => {
    setFilters({
      statuses: selectedStatuses,
      types: selectedTypes,
      makes: selectedMakes,
    });
    onClose();
  }, [selectedStatuses, selectedTypes, selectedMakes, setFilters, onClose]);

  const handleReset = useCallback(() => {
    setSelectedStatuses([]);
    setSelectedTypes([]);
    setSelectedMakes([]);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filter Units</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* --- Status Section --- */}
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.chipGrid}>
              {ALL_STATUSES.map((status) => {
                const active = selectedStatuses.includes(status);
                const dotColor = getStatusColor(status);
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() =>
                      toggleItem(
                        selectedStatuses,
                        setSelectedStatuses,
                        status,
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <View
                      style={[styles.statusDot, { backgroundColor: dotColor }]}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {formatLabel(status)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* --- Unit Type Section --- */}
            <Text style={styles.sectionTitle}>Unit Type</Text>
            <View style={styles.chipGrid}>
              {ALL_UNIT_TYPES.map((type) => {
                const active = selectedTypes.includes(type);
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() =>
                      toggleItem(selectedTypes, setSelectedTypes, type)
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {formatLabel(type)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* --- Make Section --- */}
            {availableMakes.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Make</Text>
                <View style={styles.chipGrid}>
                  {availableMakes.map((make) => {
                    const active = selectedMakes.includes(make);
                    return (
                      <TouchableOpacity
                        key={make}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() =>
                          toggleItem(selectedMakes, setSelectedMakes, make)
                        }
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {make}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.matchCount}>{matchCount} units match</Text>
            <View style={styles.footerButtons}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}
                activeOpacity={0.7}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={handleApply}
                activeOpacity={0.7}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  scrollBody: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray700,
    marginBottom: 10,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  chipText: {
    fontSize: 13,
    color: colors.gray600,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  matchCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray500,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  resetButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray600,
  },
  applyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
});
