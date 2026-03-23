/**
 * RV Trax — WebSocket Load Test
 *
 * Opens N concurrent WebSocket connections, authenticates each,
 * subscribes to location updates, and verifies messages arrive.
 *
 *   k6 run tests/load/websocket.js
 *
 * The API WebSocket endpoint is ws://<host>/ws. Clients must send an
 * { type: "auth", token: "<jwt>" } message within 5 seconds of connecting.
 * The server replies with { type: "connected", dealership_id: "..." }.
 */

import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import ws from 'k6/ws';
import { BASE_URL } from './k6-config.js';
import { login } from './helpers.js';

const wsConnectErrors = new Counter('ws_connect_errors');
const wsAuthErrors = new Counter('ws_auth_errors');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsMessageLatency = new Trend('ws_message_latency', true);

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp to 50 connections
    { duration: '30s', target: 100 }, // ramp to 100 connections
    { duration: '2m', target: 100 }, // hold 100 connections
    { duration: '30s', target: 0 }, // ramp down
  ],
  thresholds: {
    ws_connect_errors: ['count<10'],
    ws_auth_errors: ['count<5'],
    ws_messages_received: ['count>0'],
    ws_message_latency: ['p(95)<5000'],
  },
};

export default function () {
  // First, get a JWT via the REST API
  const token = login();
  if (!token) {
    wsConnectErrors.add(1);
    sleep(1);
    return;
  }

  // Build the WebSocket URL (ws:// or wss:// based on the base URL)
  const wsUrl = BASE_URL.replace(/^http/, 'ws') + '/ws';

  const res = ws.connect(wsUrl, {}, function (socket) {
    let authenticated = false;
    const connectTime = Date.now();

    socket.on('open', () => {
      // Send auth message immediately
      socket.send(
        JSON.stringify({
          type: 'auth',
          token: token,
        }),
      );
    });

    socket.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      wsMessagesReceived.add(1);

      // Handle auth confirmation
      if (msg.type === 'connected') {
        authenticated = true;
        check(msg, {
          'ws auth confirmed': (m) => m.type === 'connected',
          'ws has dealership_id': (m) => !!m.dealership_id,
        });
      }

      // Track latency for location updates
      if (msg.type === 'location_update') {
        if (msg.timestamp) {
          const serverTime = new Date(msg.timestamp).getTime();
          const latency = Date.now() - serverTime;
          wsMessageLatency.add(latency);
        }

        check(msg, {
          'location has unit_id': (m) => !!m.unit_id,
          'location has lat/lng': (m) =>
            typeof m.latitude === 'number' && typeof m.longitude === 'number',
        });
      }

      // Respond to pings to keep the connection alive
      if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
      }
    });

    socket.on('error', (e) => {
      wsConnectErrors.add(1);
      console.error(`WebSocket error (VU ${__VU}): ${e}`);
    });

    socket.on('close', () => {
      if (!authenticated) {
        wsAuthErrors.add(1);
      }
    });

    // Keep the connection open for 30 seconds, then close
    socket.setTimeout(function () {
      socket.close();
    }, 30000);
  });

  check(res, {
    'ws connection status is 101': (r) => r && r.status === 101,
  });

  sleep(1);
}
