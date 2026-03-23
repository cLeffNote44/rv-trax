/**
 * RV Trax — k6 Load Test Configuration
 *
 * Usage:
 *   k6 run tests/load/smoke.js          # Quick smoke test (1 VU, 30s)
 *   k6 run tests/load/load.js           # Normal load (50 VUs, 5min)
 *   k6 run tests/load/stress.js         # Stress test (200 VUs, 10min)
 *   k6 run tests/load/spike.js          # Spike test (0->500 VUs->0)
 *   k6 run tests/load/websocket.js      # WebSocket test (100 connections)
 *
 * Environment:
 *   K6_API_URL=http://localhost:3000     # API base URL
 *   K6_API_EMAIL=admin@demo.rvtrax.com  # Test user email
 *   K6_API_PASSWORD=password             # Test user password
 */

export const BASE_URL = __ENV.K6_API_URL || 'http://localhost:3000';
export const API_URL = `${BASE_URL}/api/v1`;
export const TEST_EMAIL = __ENV.K6_API_EMAIL || 'admin@demo.rvtrax.com';
export const TEST_PASSWORD = __ENV.K6_API_PASSWORD || 'password';

// Default thresholds applied to all test profiles
export const THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1500'],
  http_req_failed: ['rate<0.01'],
  http_reqs: ['rate>100'],
};

// Relaxed thresholds for stress / spike tests
export const STRESS_THRESHOLDS = {
  http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  http_req_failed: ['rate<0.05'],
  http_reqs: ['rate>50'],
};
