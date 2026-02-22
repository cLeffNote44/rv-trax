// ---------------------------------------------------------------------------
// RV Trax API — WebSocket server (integrates with Fastify + Redis pub/sub)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type Redis from 'ioredis';
import { RoomManager } from './rooms.js';
import type { WsInboundMessage, WsOutboundMessage } from './types.js';

const HEARTBEAT_INTERVAL_MS = 30_000;
const WS_PATH = '/ws';

export const roomManager = new RoomManager();

// Track per-client pong state for heartbeats
const pendingPongs = new Map<string, NodeJS.Timeout>();

// Track Redis subscriptions per dealership to avoid duplicates
const subscriptions = new Map<string, Redis>();

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Set up the WebSocket server on the Fastify HTTP server.
 * Call this after the Fastify instance is listening.
 */
export function setupWebSocket(server: FastifyInstance, redis: Redis): void {
  const httpServer = server.server;

  const wss = new WebSocketServer({ noServer: true });

  // ── HTTP upgrade handling ---------------------------------------------------

  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (url.pathname !== WS_PATH) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  // ── Connection handling ----------------------------------------------------

  wss.on('connection', (ws: WebSocket) => {
    let clientId: string | null = null;
    let authenticated = false;
    let authTimeout: ReturnType<typeof setTimeout> | null = null;

    // Client must send an auth message within 5 seconds
    authTimeout = setTimeout(() => {
      if (!authenticated) {
        sendMessage(ws, { type: 'error', message: 'Authentication timeout', code: 'AUTH_TIMEOUT' });
        ws.close(4001, 'Authentication timeout');
      }
    }, 5000);

    ws.on('message', (data) => {
      let msg: WsInboundMessage;
      try {
        msg = JSON.parse(data.toString()) as WsInboundMessage;
      } catch {
        sendMessage(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      // ── Auth message -------------------------------------------------------
      if (msg.type === 'auth' && !authenticated) {
        if (authTimeout) {
          clearTimeout(authTimeout);
          authTimeout = null;
        }

        let payload: { sub: string; dealershipId: string };
        try {
          payload = server.jwt.verify<{ sub: string; dealershipId: string }>(msg.token);
        } catch {
          sendMessage(ws, { type: 'error', message: 'Invalid token', code: 'INVALID_TOKEN' });
          ws.close(4001, 'Invalid token');
          return;
        }

        const { sub: userId, dealershipId } = payload;

        if (!dealershipId) {
          sendMessage(ws, { type: 'error', message: 'Missing dealership context', code: 'NO_DEALERSHIP' });
          ws.close(4001, 'Missing dealership context');
          return;
        }

        authenticated = true;
        clientId = roomManager.addClient(dealershipId, ws, userId);

        // Subscribe to Redis channel for this dealership if not already
        subscribeToChannel(dealershipId, redis, server);

        sendMessage(ws, { type: 'connected', dealership_id: dealershipId });

        server.log.info(
          { clientId, dealershipId, userId },
          'WebSocket client connected',
        );
        return;
      }

      // ── Pong response ------------------------------------------------------
      if (msg.type === 'pong' && clientId) {
        const timeout = pendingPongs.get(clientId);
        if (timeout) {
          clearTimeout(timeout);
          pendingPongs.delete(clientId);
        }
        return;
      }

      // ── Unrecognised or unauthenticated ------------------------------------
      if (!authenticated) {
        sendMessage(ws, { type: 'error', message: 'Not authenticated' });
        ws.close(4001, 'Not authenticated');
      }
    });

    ws.on('close', () => {
      if (authTimeout) clearTimeout(authTimeout);

      if (clientId) {
        const dealershipId = roomManager.removeClient(clientId);

        // Clean up pending pong timeout
        const pongTimeout = pendingPongs.get(clientId);
        if (pongTimeout) {
          clearTimeout(pongTimeout);
          pendingPongs.delete(clientId);
        }

        // If no more clients in this dealership, unsubscribe from Redis
        if (dealershipId && roomManager.getClientCount(dealershipId) === 0) {
          unsubscribeFromChannel(dealershipId);
        }

        server.log.info({ clientId, dealershipId }, 'WebSocket client disconnected');
      }
    });

    ws.on('error', (err) => {
      server.log.error({ err, clientId }, 'WebSocket error');
    });
  });

  // ── Heartbeat --------------------------------------------------------------

  const PONG_TIMEOUT_MS = 10_000;

  heartbeatTimer = setInterval(() => {
    const stats = roomManager.getStats();
    if (stats.totalConnections === 0) return;

    // Broadcast ping to all dealership rooms
    for (const dealershipId of roomManager.getActiveDealerships()) {
      roomManager.broadcast(dealershipId, { type: 'ping' });
    }

    // Set pong timeouts for all connected clients.
    // If a client doesn't respond with pong within PONG_TIMEOUT_MS, disconnect it.
    for (const clientId of roomManager.getAllClientIds()) {
      if (pendingPongs.has(clientId)) continue; // already waiting

      const timeout = setTimeout(() => {
        const ws = roomManager.getClientWs(clientId);
        if (ws) {
          server.log.warn({ clientId }, 'Client failed to respond to ping, disconnecting');
          ws.close(4002, 'Pong timeout');
        }
        pendingPongs.delete(clientId);
      }, PONG_TIMEOUT_MS);

      pendingPongs.set(clientId, timeout);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // ── Graceful shutdown hooks ------------------------------------------------

  server.addHook('onClose', async () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    for (const timeout of pendingPongs.values()) {
      clearTimeout(timeout);
    }
    pendingPongs.clear();

    // Unsubscribe all Redis channels
    for (const dealershipId of subscriptions.keys()) {
      unsubscribeFromChannel(dealershipId);
    }

    wss.close();
  });

  server.log.info('WebSocket server initialised on path /ws');
}

// ── Redis pub/sub helpers --------------------------------------------------

function subscribeToChannel(
  dealershipId: string,
  redis: Redis,
  server: FastifyInstance,
): void {
  if (subscriptions.has(dealershipId)) return;

  // Create a duplicate Redis connection for subscribing
  // (ioredis requires a dedicated connection for subscriptions)
  const sub = redis.duplicate();
  subscriptions.set(dealershipId, sub);

  const channel = `dealership:${dealershipId}:locations`;

  sub.subscribe(channel, (err) => {
    if (err) {
      server.log.error({ err, channel }, 'Failed to subscribe to Redis channel');
      return;
    }
    server.log.info({ channel }, 'Subscribed to Redis channel');
  });

  sub.on('message', (ch: string, message: string) => {
    if (ch !== channel) return;

    try {
      const parsed = JSON.parse(message) as object;
      roomManager.broadcast(dealershipId, parsed);
    } catch {
      server.log.warn({ channel, message }, 'Failed to parse Redis pub/sub message');
    }
  });
}

function unsubscribeFromChannel(dealershipId: string): void {
  const sub = subscriptions.get(dealershipId);
  if (!sub) return;

  const channel = `dealership:${dealershipId}:locations`;
  sub.unsubscribe(channel).catch(() => { /* swallow */ });
  sub.disconnect();
  subscriptions.delete(dealershipId);
}

// ── Helpers ----------------------------------------------------------------

function sendMessage(ws: WebSocket, message: WsOutboundMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Publish a message to a dealership's Redis channel so all connected
 * WebSocket clients in that room receive it.
 */
export function publishToDealership(
  redis: Redis,
  dealershipId: string,
  message: WsOutboundMessage,
): void {
  const channel = `dealership:${dealershipId}:locations`;
  redis.publish(channel, JSON.stringify(message)).catch(() => { /* swallow */ });
}
