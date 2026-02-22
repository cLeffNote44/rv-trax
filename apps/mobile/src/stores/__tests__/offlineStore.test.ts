const mockGetUnits = jest.fn();
const mockUpdateUnitStatus = jest.fn();
const mockAddUnitNote = jest.fn();
const mockAssignTracker = jest.fn();
const mockCacheUnits = jest.fn();
const mockGetPendingActions = jest.fn();
const mockRemovePendingAction = jest.fn();

jest.mock('../../services/api', () => ({
  apiClient: {
    getUnits: (...args: unknown[]) => mockGetUnits(...args),
    updateUnitStatus: (...args: unknown[]) => mockUpdateUnitStatus(...args),
    addUnitNote: (...args: unknown[]) => mockAddUnitNote(...args),
    assignTracker: (...args: unknown[]) => mockAssignTracker(...args),
  },
  bindAuthAccessors: jest.fn(),
}));

jest.mock('../../services/offline', () => ({
  cacheUnits: (...args: unknown[]) => mockCacheUnits(...args),
  getPendingActions: () => mockGetPendingActions(),
  removePendingAction: (...args: unknown[]) => mockRemovePendingAction(...args),
}));

import { useOfflineStore } from '../offlineStore';

beforeEach(() => {
  useOfflineStore.setState({
    isOnline: true,
    lastSyncAt: null,
    pendingActionsCount: 0,
  });

  mockGetUnits.mockReset();
  mockUpdateUnitStatus.mockReset();
  mockAddUnitNote.mockReset();
  mockAssignTracker.mockReset();
  mockCacheUnits.mockReset();
  mockGetPendingActions.mockReset();
  mockRemovePendingAction.mockReset();
});

describe('offlineStore', () => {
  it('starts online with no pending actions', () => {
    const state = useOfflineStore.getState();
    expect(state.isOnline).toBe(true);
    expect(state.lastSyncAt).toBeNull();
    expect(state.pendingActionsCount).toBe(0);
  });

  it('setOnline changes isOnline', () => {
    useOfflineStore.getState().setOnline(false);
    expect(useOfflineStore.getState().isOnline).toBe(false);
  });

  // ── syncData ────────────────────────────────────────────────────────────

  it('syncData fetches units and caches them', async () => {
    const units = [{ id: 'u1' }, { id: 'u2' }];
    mockGetUnits.mockResolvedValueOnce({ data: units });

    await useOfflineStore.getState().syncData();

    expect(mockGetUnits).toHaveBeenCalledWith({ limit: 100 });
    expect(mockCacheUnits).toHaveBeenCalledWith(units);
    expect(useOfflineStore.getState().lastSyncAt).not.toBeNull();
  });

  it('syncData swallows errors gracefully', async () => {
    mockGetUnits.mockRejectedValueOnce(new Error('offline'));

    await useOfflineStore.getState().syncData();

    expect(useOfflineStore.getState().lastSyncAt).toBeNull();
  });

  // ── processPendingActions ───────────────────────────────────────────────

  it('processes status_change actions', async () => {
    mockGetPendingActions.mockReturnValue([
      { id: 'a1', type: 'status_change', payload: { unitId: 'u1', status: 'sold' }, created_at: '' },
    ]);
    mockUpdateUnitStatus.mockResolvedValueOnce({});

    await useOfflineStore.getState().processPendingActions();

    expect(mockUpdateUnitStatus).toHaveBeenCalledWith('u1', 'sold');
    expect(mockRemovePendingAction).toHaveBeenCalledWith('a1');
  });

  it('processes add_note actions', async () => {
    mockGetPendingActions.mockReturnValue([
      { id: 'a2', type: 'add_note', payload: { unitId: 'u1', content: 'Test note' }, created_at: '' },
    ]);
    mockAddUnitNote.mockResolvedValueOnce({});

    await useOfflineStore.getState().processPendingActions();

    expect(mockAddUnitNote).toHaveBeenCalledWith('u1', 'Test note');
    expect(mockRemovePendingAction).toHaveBeenCalledWith('a2');
  });

  it('processes assign_tracker actions', async () => {
    mockGetPendingActions.mockReturnValue([
      { id: 'a3', type: 'assign_tracker', payload: { trackerId: 't1', unitId: 'u1' }, created_at: '' },
    ]);
    mockAssignTracker.mockResolvedValueOnce({});

    await useOfflineStore.getState().processPendingActions();

    expect(mockAssignTracker).toHaveBeenCalledWith('t1', 'u1');
    expect(mockRemovePendingAction).toHaveBeenCalledWith('a3');
  });

  it('skips failed actions and continues processing', async () => {
    mockGetPendingActions.mockReturnValue([
      { id: 'a1', type: 'status_change', payload: { unitId: 'u1', status: 'sold' }, created_at: '' },
      { id: 'a2', type: 'add_note', payload: { unitId: 'u2', content: 'Note' }, created_at: '' },
    ]);
    mockUpdateUnitStatus.mockRejectedValueOnce(new Error('conflict'));
    mockAddUnitNote.mockResolvedValueOnce({});

    await useOfflineStore.getState().processPendingActions();

    // First action failed — not removed
    expect(mockRemovePendingAction).not.toHaveBeenCalledWith('a1');
    // Second action succeeded
    expect(mockRemovePendingAction).toHaveBeenCalledWith('a2');
  });

  // ── refreshPendingCount ─────────────────────────────────────────────────

  it('refreshPendingCount updates the count from offline DB', () => {
    mockGetPendingActions.mockReturnValue([{ id: '1' }, { id: '2' }, { id: '3' }]);
    useOfflineStore.getState().refreshPendingCount();
    expect(useOfflineStore.getState().pendingActionsCount).toBe(3);
  });
});
