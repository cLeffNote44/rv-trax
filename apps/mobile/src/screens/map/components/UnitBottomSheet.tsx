import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MapStackParamList } from '@/navigation/types';
import type { Unit } from '@rv-trax/shared';
import { getStatusColor } from './UnitMarker';
import { colors } from '@/theme/colors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function daysOnLot(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UnitBottomSheetProps {
  unit: Unit | null;
  trackerBattery?: number | null;
  onNavigate: (unit: Unit) => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const UnitBottomSheet: React.FC<UnitBottomSheetProps> = ({
  unit,
  trackerBattery,
  onNavigate,
  onDismiss,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<MapStackParamList>>();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['25%', '60%'], []);

  const handleViewDetails = useCallback(() => {
    if (unit) {
      navigation.navigate('UnitDetail', { unitId: unit.id });
    }
  }, [navigation, unit]);

  const handleNavigateToUnit = useCallback(() => {
    if (unit) {
      onNavigate(unit);
    }
  }, [unit, onNavigate]);

  if (!unit) return null;

  const statusColor = getStatusColor(unit.status);
  const days = daysOnLot(unit.created_at);
  const locationText = [unit.current_zone, unit.current_row]
    .filter(Boolean)
    .join(' / ');

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onDismiss}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={styles.content}>
        {/* Collapsed content: always visible */}
        <View style={styles.collapsedRow}>
          {unit.thumbnail_url ? (
            <Image
              source={{ uri: unit.thumbnail_url }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <Text style={styles.placeholderText}>RV</Text>
            </View>
          )}

          <View style={styles.summaryInfo}>
            <Text style={styles.stockNumber}>#{unit.stock_number}</Text>
            <Text style={styles.yearMakeModel} numberOfLines={1}>
              {unit.year} {unit.make} {unit.model}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusBadgeText}>
                  {formatStatus(unit.status)}
                </Text>
              </View>
              {locationText ? (
                <Text style={styles.locationText}>{locationText}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Expanded content */}
        <View style={styles.expandedSection}>
          <View style={styles.divider} />

          {/* Detail rows */}
          <View style={styles.detailGrid}>
            {unit.vin ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>VIN</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {unit.vin}
                </Text>
              </View>
            ) : null}

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Days on Lot</Text>
              <Text style={styles.detailValue}>{days}</Text>
            </View>

            {trackerBattery != null && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Tracker Battery</Text>
                <Text style={styles.detailValue}>{trackerBattery}%</Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.navigateButton}
              onPress={handleNavigateToUnit}
              activeOpacity={0.7}
            >
              <Text style={styles.navigateButtonText}>Navigate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.detailsButton}
              onPress={handleViewDetails}
              activeOpacity={0.7}
            >
              <Text style={styles.detailsButtonText}>View Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  handleIndicator: {
    backgroundColor: colors.gray300,
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray400,
  },
  summaryInfo: {
    flex: 1,
    marginLeft: 14,
  },
  stockNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray500,
  },
  yearMakeModel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.gray900,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  locationText: {
    fontSize: 13,
    color: colors.gray500,
  },
  expandedSection: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  detailGrid: {
    gap: 10,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: colors.gray500,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray800,
    maxWidth: '60%',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  navigateButton: {
    flex: 1,
    backgroundColor: colors.gray100,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  navigateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray700,
  },
  detailsButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
});
