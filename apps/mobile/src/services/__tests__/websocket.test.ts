import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('@env', () => ({ WS_URL: 'ws://localhost:3001' }));

// Minimal WebSocket mock
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  url: string;
  readyState = MockWebSocket.OPEN;
  onopen: ((ev: any) => void) | null = null;
  onmessage: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  onclose: ((ev: any) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    // Simulate async open
    setTimeout(() => this.onopen?.({} as any), 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
}

(global as any).WebSocket = MockWebSocket;

import { WebSocketManager } from '../websocket';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('WebSocketManager', () => {
  it('sends auth token on connect', () => {
    const mgr = new WebSocketManager();
    mgr.connect('test-token');
    vi.runAllTimers();

    // Access internal ws
    const ws = (mgr as any).ws as MockWebSocket;
    expect(ws.sentMessages[0]).toContain('"type":"auth"');
    expect(ws.sentMessages[0]).toContain('"token":"test-token"');

    mgr.disconnect();
  });

  it('reports isConnected based on ws readyState', () => {
    const mgr = new WebSocketManager();
    expect(mgr.isConnected).toBe(false);

    mgr.connect('tok');
    vi.runAllTimers();
    expect(mgr.isConnected).toBe(true);

    mgr.disconnect();
    expect(mgr.isConnected).toBe(false);
  });

  it('dispatches location_update to registered handlers', () => {
    const mgr = new WebSocketManager();
    const handler = vi.fn();
    mgr.onLocationUpdate(handler);

    mgr.connect('tok');
    vi.runAllTimers();

    const ws = (mgr as any).ws as MockWebSocket;
    const payload = { unit_id: 'u1', lat: 40, lng: -90, zone: 'A', row: '1', spot: 1, timestamp: '' };
    ws.onmessage?.({ data: JSON.stringify({ type: 'location_update', payload }) } as any);

    expect(handler).toHaveBeenCalledWith(payload);

    mgr.disconnect();
  });

  it('dispatches unit_status_change to registered handlers', () => {
    const mgr = new WebSocketManager();
    const handler = vi.fn();
    mgr.onUnitStatusChange(handler);

    mgr.connect('tok');
    vi.runAllTimers();

    const ws = (mgr as any).ws as MockWebSocket;
    const payload = { unit_id: 'u1', old_status: 'available', new_status: 'sold', changed_by: 'user1' };
    ws.onmessage?.({ data: JSON.stringify({ type: 'unit_status_change', payload }) } as any);

    expect(handler).toHaveBeenCalledWith(payload);

    mgr.disconnect();
  });

  it('dispatches alert events to registered handlers', () => {
    const mgr = new WebSocketManager();
    const handler = vi.fn();
    mgr.onAlert(handler);

    mgr.connect('tok');
    vi.runAllTimers();

    const ws = (mgr as any).ws as MockWebSocket;
    const payload = { alert_id: 'a1', alert_type: 'geofence', message: 'Unit left lot' };
    ws.onmessage?.({ data: JSON.stringify({ type: 'alert', payload }) } as any);

    expect(handler).toHaveBeenCalledWith(payload);

    mgr.disconnect();
  });

  it('dispatches tracker_status to registered handlers', () => {
    const mgr = new WebSocketManager();
    const handler = vi.fn();
    mgr.onTrackerStatus(handler);

    mgr.connect('tok');
    vi.runAllTimers();

    const ws = (mgr as any).ws as MockWebSocket;
    const payload = { tracker_id: 't1', status: 'online', battery_pct: 85 };
    ws.onmessage?.({ data: JSON.stringify({ type: 'tracker_status', payload }) } as any);

    expect(handler).toHaveBeenCalledWith(payload);

    mgr.disconnect();
  });

  it('notifies connection handlers on connected message', () => {
    const mgr = new WebSocketManager();
    const handler = vi.fn();
    mgr.onConnectionChange(handler);

    mgr.connect('tok');
    vi.runAllTimers();

    const ws = (mgr as any).ws as MockWebSocket;
    ws.onmessage?.({ data: JSON.stringify({ type: 'connected', dealership_id: 'd1' }) } as any);

    expect(handler).toHaveBeenCalledWith(true);

    mgr.disconnect();
  });

  it('responds to ping with pong', () => {
    const mgr = new WebSocketManager();
    mgr.connect('tok');
    vi.runAllTimers();

    const ws = (mgr as any).ws as MockWebSocket;
    // Clear the auth message
    ws.sentMessages = [];

    ws.onmessage?.({ data: JSON.stringify({ type: 'ping' }) } as any);

    expect(ws.sentMessages).toContain('{"type":"pong"}');

    mgr.disconnect();
  });

  it('unsubscribes handlers correctly', () => {
    const mgr = new WebSocketManager();
    const handler = vi.fn();
    const unsub = mgr.onLocationUpdate(handler);
    unsub();

    mgr.connect('tok');
    vi.runAllTimers();

    const ws = (mgr as any).ws as MockWebSocket;
    ws.onmessage?.({
      data: JSON.stringify({ type: 'location_update', payload: {} }),
    } as any);

    expect(handler).not.toHaveBeenCalled();

    mgr.disconnect();
  });

  it('ignores invalid JSON messages', () => {
    const mgr = new WebSocketManager();
    const handler = vi.fn();
    mgr.onLocationUpdate(handler);

    mgr.connect('tok');
    vi.runAllTimers();

    const ws = (mgr as any).ws as MockWebSocket;
    // Should not throw
    ws.onmessage?.({ data: '{invalid json' } as any);

    expect(handler).not.toHaveBeenCalled();

    mgr.disconnect();
  });

  it('disconnect prevents reconnection', () => {
    const mgr = new WebSocketManager();
    mgr.connect('tok');
    vi.runAllTimers();

    mgr.disconnect();

    // The intentionalClose flag should prevent reconnect scheduling
    expect((mgr as any).reconnectTimer).toBeNull();
    expect((mgr as any).ws).toBeNull();
  });
});
