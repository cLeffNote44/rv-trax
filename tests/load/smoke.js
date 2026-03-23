/**
 * RV Trax — Smoke Test
 *
 * Quick sanity check: 1 VU, 30 seconds.
 * Verifies the core read endpoints are reachable and responding.
 *
 *   k6 run tests/load/smoke.js
 */

import { sleep } from 'k6';
import { API_URL, THRESHOLDS } from './k6-config.js';
import { login, getList } from './helpers.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: THRESHOLDS,
};

export default function () {
  // Authenticate
  const token = login();
  if (!token) {
    sleep(1);
    return;
  }

  // GET /units
  getList(`${API_URL}/units`, token, 'GET /units');
  sleep(0.5);

  // GET /trackers
  getList(`${API_URL}/trackers`, token, 'GET /trackers');
  sleep(0.5);

  // GET /alerts
  getList(`${API_URL}/alerts`, token, 'GET /alerts');
  sleep(0.5);

  // GET /analytics/inventory
  getList(`${API_URL}/analytics/inventory`, token, 'GET /analytics/inventory');
  sleep(0.5);

  // GET /work-orders
  getList(`${API_URL}/work-orders`, token, 'GET /work-orders');
  sleep(0.5);

  // GET /lots
  getList(`${API_URL}/lots`, token, 'GET /lots');
  sleep(1);
}
