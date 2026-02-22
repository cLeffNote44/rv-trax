'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WebSocketEvent =
  | { type: 'unit:moved'; payload: { unitId: string; lat: number; lng: number; zone?: string } }
  | { type: 'unit:status_changed'; payload: { unitId: string; status: string } }
  | { type: 'tracker:update'; payload: { trackerId: string; battery_pct: number; last_seen_at: string } }
  | { type: 'alert:new'; payload: { id: string; title: string; severity: string } }
  | { type: 'alert:count'; payload: { count: number } }
  | { type: 'gateway:status'; payload: { gatewayId: string; status: string } };

type EventHandler = (event: WebSocketEvent) => void;

interface WebSocketContextValue {
  isConnected: boolean;
  subscribe: (handler: EventHandler) => () => void;
  send: (data: unknown) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3000/ws';
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<EventHandler>>(new Set());
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY_MS);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!token || !isAuthenticated) return;

    // Clean up previous connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Connect to bare URL — token is sent as first message, never in the URL
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      retryDelayRef.current = INITIAL_RETRY_DELAY_MS;
      // Send auth token as first message (server expects this within 5s)
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as { type: string; [key: string]: unknown };

        // Handle server control messages
        if (parsed.type === 'connected') {
          setIsConnected(true);
          return;
        }
        if (parsed.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        if (parsed.type === 'error') {
          return;
        }

        handlersRef.current.forEach((handler) => handler(parsed as unknown as WebSocketEvent));
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Auto-reconnect with exponential backoff
      retryTimerRef.current = setTimeout(() => {
        retryDelayRef.current = Math.min(
          retryDelayRef.current * 2,
          MAX_RETRY_DELAY_MS
        );
        connect();
      }, retryDelayRef.current);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [token, isAuthenticated]);

  useEffect(() => {
    connect();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const subscribe = useCallback((handler: EventHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe, send }}>
      {children}
    </WebSocketContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return ctx;
}
