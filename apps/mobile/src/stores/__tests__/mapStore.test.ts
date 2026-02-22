import { useMapStore } from '../mapStore';

beforeEach(() => {
  useMapStore.setState({
    region: {
      latitude: 39.8283,
      longitude: -98.5795,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    },
    mapType: 'satellite',
    showBoundary: true,
    showZones: true,
    lotBoundary: [],
    zones: [],
    filters: { statuses: [], types: [], makes: [] },
  });
});

describe('mapStore', () => {
  it('has correct default state', () => {
    const state = useMapStore.getState();
    expect(state.mapType).toBe('satellite');
    expect(state.showBoundary).toBe(true);
    expect(state.showZones).toBe(true);
    expect(state.lotBoundary).toEqual([]);
    expect(state.zones).toEqual([]);
  });

  it('setRegion updates the region', () => {
    const newRegion = { latitude: 42, longitude: -90, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    useMapStore.getState().setRegion(newRegion);

    expect(useMapStore.getState().region).toEqual(newRegion);
  });

  it('toggleMapType switches between satellite and standard', () => {
    expect(useMapStore.getState().mapType).toBe('satellite');
    useMapStore.getState().toggleMapType();
    expect(useMapStore.getState().mapType).toBe('standard');
    useMapStore.getState().toggleMapType();
    expect(useMapStore.getState().mapType).toBe('satellite');
  });

  it('toggleBoundary flips showBoundary', () => {
    expect(useMapStore.getState().showBoundary).toBe(true);
    useMapStore.getState().toggleBoundary();
    expect(useMapStore.getState().showBoundary).toBe(false);
  });

  it('toggleZones flips showZones', () => {
    expect(useMapStore.getState().showZones).toBe(true);
    useMapStore.getState().toggleZones();
    expect(useMapStore.getState().showZones).toBe(false);
  });

  it('setLotBoundary sets the boundary polygon', () => {
    const coords = [
      { latitude: 40, longitude: -90 },
      { latitude: 41, longitude: -89 },
    ];
    useMapStore.getState().setLotBoundary(coords);
    expect(useMapStore.getState().lotBoundary).toEqual(coords);
  });

  it('setZones sets zone overlays', () => {
    const zones = [
      {
        id: 'z1',
        name: 'Zone A',
        color: '#ff0000',
        coordinates: [{ latitude: 40, longitude: -90 }],
      },
    ];
    useMapStore.getState().setZones(zones);
    expect(useMapStore.getState().zones).toEqual(zones);
  });

  it('centerOnUnit updates region lat/lng but preserves deltas', () => {
    useMapStore.getState().centerOnUnit(42, -88);
    const region = useMapStore.getState().region;
    expect(region.latitude).toBe(42);
    expect(region.longitude).toBe(-88);
    expect(region.latitudeDelta).toBe(0.01);
    expect(region.longitudeDelta).toBe(0.01);
  });

  it('setFilters replaces filters', () => {
    const filters = { statuses: ['available'], types: ['motorhome'], makes: ['Thor'] };
    useMapStore.getState().setFilters(filters);
    expect(useMapStore.getState().filters).toEqual(filters);
  });
});
