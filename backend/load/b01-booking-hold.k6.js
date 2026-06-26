import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';

const created = new Counter('b01_created');
const conflicts = new Counter('b01_conflicts');
const unexpected = new Counter('b01_unexpected');

http.setResponseCallback(http.expectedStatuses(201, 409, 422));

export const options = {
  scenarios: {
    b01: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 1,
      maxDuration: '30s',
      gracefulStop: '0s',
    },
  },
  thresholds: {
    b01_created: ['count==1'],
    b01_conflicts: ['count==99'],
    b01_unexpected: ['count==0'],
    checks: ['rate==1'],
    http_req_failed: ['rate==0'],
  },
};

function requestUuid(vu, discriminator) {
  return `00000000-0000-4000-8000-${discriminator}${String(vu).padStart(11, '0')}`;
}

export default function () {
  const vu = exec.vu.idInTest;
  const response = http.post(
    `${__ENV.BASE_URL}/v1/booking-holds`,
    JSON.stringify({ slotId: __ENV.B01_SLOT_ID, petId: __ENV.B01_PET_ID }),
    {
      headers: {
        Authorization: `Bearer ${__ENV.B01_OWNER_TOKEN}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': requestUuid(vu, '1'),
        'X-Correlation-ID': requestUuid(vu, '2'),
      },
      tags: { scenario: 'B-01' },
    },
  );

  const body = response.json() || {};
  const isAllowedConflict =
    (response.status === 409 &&
      (body.code === 'SLOT_ALREADY_TAKEN' || body.code === 'SLOT_LOCKED_RETRY')) ||
    (response.status === 422 && body.code === 'HOLD_ALREADY_ACTIVE');
  const isExpected = response.status === 201 || isAllowedConflict;

  if (response.status === 201) created.add(1);
  else if (isAllowedConflict) conflicts.add(1);
  else unexpected.add(1);

  check(response, {
    'B-01 returns only one success or a controlled conflict': () => isExpected,
    'B-01 has no server error': () => response.status < 500,
  });
}
