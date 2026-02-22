const mockGetTrackers = jest.fn();
const mockAssignTracker = jest.fn();
const mockUnassignTracker = jest.fn();

jest.mock('../../services/api', () => ({
  apiClient: {
    getTrackers: (...args: unknown[]) => mockGetTrackers(...args),
    assignTracker: (...args: unknown[]) => mockAssignTracker(...args),
    unassignTracker: (...args: unknown[]) => mockUnassignTracker(...args),
  },
  bindAuthAccessors: jest.fn(),
}));

import { useTrackerStore } from '../trackerStore';

const TRACKER_A = {
  id: 't1',
  device_eui: 'EUI-001',
  status: 'online',
  battery_pct: 85,
} as any;

const TRACKER_B = {
  id: 't2',
  device_eui: 'EUI-002',
  status: 'offline',
  battery_pct: 20,
} as any;

beforeEach(() => {
  useTrackerStore.setState({
    trackers: [],
    scanResult: null,
    isScanning: false,
    isLoading: false,
  });

  mockGetTrackers.mockReset();
  mockAssignTracker.mockReset();
  mockUnassignTracker.mockReset();
});

describe('trackerStore', () => {
  it('starts with empty state', () => {
    const state = useTrackerStore.getState();
    expect(state.trackers).toEqual([]);
    expect(state.scanResult).toBeNull();
    expect(state.isScanning).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  // ── fetchTrackers ───────────────────────────────────────────────────────

  it('fetchTrackers loads trackers', async () => {
    mockGetTrackers.mockResolvedValueOnce({ data: [TRACKER_A, TRACKER_B] });

    await useTrackerStore.getState().fetchTrackers();

    expect(useTrackerStore.getState().trackers).toEqual([TRACKER_A, TRACKER_B]);
    expect(useTrackerStore.getState().isLoading).toBe(false);
  });

  it('fetchTrackers sets isLoading during the call', async () => {
    let resolve: (v: unknown) => void;
    mockGetTrackers.mockReturnValueOnce(new Promise((r) => { resolve = r; }));

    const promise = useTrackerStore.getState().fetchTrackers();
    expect(useTrackerStore.getState().isLoading).toBe(true);

    resolve!({ data: [] });
    await promise;
    expect(useTrackerStore.getState().isLoading).toBe(false);
  });

  it('fetchTrackers clears isLoading on failure', async () => {
    mockGetTrackers.mockRejectedValueOnce(new Error('fail'));

    await useTrackerStore.getState().fetchTrackers();
    expect(useTrackerStore.getState().isLoading).toBe(false);
  });

  // ── assignTracker ───────────────────────────────────────────────────────

  it('assignTracker calls API then refreshes trackers', async () => {
    mockAssignTracker.mockResolvedValueOnce({});
    mockGetTrackers.mockResolvedValueOnce({ data: [TRACKER_A] });

    await useTrackerStore.getState().assignTracker('t1', 'u1');

    expect(mockAssignTracker).toHaveBeenCalledWith('t1', 'u1');
    expect(mockGetTrackers).toHaveBeenCalled();
  });

  // ── unassignTracker ─────────────────────────────────────────────────────

  it('unassignTracker calls API then refreshes trackers', async () => {
    mockUnassignTracker.mockResolvedValueOnce({});
    mockGetTrackers.mockResolvedValueOnce({ data: [] });

    await useTrackerStore.getState().unassignTracker('t1');

    expect(mockUnassignTracker).toHaveBeenCalledWith('t1');
    expect(mockGetTrackers).toHaveBeenCalled();
  });

  // ── setScanResult / clearScanResult ─────────────────────────────────────

  it('setScanResult sets the result', () => {
    const result = { deviceEui: 'EUI-001', status: 'online' as any };
    useTrackerStore.getState().setScanResult(result);
    expect(useTrackerStore.getState().scanResult).toEqual(result);
  });

  it('clearScanResult clears the result', () => {
    useTrackerStore.getState().setScanResult({ deviceEui: 'EUI-001', status: 'online' as any });
    useTrackerStore.getState().clearScanResult();
    expect(useTrackerStore.getState().scanResult).toBeNull();
  });

  // ── setScanning ─────────────────────────────────────────────────────────

  it('setScanning toggles scanning state', () => {
    useTrackerStore.getState().setScanning(true);
    expect(useTrackerStore.getState().isScanning).toBe(true);
    useTrackerStore.getState().setScanning(false);
    expect(useTrackerStore.getState().isScanning).toBe(false);
  });

  // ── updateTrackerStatus ─────────────────────────────────────────────────

  it('updateTrackerStatus patches the matching tracker', () => {
    useTrackerStore.setState({ trackers: [TRACKER_A, TRACKER_B] });

    useTrackerStore.getState().updateTrackerStatus('t1', 'offline' as any, 50);

    const t = useTrackerStore.getState().trackers[0];
    expect(t.status).toBe('offline');
    expect(t.battery_pct).toBe(50);
    // Other tracker unchanged
    expect(useTrackerStore.getState().trackers[1].status).toBe('offline');
  });
});
