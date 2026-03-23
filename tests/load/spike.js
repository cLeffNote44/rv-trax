/**
 * RV Trax — Spike Test
 *
 * Simulates a sudden traffic spike (e.g., morning shift starts, all staff
 * open the dashboard simultaneously).
 *
 * Pattern: 0 -> 500 VUs in 30s, hold 1 min, drop to 0 in 10s, then
 * verify recovery at low traffic for 1 min.
 *
 *   k6 run tests/load/spike.js
 */

import { sleep, group } from 'k6';
import { Rate } from 'k6/metrics';
import { API_URL, STRESS_THRESHOLDS } from './k6-config.js';
import { login, getList } from './helpers.js';

const failRate = new Rate('failed_requests');

export const options = {
  stages: [
    { duration: '10s', target: 10 }, // warm up
    { duration: '30s', target: 500 }, // spike
    { duration: '1m', target: 500 }, // hold at peak
    { duration: '10s', target: 0 }, // sudden drop
    { duration: '1m', target: 10 }, // recovery check
    { duration: '30s', target: 0 }, // wind down
  ],
  thresholds: {
    ...STRESS_THRESHOLDS,
    failed_requests: ['rate<0.10'], // tolerate up to 10% failures during spike
  },
};

export default function () {
  const token = login();
  if (!token) {
    failRate.add(1);
    sleep(0.5);
    return;
  }
  failRate.add(0);

  // Simulate typical dashboard load: parallel-ish reads a user would trigger
  group('dashboard load', () => {
    getList(`${API_URL}/units`, token, 'GET /units');
    getList(`${API_URL}/alerts`, token, 'GET /alerts');
    getList(`${API_URL}/trackers`, token, 'GET /trackers');
    sleep(0.3);
  });

  group('analytics', () => {
    getList(`${API_URL}/analytics/inventory`, token, 'GET /analytics/inventory');
    getList(`${API_URL}/analytics/lot-utilization`, token, 'GET /analytics/lot-utilization');
    sleep(0.3);
  });

  group('work orders', () => {
    getList(`${API_URL}/work-orders`, token, 'GET /work-orders');
    sleep(0.3);
  });

  sleep(0.5);
}
