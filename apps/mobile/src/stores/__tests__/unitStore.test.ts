const mockGetUnits = jest.fn();
const mockSearchUnits = jest.fn();
const mockUpdateUnitStatus = jest.fn();

jest.mock('../../services/api', () => ({
  apiClient: {
    getUnits: (...args: unknown[]) => mockGetUnits(...args),
    searchUnits: (...args: unknown[]) => mockSearchUnits(...args),
    updateUnitStatus: (...args: unknown[]) => mockUpdateUnitStatus(...args),
  },
  bindAuthAccessors: jest.fn(),
}));

import { useUnitStore } from '../unitStore';

const UNIT_A = {
  id: 'u1',
  stock_number: 'STK-001',
  vin: '1HGBH41JXMN109186',
  make: 'Thor',
  model: 'Ace',
  year: 2025,
  status: 'available',
  current_lat: 40.0,
  current_lng: -90.0,
  current_zone: 'A',
  current_row: '1',
  current_spot: '5',
  last_moved_at: '2025-06-01T00:00:00Z',
} as any;

const UNIT_B = { ...UNIT_A, id: 'u2', stock_number: 'STK-002' } as any;

beforeEach(() => {
  useUnitStore.setState({
    units: [],
    selectedUnit: null,
    isLoading: false,
    filters: {},
    totalCount: 0,
    cursor: null,
  });

  mockGetUnits.mockReset();
  mockSearchUnits.mockReset();
  mockUpdateUnitStatus.mockReset();
});

describe('unitStore', () => {
  it('starts with empty state', () => {
    const state = useUnitStore.getState();
    expect(state.units).toEqual([]);
    expect(state.selectedUnit).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.totalCount).toBe(0);
    expect(state.cursor).toBeNull();
  });

  // ── fetchUnits ──────────────────────────────────────────────────────────

  it('fetchUnits loads first page', async () => {
    mockGetUnits.mockResolvedValueOnce({
      data: [UNIT_A],
      pagination: { total_count: 1, next_cursor: null },
    });

    await useUnitStore.getState().fetchUnits();

    const state = useUnitStore.getState();
    expect(state.units).toEqual([UNIT_A]);
    expect(state.totalCount).toBe(1);
    expect(state.cursor).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('fetchUnits sets isLoading during the call', async () => {
    let resolve: (v: unknown) => void;
    mockGetUnits.mockReturnValueOnce(new Promise((r) => { resolve = r; }));

    const promise = useUnitStore.getState().fetchUnits();
    expect(useUnitStore.getState().isLoading).toBe(true);

    resolve!({ data: [], pagination: { total_count: 0, next_cursor: null } });
    await promise;
    expect(useUnitStore.getState().isLoading).toBe(false);
  });

  it('fetchUnits clears isLoading on failure', async () => {
    mockGetUnits.mockRejectedValueOnce(new Error('Network'));

    await useUnitStore.getState().fetchUnits();
    expect(useUnitStore.getState().isLoading).toBe(false);
  });

  // ── fetchNextPage ───────────────────────────────────────────────────────

  it('fetchNextPage appends to existing units', async () => {
    useUnitStore.setState({ units: [UNIT_A], cursor: 'cursor-1' });
    mockGetUnits.mockResolvedValueOnce({
      data: [UNIT_B],
      pagination: { total_count: 2, next_cursor: null },
    });

    await useUnitStore.getState().fetchNextPage();

    expect(useUnitStore.getState().units).toEqual([UNIT_A, UNIT_B]);
  });

  it('fetchNextPage does nothing when no cursor', async () => {
    useUnitStore.setState({ cursor: null });
    await useUnitStore.getState().fetchNextPage();
    expect(mockGetUnits).not.toHaveBeenCalled();
  });

  // ── searchUnits ─────────────────────────────────────────────────────────

  it('searchUnits returns results from API', async () => {
    mockSearchUnits.mockResolvedValueOnce([UNIT_A]);
    const results = await useUnitStore.getState().searchUnits('Thor');
    expect(results).toEqual([UNIT_A]);
    expect(mockSearchUnits).toHaveBeenCalledWith('Thor');
  });

  // ── setSelectedUnit ─────────────────────────────────────────────────────

  it('setSelectedUnit sets and clears selected unit', () => {
    useUnitStore.getState().setSelectedUnit(UNIT_A);
    expect(useUnitStore.getState().selectedUnit).toEqual(UNIT_A);

    useUnitStore.getState().setSelectedUnit(null);
    expect(useUnitStore.getState().selectedUnit).toBeNull();
  });

  // ── updateUnitStatus ────────────────────────────────────────────────────

  it('updateUnitStatus replaces the unit in the list', async () => {
    const updated = { ...UNIT_A, status: 'sold' };
    useUnitStore.setState({ units: [UNIT_A, UNIT_B] });
    mockUpdateUnitStatus.mockResolvedValueOnce(updated);

    await useUnitStore.getState().updateUnitStatus('u1', 'sold' as any);

    expect(useUnitStore.getState().units[0].status).toBe('sold');
    expect(useUnitStore.getState().units[1].id).toBe('u2');
  });

  it('updateUnitStatus also updates selectedUnit if matching', async () => {
    const updated = { ...UNIT_A, status: 'sold' };
    useUnitStore.setState({ units: [UNIT_A], selectedUnit: UNIT_A });
    mockUpdateUnitStatus.mockResolvedValueOnce(updated);

    await useUnitStore.getState().updateUnitStatus('u1', 'sold' as any);

    expect(useUnitStore.getState().selectedUnit?.status).toBe('sold');
  });

  // ── setFilters ──────────────────────────────────────────────────────────

  it('setFilters merges partial filters', () => {
    useUnitStore.getState().setFilters({ search: 'Thor' });
    expect(useUnitStore.getState().filters.search).toBe('Thor');

    useUnitStore.getState().setFilters({ status: ['available'] as any });
    expect(useUnitStore.getState().filters.search).toBe('Thor');
    expect(useUnitStore.getState().filters.status).toEqual(['available']);
  });

  // ── updateUnitLocation ──────────────────────────────────────────────────

  it('updateUnitLocation patches the matching unit in-place', () => {
    useUnitStore.setState({ units: [UNIT_A, UNIT_B] });
    useUnitStore.getState().updateUnitLocation('u1', 41.0, -89.0, 'B', '2', 10);

    const u = useUnitStore.getState().units[0];
    expect(u.current_lat).toBe(41.0);
    expect(u.current_lng).toBe(-89.0);
    expect(u.current_zone).toBe('B');
    expect(u.current_row).toBe('2');
    expect(u.current_spot).toBe('10');
  });

  it('updateUnitLocation also patches selectedUnit if matching', () => {
    useUnitStore.setState({ units: [UNIT_A], selectedUnit: UNIT_A });
    useUnitStore.getState().updateUnitLocation('u1', 41.0, -89.0, 'C', '3', 7);

    expect(useUnitStore.getState().selectedUnit?.current_lat).toBe(41.0);
    expect(useUnitStore.getState().selectedUnit?.current_zone).toBe('C');
  });

  it('updateUnitLocation does not touch non-matching units', () => {
    useUnitStore.setState({ units: [UNIT_A, UNIT_B] });
    useUnitStore.getState().updateUnitLocation('u1', 41.0, -89.0, 'B', '2', 10);

    expect(useUnitStore.getState().units[1].current_lat).toBe(40.0);
  });
});
