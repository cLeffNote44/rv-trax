/**
 * RV Trax — Normal Load Test
 *
 * Simulates realistic traffic: ramp to 50 VUs over 2 min, hold for 5 min,
 * then ramp down over 1 min.
 *
 *   k6 run tests/load/load.js
 */

import { sleep, group } from 'k6';
import { API_URL, THRESHOLDS } from './k6-config.js';
import { login, getList } from './helpers.js';

export const options = {
  stages: [
    { duration: '2m', target: 50 }, // ramp up
    { duration: '5m', target: 50 }, // sustained load
    { duration: '1m', target: 0 }, // ramp down
  ],
  thresholds: THRESHOLDS,
};

export default function () {
  const token = login();
  if (!token) {
    sleep(1);
    return;
  }

  // ── Flow 1: Browse inventory ──────────────────────────────────────────────

  group('browse inventory', () => {
    const units = getList(`${API_URL}/units`, token, 'GET /units');
    sleep(1);

    // View a single unit if available
    if (units && units.data && units.data.length > 0) {
      const unitId = units.data[0].id;
      getList(`${API_URL}/units/${unitId}`, token, 'GET /units/:id');
      sleep(0.5);
    }
  });

  // ── Flow 2: Check trackers ────────────────────────────────────────────────

  group('check trackers', () => {
    getList(`${API_URL}/trackers`, token, 'GET /trackers');
    sleep(1);
  });

  // ── Flow 3: Review alerts ─────────────────────────────────────────────────

  group('review alerts', () => {
    getList(`${API_URL}/alerts`, token, 'GET /alerts');
    sleep(0.5);

    getList(`${API_URL}/alerts?status=active`, token, 'GET /alerts?status=active');
    sleep(1);
  });

  // ── Flow 4: View analytics ────────────────────────────────────────────────

  group('view analytics', () => {
    getList(`${API_URL}/analytics/inventory`, token, 'GET /analytics/inventory');
    sleep(0.5);

    getList(`${API_URL}/analytics/lot-utilization`, token, 'GET /analytics/lot-utilization');
    sleep(0.5);

    getList(`${API_URL}/analytics/movement`, token, 'GET /analytics/movement');
    sleep(1);
  });

  // ── Flow 5: Work orders ───────────────────────────────────────────────────

  group('work orders', () => {
    getList(`${API_URL}/work-orders`, token, 'GET /work-orders');
    sleep(1);
  });

  // Think time between iterations
  sleep(2);
}
