import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:8085').replace(/\/$/, '');
const accessToken = __ENV.SYNTHETIC_ACCESS_TOKEN || '';
const requireRequestId = __ENV.REQUIRE_REQUEST_ID === 'true';
const rampVUs = Number(__ENV.RAMP_VUS || 5);
const holdSeconds = Number(__ENV.HOLD_SECONDS || 60);
const rampSeconds = Number(__ENV.RAMP_SECONDS || 30);

export const options = {
  scenarios: {
    health_ghost: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: `${rampSeconds}s`, target: rampVUs },
        { duration: `${holdSeconds}s`, target: rampVUs },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1200'],
    checks: ['rate>0.99'],
  },
};

function headers() {
  const result = {
    'X-Synthetic-Run-Id': `ghost-${__VU}-${__ITER}-${Date.now()}`,
    'X-Synthetic-Cohort': 'health-ghost',
    'Cache-Control': 'no-store',
  };
  if (accessToken) result.Authorization = `Bearer ${accessToken}`;
  return result;
}

function checkResponse(response, name, expectedStatus = 200) {
  const checks = {
    [`${name}: status ${expectedStatus}`]: (value) => value.status === expectedStatus,
    [`${name}: no server error`]: (value) => value.status < 500,
  };
  if (requireRequestId) {
    checks[`${name}: request id present`] = (value) => Boolean(value.headers['X-Request-Id']);
  }
  check(response, checks);
}

export default function () {
  const health = http.get(`${baseUrl}/api/health`, { headers: headers(), tags: { journey: 'health', cohort: 'health-ghost' } });
  checkResponse(health, 'go health');

  // Authenticated calls are strictly opt-in and read-only. Supply a short-lived
  // staging token only; this script never signs up users or mutates records.
  if (accessToken) {
    const readOnlyPaths = [
      '/api/v1/profile',
      '/api/v1/jobs/saved',
      '/api/v1/autopilot/runs',
    ];
    for (const path of readOnlyPaths) {
      const response = http.get(`${baseUrl}${path}`, {
        headers: headers(),
        tags: { journey: 'candidate-read-only', cohort: 'candidate-ghost', route: path },
      });
      checkResponse(response, `read-only ${path}`, response.status === 401 ? 401 : 200);
    }
  }

  sleep(Number(__ENV.THINK_TIME_SECONDS || 1));
}
