import http from 'k6/http';
import { check, group } from 'k6';
import { API_URL, TEST_EMAIL, TEST_PASSWORD } from './k6-config.js';

/**
 * Authenticate and return an access token.
 * Aborts the VU iteration on failure so subsequent requests are skipped.
 */
export function login(email, password) {
  const res = http.post(
    `${API_URL}/auth/login`,
    JSON.stringify({
      email: email || TEST_EMAIL,
      password: password || TEST_PASSWORD,
    }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } },
  );

  const ok = check(res, {
    'login status is 200': (r) => r.status === 200,
    'login returns access_token': (r) => {
      try {
        return !!r.json('access_token');
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`Login failed: ${res.status} ${res.body}`);
    return null;
  }

  return res.json('access_token');
}

/**
 * Build Authorization + Content-Type headers from a token.
 */
export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * GET a paginated list endpoint and run basic checks.
 * Returns the parsed JSON body (or null on failure).
 */
export function getList(url, token, tag) {
  const res = http.get(url, {
    headers: authHeaders(token),
    tags: { name: tag },
  });

  check(res, {
    [`${tag} status is 200`]: (r) => r.status === 200,
    [`${tag} responds in < 2s`]: (r) => r.timings.duration < 2000,
  });

  try {
    return res.json();
  } catch {
    return null;
  }
}

/**
 * POST to an endpoint (create resource) and run basic checks.
 */
export function postJSON(url, payload, token, tag) {
  const res = http.post(url, JSON.stringify(payload), {
    headers: authHeaders(token),
    tags: { name: tag },
  });

  check(res, {
    [`${tag} status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${tag} responds in < 2s`]: (r) => r.timings.duration < 2000,
  });

  try {
    return res.json();
  } catch {
    return null;
  }
}

/**
 * PATCH an endpoint and run basic checks.
 */
export function patchJSON(url, payload, token, tag) {
  const res = http.patch(url, JSON.stringify(payload), {
    headers: authHeaders(token),
    tags: { name: tag },
  });

  check(res, {
    [`${tag} status is 200`]: (r) => r.status === 200,
    [`${tag} responds in < 2s`]: (r) => r.timings.duration < 2000,
  });

  try {
    return res.json();
  } catch {
    return null;
  }
}
