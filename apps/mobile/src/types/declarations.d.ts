// ---------------------------------------------------------------------------
// WebSocket MessageEvent for React Native
// ---------------------------------------------------------------------------

interface MessageEvent {
  data: string | ArrayBuffer | Blob;
  origin: string;
  lastEventId: string;
}

// ---------------------------------------------------------------------------
// Type declarations for native modules that may not ship their own .d.ts
// ---------------------------------------------------------------------------

declare module '@react-native-firebase/app' {
  export interface FirebaseApp {
    name: string;
    options: Record<string, unknown>;
  }

  function firebase(): FirebaseApp;
  export default firebase;
}

declare module '@react-native-firebase/messaging' {
  export type AuthorizationStatus = 0 | 1 | 2;

  export interface RemoteMessage {
    messageId?: string;
    notification?: {
      title?: string;
      body?: string;
    };
    data?: Record<string, string>;
    from?: string;
    sentTime?: number;
  }

  export interface FirebaseMessaging {
    getToken(): Promise<string>;
    deleteToken(): Promise<void>;
    hasPermission(): Promise<AuthorizationStatus>;
    requestPermission(): Promise<AuthorizationStatus>;
    onMessage(listener: (message: RemoteMessage) => void): () => void;
    onNotificationOpenedApp(listener: (message: RemoteMessage) => void): () => void;
    getInitialNotification(): Promise<RemoteMessage | null>;
    setBackgroundMessageHandler(handler: (message: RemoteMessage) => Promise<void>): void;
    onTokenRefresh(listener: (token: string) => void): () => void;
  }

  function messaging(): FirebaseMessaging;
  export default messaging;
}

declare module '@react-native-community/geolocation' {
  export interface GeolocationResponse {
    coords: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number;
      altitudeAccuracy: number | null;
      heading: number | null;
      speed: number | null;
    };
    timestamp: number;
  }

  interface GeolocationError {
    code: number;
    message: string;
    PERMISSION_DENIED: number;
    POSITION_UNAVAILABLE: number;
    TIMEOUT: number;
  }

  interface GeoOptions {
    timeout?: number;
    maximumAge?: number;
    enableHighAccuracy?: boolean;
    distanceFilter?: number;
    interval?: number;
    fastestInterval?: number;
    useSignificantChanges?: boolean;
  }

  const Geolocation: {
    getCurrentPosition: (
      success: (position: GeolocationResponse) => void,
      error?: (error: GeolocationError) => void,
      options?: GeoOptions,
    ) => void;
    watchPosition: (
      success: (position: GeolocationResponse) => void,
      error?: (error: GeolocationError) => void,
      options?: GeoOptions,
    ) => number;
    clearWatch: (watchId: number) => void;
    stopObserving: () => void;
    setRNConfiguration: (config: { skipPermissionRequests?: boolean; authorizationLevel?: string }) => void;
    requestAuthorization: (success?: () => void, error?: (error: GeolocationError) => void) => void;
  };

  export default Geolocation;
  export type { GeolocationError, GeoOptions };
}

declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    type: string;
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    details: unknown;
  }

  const NetInfo: {
    addEventListener: (listener: (state: NetInfoState) => void) => () => void;
    fetch: (requestedInterface?: string) => Promise<NetInfoState>;
    refresh: () => Promise<NetInfoState>;
  };

  export default NetInfo;
  export type { NetInfoState as NetInfoStateType };
}

declare module 'react-native-maps' {
  import type { Component, PropsWithChildren, ReactNode } from 'react';
  import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

  export interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }

  export interface LatLng {
    latitude: number;
    longitude: number;
  }

  export interface MapViewProps {
    style?: StyleProp<ViewStyle>;
    provider?: string | null;
    mapType?: 'standard' | 'satellite' | 'hybrid' | 'terrain';
    initialRegion?: Region;
    region?: Region;
    onRegionChange?: (region: Region) => void;
    onRegionChangeComplete?: (region: Region) => void;
    showsUserLocation?: boolean;
    showsMyLocationButton?: boolean;
    showsCompass?: boolean;
    toolbarEnabled?: boolean;
    rotateEnabled?: boolean;
    scrollEnabled?: boolean;
    zoomEnabled?: boolean;
    pitchEnabled?: boolean;
    children?: ReactNode;
    ref?: React.Ref<MapView>;
  }

  export interface MarkerProps {
    coordinate: LatLng;
    title?: string;
    description?: string;
    onPress?: () => void;
    tracksViewChanges?: boolean;
    children?: ReactNode;
  }

  export interface PolygonProps {
    coordinates: LatLng[];
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  }

  export const PROVIDER_GOOGLE: string;

  export class Marker extends Component<MarkerProps> {}
  export class Polygon extends Component<PolygonProps> {}

  export default class MapView extends Component<MapViewProps> {
    animateToRegion(region: Region, duration?: number): void;
    fitToCoordinates(coordinates: LatLng[], options?: { edgePadding?: { top: number; right: number; bottom: number; left: number }; animated?: boolean }): void;
  }
}

declare module '@gorhom/bottom-sheet' {
  import type { Component, ReactNode } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  export interface BottomSheetProps {
    snapPoints: (string | number)[];
    index?: number;
    enablePanDownToClose?: boolean;
    onChange?: (index: number) => void;
    onClose?: () => void;
    backgroundStyle?: StyleProp<ViewStyle>;
    handleIndicatorStyle?: StyleProp<ViewStyle>;
    children?: ReactNode;
    ref?: React.Ref<BottomSheet>;
  }

  export interface BottomSheetViewProps {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
  }

  export default class BottomSheet extends Component<BottomSheetProps> {
    snapToIndex(index: number): void;
    snapToPosition(position: string | number): void;
    expand(): void;
    collapse(): void;
    close(): void;
    forceClose(): void;
  }

  export class BottomSheetView extends Component<BottomSheetViewProps> {}
}

declare module 'react-native-gesture-handler' {
  import type { Component, ReactNode } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  export interface GestureHandlerRootViewProps {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
  }

  export class GestureHandlerRootView extends Component<GestureHandlerRootViewProps> {}
}

declare module 'react-native-mmkv' {
  export interface MMKVConfiguration {
    id?: string;
    path?: string;
    encryptionKey?: string;
  }

  export class MMKV {
    constructor(config?: MMKVConfiguration);
    set(key: string, value: string | number | boolean): void;
    getString(key: string): string | undefined;
    getNumber(key: string): number;
    getBoolean(key: string): boolean;
    delete(key: string): void;
    getAllKeys(): string[];
    contains(key: string): boolean;
    clearAll(): void;
  }
}

declare module 'react-native-vector-icons/Ionicons' {
  import type { Component } from 'react';
  import type { StyleProp, TextStyle } from 'react-native';

  export interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
  }

  export default class Ionicons extends Component<IconProps> {}
}

declare module 'react-native-vision-camera' {
  import type { Component, ReactNode } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  export interface CameraDevice {
    id: string;
    position: 'front' | 'back';
    hasFlash: boolean;
    hasTorch: boolean;
  }

  export type CodeType = 'qr' | 'ean-13' | 'ean-8' | 'code-128' | 'code-39' | 'code-93' | 'upc-a' | 'upc-e' | 'data-matrix' | 'aztec' | 'pdf-417';

  export interface Code {
    type: CodeType;
    value: string;
    frame?: { x: number; y: number; width: number; height: number };
  }

  export interface CodeScannerOptions {
    codeTypes: CodeType[];
    onCodeScanned: (codes: Code[]) => void;
  }

  export interface CameraProps {
    style?: StyleProp<ViewStyle>;
    device: CameraDevice;
    isActive: boolean;
    codeScanner?: CodeScannerOptions;
    torch?: 'on' | 'off';
    enableZoomGesture?: boolean;
    children?: ReactNode;
  }

  export class Camera extends Component<CameraProps> {
    static requestCameraPermission(): Promise<'granted' | 'denied'>;
    static getCameraPermissionStatus(): Promise<'granted' | 'denied' | 'not-determined'>;
  }

  export function useCameraDevice(position: 'front' | 'back'): CameraDevice | undefined;

  export function useCameraPermission(): {
    hasPermission: boolean;
    requestPermission: () => Promise<boolean>;
  };

  export function useCodeScanner(options: CodeScannerOptions): CodeScannerOptions;
}

declare module 'react-native-ble-plx' {
  export type State =
    | 'Unknown'
    | 'Resetting'
    | 'Unsupported'
    | 'Unauthorized'
    | 'PoweredOff'
    | 'PoweredOn';

  export interface ScanOptions {
    allowDuplicates?: boolean;
    scanMode?: number;
  }

  export interface Device {
    id: string;
    name: string | null;
    localName: string | null;
    rssi: number | null;
    serviceUUIDs: string[] | null;
    manufacturerData: string | null;
  }

  export interface BleError {
    errorCode: number;
    message: string;
    reason: string | null;
  }

  export interface Subscription {
    remove(): void;
  }

  export class BleManager {
    constructor();
    destroy(): void;
    state(): Promise<State>;
    onStateChange(
      listener: (state: State) => void,
      emitCurrentState?: boolean,
    ): Subscription;
    startDeviceScan(
      serviceUUIDs: string[] | null,
      options: ScanOptions | null,
      listener: (error: BleError | null, device: Device | null) => void,
    ): void;
    stopDeviceScan(): void;
    enable(transactionId?: string): Promise<BleManager>;
  }
}

declare module 'react-native-nfc-manager' {
  export enum NfcTech {
    Ndef = 'Ndef',
    NfcA = 'NfcA',
    NfcB = 'NfcB',
    NfcF = 'NfcF',
    NfcV = 'NfcV',
    IsoDep = 'IsoDep',
    MifareClassic = 'MifareClassic',
    MifareUltralight = 'MifareUltralight',
    MifareIOS = 'mifare',
    Iso15693IOS = 'iso15693',
    FelicaIOS = 'felica',
  }

  export interface NdefRecord {
    tnf: number;
    type: number[];
    id: number[];
    payload: number[];
  }

  export interface TagEvent {
    id: string;
    techTypes?: string[];
    ndefMessage?: NdefRecord[];
  }

  const NfcManager: {
    isSupported(): Promise<boolean>;
    start(): Promise<void>;
    isEnabled(): Promise<boolean>;
    requestTechnology(
      tech: NfcTech | NfcTech[],
      options?: { alertMessage?: string },
    ): Promise<NfcTech>;
    cancelTechnologyRequest(): Promise<void>;
    getTag(): Promise<TagEvent | null>;
    setAlertMessageIOS(message: string): void;
    unregisterTagEvent(): Promise<void>;
  };

  export default NfcManager;
  export type { NdefRecord, TagEvent };
}

declare module '@op-engineering/op-sqlite' {
  export interface QueryResult {
    insertId?: number;
    rowsAffected: number;
    rows?: {
      _array: Record<string, unknown>[];
      length: number;
    };
  }

  export interface DB {
    execute(sql: string, params?: unknown[]): QueryResult;
    executeAsync(sql: string, params?: unknown[]): Promise<QueryResult>;
    close(): void;
  }

  export function open(options: { name: string; location?: string }): DB;
}
