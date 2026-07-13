#!/usr/bin/env bash
set -Eeuo pipefail

API_BASE="${VETHELP_API_BASE_URL:-http://127.0.0.1:3000}"
MOCK_MIS_BASE="${MOCK_MIS_BASE_URL:-http://127.0.0.1:4101}"
MOCK_ACQUIRING_BASE="${MOCK_ACQUIRING_BASE_URL:-http://127.0.0.1:4102}"
PHONE="${VETHELP_SMOKE_PHONE:-+79991234567}"
DEMO_PET_ID="${VETHELP_SMOKE_PET_ID:-22222222-2222-4222-8222-222222222222}"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

step() {
  printf '\n==> %s\n' "$1"
}

json_value() {
  local file="$1"
  local expression="$2"
  node -e '
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const value = Function("data", `return (${process.argv[2]});`)(data);
if (value === undefined || value === null || value === "") process.exit(2);
if (typeof value === "object") console.log(JSON.stringify(value));
else console.log(String(value));
' "$file" "$expression"
}

request_json() {
  local method="$1"
  local url="$2"
  local body="$3"
  local out="$4"
  shift 4
  if [[ -n "$body" ]]; then
    curl -fsS -X "$method" "$url" \
      -H 'Content-Type: application/json' \
      "$@" \
      -d "$body" > "$out"
  else
    curl -fsS -X "$method" "$url" "$@" > "$out"
  fi
}

uuid() {
  node -e 'console.log(crypto.randomUUID())'
}

step "health"
request_json GET "$API_BASE/v1/health" "" "$tmpdir/health.json"
json_value "$tmpdir/health.json" 'data.status'

step "mock MIS scenario"
request_json POST "$MOCK_MIS_BASE/__mock/scenarios" '{"mode":"success"}' "$tmpdir/mis-scenario.json"
json_value "$tmpdir/mis-scenario.json" 'data.configured.mode'

step "mock acquiring"
request_json GET "$MOCK_ACQUIRING_BASE/health" "" "$tmpdir/acquiring-health.json"
json_value "$tmpdir/acquiring-health.json" 'data.status'
request_json GET "$MOCK_ACQUIRING_BASE/__mock/state" "" "$tmpdir/acquiring-state.json"
json_value "$tmpdir/acquiring-state.json" 'Array.isArray(data.intents)'

step "mock MIS baseline"
request_json GET "$MOCK_MIS_BASE/__mock/state" "" "$tmpdir/mis-state-before.json"
mis_reservations_before="$(json_value "$tmpdir/mis-state-before.json" 'data.reservations.length')"

step "emergency capability fixture"
request_json GET "$API_BASE/v1/emergency/clinics?species=DOG&requiredCapabilities=OXYGEN_SUPPORT&latitude=55.7558&longitude=37.6173&limit=5" "" "$tmpdir/emergency.json"
json_value "$tmpdir/emergency.json" 'data[0]?.matchingCapabilities?.includes("OXYGEN_SUPPORT")'

step "OTP request"
if ! request_json POST "$API_BASE/v1/auth/otp/request" "{\"phone\":\"$PHONE\"}" "$tmpdir/otp-request.json"; then
  printf 'OTP request was rate limited or temporarily unavailable; waiting before retry...\n' >&2
  sleep 65
  request_json POST "$API_BASE/v1/auth/otp/request" "{\"phone\":\"$PHONE\"}" "$tmpdir/otp-request.json"
fi
challenge_id="$(json_value "$tmpdir/otp-request.json" 'data.challengeId')"
development_code="$(json_value "$tmpdir/otp-request.json" 'data.developmentCode')"

step "OTP verify"
request_json POST "$API_BASE/v1/auth/otp/verify" \
  "{\"phone\":\"$PHONE\",\"challengeId\":\"$challenge_id\",\"code\":\"$development_code\",\"deviceName\":\"local-smoke\"}" \
  "$tmpdir/otp-verify.json"
access_token="$(json_value "$tmpdir/otp-verify.json" 'data.accessToken')"
owner_id="$(json_value "$tmpdir/otp-verify.json" 'data.owner.id')"
printf 'owner=%s\n' "$owner_id"

auth_header=(-H "Authorization: Bearer $access_token")

step "owner profile"
request_json GET "$API_BASE/v1/owner/me" "" "$tmpdir/owner-profile.json" "${auth_header[@]}"
json_value "$tmpdir/owner-profile.json" 'data.owner.id'

step "create/list pet"
request_json POST "$API_BASE/v1/owner/pets" '{"name":"Smoke Pet","species":"DOG"}' "$tmpdir/create-pet.json" "${auth_header[@]}"
request_json GET "$API_BASE/v1/owner/pets" "" "$tmpdir/list-pets.json" "${auth_header[@]}"
pet_id="$(json_value "$tmpdir/list-pets.json" "data.find((pet) => pet.id === '$DEMO_PET_ID')?.id")"
printf 'bookingPet=%s\n' "$pet_id"

step "catalog query"
request_json GET "$API_BASE/v1/catalog/clinic-locations?q=VetHelp%20Pilot&limit=10" "" "$tmpdir/catalog.json"
location_id="$(json_value "$tmpdir/catalog.json" 'data.locations[0]?.location?.id')"
printf 'location=%s\n' "$location_id"

step "availability query"
availability_from="$(node -e 'console.log(new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString())')"
request_json GET "$API_BASE/v1/clinic-locations/$location_id/slots?from=$availability_from" "" "$tmpdir/slots.json"
slot_id="$(json_value "$tmpdir/slots.json" 'Array.isArray(data) ? data[0]?.id : data.slots?.[0]?.id')"
printf 'slot=%s\n' "$slot_id"

step "create hold"
hold_key="$(uuid)"
correlation_id="$(uuid)"
request_json POST "$API_BASE/v1/booking-holds" \
  "{\"slotId\":\"$slot_id\",\"petId\":\"$pet_id\"}" \
  "$tmpdir/create-hold.json" \
  "${auth_header[@]}" \
  -H "Idempotency-Key: $hold_key" \
  -H "X-Correlation-ID: $correlation_id"
hold_id="$(json_value "$tmpdir/create-hold.json" 'data.holdId')"
hold_state="$(json_value "$tmpdir/create-hold.json" 'data.state')"
printf 'hold=%s state=%s\n' "$hold_id" "$hold_state"
if [[ "${FEATURE_MIS_INTEGRATION:-false}" == "true" ]]; then
  if [[ "$hold_state" != "MIS_RESERVATION_PENDING" ]]; then
    printf 'Expected MIS hold state MIS_RESERVATION_PENDING, got %s\n' "$hold_state" >&2
    exit 1
  fi
else
  if [[ "$hold_state" != "CONFIRMED" ]]; then
    printf 'Expected autonomous hold state CONFIRMED, got %s\n' "$hold_state" >&2
    exit 1
  fi
fi

step "owner appointments"
request_json GET "$API_BASE/v1/owner/appointments" "" "$tmpdir/appointments.json" "${auth_header[@]}"
json_value "$tmpdir/appointments.json" "data.find((item) => item.holdId === '$hold_id')?.holdId"

step "hold details"
request_json GET "$API_BASE/v1/booking-holds/$hold_id" "" "$tmpdir/hold-details.json" "${auth_header[@]}"
json_value "$tmpdir/hold-details.json" 'data.holdId'

if [[ "${FEATURE_MIS_INTEGRATION:-false}" == "true" ]]; then
  step "mock MIS result"
  for attempt in 1 2 3 4 5; do
    request_json GET "$MOCK_MIS_BASE/__mock/state" "" "$tmpdir/mis-state.json"
    reservation_count="$(json_value "$tmpdir/mis-state.json" 'data.reservations.length' || true)"
    if [[ "${reservation_count:-0}" != "0" ]]; then
      json_value "$tmpdir/mis-state.json" 'data.reservations[0].status'
      printf '\nlocal smoke passed\n'
      exit 0
    fi
    sleep 1
  done

  printf 'Expected mock MIS reservation was not observed for hold %s\n' "$hold_id" >&2
  exit 1
else
  step "autonomous booking did not call MIS"
  request_json GET "$MOCK_MIS_BASE/__mock/state" "" "$tmpdir/mis-state-after.json"
  mis_reservations_after="$(json_value "$tmpdir/mis-state-after.json" 'data.reservations.length')"
  if [[ "$mis_reservations_after" != "$mis_reservations_before" ]]; then
    printf 'Expected no new MIS reservation in autonomous mode, before=%s after=%s\n' "$mis_reservations_before" "$mis_reservations_after" >&2
    exit 1
  fi
fi

printf '\nlocal smoke passed\n'
