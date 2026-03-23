/**
 * RV Trax — Stress Test
 *
 * Pushes the system to its limits: ramp to 200 VUs over 3 min,
 * hold at 200 for 10 min, then ramp down.
 * Includes write operations (create unit, update status, create work order).
 *
 *   k6 run tests/load/stress.js
 */

import { sleep, group } from 'k6';
import { Counter } from 'k6/metrics';
import { API_URL, STRESS_THRESHOLDS } from './k6-config.js';
import { login, getList, postJSON, patchJSON } from './helpers.js';

const writeErrors = new Counter('write_errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // ramp to 100
    { duration: '1m', target: 200 }, // ramp to 200
    { duration: '10m', target: 200 }, // sustained stress
    { duration: '2m', target: 0 }, // ramp down
  ],
  thresholds: {
    ...STRESS_THRESHOLDS,
    write_errors: ['count<50'],
  },
};

// Generate a unique stock number per VU + iteration
function stockNumber() {
  return `K6-${__VU}-${__ITER}-${Date.now()}`;
}

export default function () {
  const token = login();
  if (!token) {
    sleep(1);
    return;
  }

  // ── Read operations (majority of traffic) ─────────────────────────────────

  group('read inventory', () => {
    const units = getList(`${API_URL}/units`, token, 'GET /units');
    sleep(0.3);

    if (units && units.data && units.data.length > 0) {
      const unitId = units.data[0].id;
      getList(`${API_URL}/units/${unitId}`, token, 'GET /units/:id');
    }
    sleep(0.3);
  });

  group('read trackers and alerts', () => {
    getList(`${API_URL}/trackers`, token, 'GET /trackers');
    sleep(0.2);
    getList(`${API_URL}/alerts`, token, 'GET /alerts');
    sleep(0.2);
  });

  group('analytics', () => {
    getList(`${API_URL}/analytics/inventory`, token, 'GET /analytics/inventory');
    sleep(0.2);
    getList(`${API_URL}/analytics/lot-utilization`, token, 'GET /analytics/lot-utilization');
    sleep(0.3);
  });

  // ── Write operations (10% of iterations) ──────────────────────────────────

  if (__ITER % 10 === 0) {
    group('create unit', () => {
      const result = postJSON(
        `${API_URL}/units`,
        {
          stock_number: stockNumber(),
          vin: `K6TEST${String(__VU).padStart(4, '0')}${String(__ITER).padStart(6, '0')}`,
          year: 2024,
          make: 'K6 Test',
          model: 'Load Runner',
          type: 'class_a',
          status: 'in_stock',
        },
        token,
        'POST /units',
      );

      if (!result) {
        writeErrors.add(1);
      }
      sleep(0.5);
    });

    group('create work order', () => {
      // Fetch a unit to attach the work order to
      const units = getList(`${API_URL}/units`, token, 'GET /units (for WO)');

      if (units && units.data && units.data.length > 0) {
        const unitId = units.data[0].id;
        const result = postJSON(
          `${API_URL}/work-orders`,
          {
            unit_id: unitId,
            title: `k6 stress test WO - VU ${__VU} iter ${__ITER}`,
            priority: 'medium',
            notes: 'Automated k6 stress test work order',
          },
          token,
          'POST /work-orders',
        );

        if (!result) {
          writeErrors.add(1);
        }
      }
      sleep(0.5);
    });
  }

  // Think time
  sleep(1);
}
