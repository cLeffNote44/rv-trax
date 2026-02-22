import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { BleManager } from 'react-native-ble-plx';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ScanStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

type ScanNav = NativeStackNavigationProp<ScanStackParamList>;

type ScanTab = 'qr' | 'ble' | 'nfc';

interface BleDevice {
  id: string;
  name: string | null;
  rssi: number;
  distance: string;
}

// ---------------------------------------------------------------------------
// BLE helpers
// ---------------------------------------------------------------------------

const bleManager = new BleManager();

// RV Trax tracker BLE service UUID (filter scan results to our devices)
const RV_TRAX_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';

/** Estimate distance from RSSI using log-distance path loss model. */
function rssiToDistance(rssi: number, txPower: number = -59): string {
  if (rssi >= 0) return '?';
  const ratio = (txPower - rssi) / 20;
  const meters = Math.pow(10, ratio);
  return meters < 1 ? `${(meters * 100).toFixed(0)}cm` : `${meters.toFixed(1)}m`;
}

/** Request BLE permissions on Android 12+ (API 31+). */
async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if ((Platform.Version as number) < 31) return true;

  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);

  return (
    result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
    result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
  );
}

// ---------------------------------------------------------------------------
// NFC helpers
// ---------------------------------------------------------------------------

/** Parse a text payload from an NDEF record (TNF 0x01 / RTD Text). */
function parseNdefText(payload: number[]): string | null {
  if (!payload.length) return null;
  // Byte 0: status byte — bits 5..0 = language-code length
  const langLen = payload[0] & 0x3f;
  const textBytes = payload.slice(1 + langLen);
  return String.fromCharCode(...textBytes);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ScannerScreen: React.FC = () => {
  const navigation = useNavigation<ScanNav>();
  const isFocused = useIsFocused();
  const [activeTab, setActiveTab] = useState<ScanTab>('qr');
  const [bleDevices, setBleDevices] = useState<BleDevice[]>([]);
  const [bleScanning, setBleScanning] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [bleError, setBleError] = useState<string | null>(null);

  // Camera setup
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const scanLockRef = useRef(false);

  const handleTrackerFound = useCallback(
    (trackerId: string) => {
      navigation.navigate('AssignTracker', { unitId: trackerId });
    },
    [navigation],
  );

  // QR code scanner — debounce to prevent double-navigation
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      const value = codes[0]?.value;
      if (!value || scanLockRef.current) return;
      scanLockRef.current = true;
      handleTrackerFound(value);
      // Reset lock after navigation settles
      setTimeout(() => { scanLockRef.current = false; }, 2000);
    },
  });

  // Request camera permission on mount if not yet granted
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Real BLE scan using react-native-ble-plx
  useEffect(() => {
    if (activeTab !== 'ble') {
      setBleDevices([]);
      setBleError(null);
      return;
    }

    let stateSubscription: { remove(): void } | null = null;
    let stopped = false;

    const startScan = async () => {
      // Request permissions on Android 12+
      const granted = await requestBlePermissions();
      if (!granted) {
        setBleError('Bluetooth permissions denied. Please enable in Settings.');
        return;
      }

      // Check BLE adapter state
      const currentState = await bleManager.state();
      if (currentState !== 'PoweredOn') {
        setBleError(
          currentState === 'PoweredOff'
            ? 'Bluetooth is turned off. Please enable Bluetooth.'
            : currentState === 'Unauthorized'
              ? 'Bluetooth permission not authorized.'
              : currentState === 'Unsupported'
                ? 'Bluetooth is not supported on this device.'
                : 'Bluetooth is initializing...',
        );
        // Listen for state changes in case user turns BLE on
        stateSubscription = bleManager.onStateChange((newState) => {
          if (newState === 'PoweredOn' && !stopped) {
            setBleError(null);
            stateSubscription?.remove();
            stateSubscription = null;
            startScan();
          }
        }, false);
        return;
      }

      setBleError(null);
      setBleScanning(true);
      setBleDevices([]);

      bleManager.startDeviceScan(
        [RV_TRAX_SERVICE_UUID],
        { allowDuplicates: true },
        (error, scannedDevice) => {
          if (stopped) return;
          if (error) {
            setBleScanning(false);
            setBleError(`Scan error: ${error.message}`);
            return;
          }
          if (!scannedDevice || !scannedDevice.id) return;

          const found: BleDevice = {
            id: scannedDevice.id,
            name: scannedDevice.localName ?? scannedDevice.name,
            rssi: scannedDevice.rssi ?? -100,
            distance: rssiToDistance(scannedDevice.rssi ?? -100),
          };

          setBleDevices((prev) => {
            const idx = prev.findIndex((d) => d.id === found.id);
            let next: BleDevice[];
            if (idx >= 0) {
              next = [...prev];
              next[idx] = found;
            } else {
              next = [...prev, found];
            }
            return next.sort((a, b) => b.rssi - a.rssi);
          });
        },
      );
    };

    startScan();

    return () => {
      stopped = true;
      bleManager.stopDeviceScan();
      setBleScanning(false);
      stateSubscription?.remove();
    };
  }, [activeTab]);

  const handleBleSelect = useCallback(
    (bleDevice: BleDevice) => {
      handleTrackerFound(bleDevice.id);
    },
    [handleTrackerFound],
  );

  const handleNfcTap = useCallback(async () => {
    setNfcError(null);
    setNfcReading(true);

    try {
      // Check NFC support and state
      const supported = await NfcManager.isSupported();
      if (!supported) {
        setNfcError('NFC is not supported on this device.');
        setNfcReading(false);
        return;
      }

      await NfcManager.start();

      // Android: check if NFC is enabled in system settings
      if (Platform.OS === 'android') {
        const enabled = await NfcManager.isEnabled();
        if (!enabled) {
          setNfcError('NFC is disabled. Please enable NFC in your device settings.');
          setNfcReading(false);
          return;
        }
      }

      // iOS: set the alert message for the system NFC sheet
      if (Platform.OS === 'ios') {
        NfcManager.setAlertMessageIOS('Hold your phone near the RV Trax tracker.');
      }

      // Request NDEF technology — blocks until tag is detected or cancelled
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Hold your phone near the RV Trax tracker.',
      });

      const tag = await NfcManager.getTag();

      if (!tag) {
        setNfcError('No tag detected. Please try again.');
        setNfcReading(false);
        await NfcManager.cancelTechnologyRequest();
        return;
      }

      // Try to extract device_eui from NDEF text record
      let deviceId = tag.id;
      if (tag.ndefMessage?.length) {
        for (const record of tag.ndefMessage) {
          const text = parseNdefText(record.payload);
          if (text) {
            deviceId = text;
            break;
          }
        }
      }

      await NfcManager.cancelTechnologyRequest();
      setNfcReading(false);
      handleTrackerFound(deviceId);
    } catch {
      setNfcReading(false);
      setNfcError('NFC read failed. Please try again.');
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch {
        // Ignore cleanup errors
      }
    }
  }, [handleTrackerFound]);

  const renderBleItem = useCallback(
    ({ item }: { item: BleDevice }) => (
      <TouchableOpacity
        style={styles.bleItem}
        onPress={() => handleBleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.bleItemLeft}>
          <Text style={styles.bleDeviceName}>
            {item.name || 'Unknown Device'}
          </Text>
          <Text style={styles.bleDeviceId}>{item.id}</Text>
        </View>
        <View style={styles.bleItemRight}>
          <Text style={styles.bleRssi}>{item.rssi} dBm</Text>
          <Text style={styles.bleDistance}>{item.distance}</Text>
        </View>
      </TouchableOpacity>
    ),
    [handleBleSelect],
  );

  return (
    <View style={styles.container}>
      {/* Tab Buttons */}
      <View style={styles.tabBar}>
        {(['qr', 'ble', 'nfc'] as ScanTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab === 'qr' ? 'QR Code' : tab === 'ble' ? 'BLE Scan' : 'NFC'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* QR Code Tab */}
      {activeTab === 'qr' && (
        <View style={styles.qrContainer}>
          {!hasPermission ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionText}>
                Allow camera access to scan tracker QR codes.
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={() => Linking.openSettings()}
                activeOpacity={0.8}
              >
                <Text style={styles.permissionButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          ) : !device ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>No Camera Available</Text>
              <Text style={styles.permissionText}>
                This device does not have a camera.
              </Text>
            </View>
          ) : (
            <View style={styles.cameraWrapper}>
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={isFocused && activeTab === 'qr'}
                codeScanner={codeScanner}
              />
              {/* QR viewfinder overlay */}
              <View style={styles.qrOverlay}>
                <View style={styles.qrFrame}>
                  <View style={[styles.qrCorner, styles.qrCornerTL]} />
                  <View style={[styles.qrCorner, styles.qrCornerTR]} />
                  <View style={[styles.qrCorner, styles.qrCornerBL]} />
                  <View style={[styles.qrCorner, styles.qrCornerBR]} />
                </View>
                <Text style={styles.cameraInstructionText}>
                  Point your camera at the tracker QR code
                </Text>
              </View>
            </View>
          )}
          <Text style={styles.qrHint}>
            The QR code is located on the back of each RV Trax tracker device.
          </Text>
        </View>
      )}

      {/* BLE Scan Tab */}
      {activeTab === 'ble' && (
        <View style={styles.bleContainer}>
          {bleError ? (
            <View style={styles.emptyBle}>
              <Text style={styles.bleErrorText}>{bleError}</Text>
              <TouchableOpacity
                style={styles.bleRetryButton}
                onPress={() => {
                  setBleError(null);
                  // Re-trigger the scan effect by toggling tab
                  setActiveTab('qr');
                  setTimeout(() => setActiveTab('ble'), 50);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.bleRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {bleScanning && (
                <View style={styles.scanningIndicator}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.scanningText}>Scanning for nearby devices...</Text>
                </View>
              )}

              {bleDevices.length === 0 && !bleScanning ? (
                <View style={styles.emptyBle}>
                  <Text style={styles.emptyBleText}>No devices found nearby</Text>
                  <Text style={styles.emptyBleSubtext}>
                    Make sure trackers are powered on and within range.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={bleDevices}
                  renderItem={renderBleItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.bleList}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </>
          )}
        </View>
      )}

      {/* NFC Tab */}
      {activeTab === 'nfc' && (
        <View style={styles.nfcContainer}>
          <View style={styles.nfcIconBox}>
            <Text style={styles.nfcIcon}>{'(( NFC ))'}</Text>
          </View>

          {nfcError ? (
            <>
              <Text style={styles.nfcErrorText}>{nfcError}</Text>
              <TouchableOpacity
                style={styles.nfcStartButton}
                onPress={handleNfcTap}
                activeOpacity={0.8}
              >
                <Text style={styles.nfcStartText}>Try Again</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.nfcInstruction}>
                {nfcReading
                  ? 'Hold your phone near the tracker...'
                  : 'Tap your phone to the tracker'}
              </Text>
              <Text style={styles.nfcSubtext}>
                Hold the back of your phone against the NFC tag on the tracker device.
              </Text>

              {nfcReading ? (
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                  style={styles.nfcSpinner}
                />
              ) : (
                <TouchableOpacity
                  style={styles.nfcStartButton}
                  onPress={handleNfcTap}
                  activeOpacity={0.8}
                >
                  <Text style={styles.nfcStartText}>Start NFC Scan</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
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

  // QR
  qrContainer: {
    flex: 1,
    alignItems: 'center',
  },
  cameraWrapper: {
    width: '100%',
    flex: 1,
    position: 'relative',
  },
  qrOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  permissionText: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
  },
  permissionButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  qrFrame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  qrCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.white,
  },
  qrCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  qrCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  qrCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  qrCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  cameraInstructionText: {
    color: colors.white,
    fontSize: 14,
    marginTop: spacing.lg,
    textAlign: 'center',
    opacity: 0.8,
  },
  qrHint: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },

  // BLE
  bleContainer: {
    flex: 1,
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
  },
  scanningText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  bleList: {
    paddingTop: spacing.sm,
  },
  bleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bleItemLeft: {
    flex: 1,
  },
  bleDeviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
  },
  bleDeviceId: {
    fontSize: 12,
    color: colors.gray400,
    marginTop: 2,
  },
  bleItemRight: {
    alignItems: 'flex-end',
  },
  bleRssi: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
  },
  bleDistance: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  emptyBle: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyBleText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray700,
  },
  emptyBleSubtext: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  bleErrorText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  bleRetryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
  },
  bleRetryText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },

  // NFC
  nfcContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  nfcIconBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  nfcIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  nfcInstruction: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  nfcSubtext: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  nfcErrorText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  nfcSpinner: {
    marginTop: spacing.md,
  },
  nfcStartButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
  },
  nfcStartText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
