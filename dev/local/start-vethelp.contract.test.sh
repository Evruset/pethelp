#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
LAUNCHER="$ROOT_DIR/start-vethelp.sh"
RICH_WRAPPER="$ROOT_DIR/dev/local/rich-demo-up.sh"
FIXTURE="$(mktemp -d "${TMPDIR:-/tmp}/vethelp-launcher-contract.XXXXXX")"
trap 'rm -rf "$FIXTURE"' EXIT

fail(){ printf '[launcher-test] FAIL %s\n' "$*" >&2; exit 1; }
run_dry(){
  VETHELP_DRY_RUN=1 VETHELP_MODE=bounded-test VETHELP_TEST_STATE_ROOT="$FIXTURE/state" \
    "$LAUNCHER" "$@"
}

run_dry help | rg -F 'seed base|owner|clinic|rich-demo|all' >/dev/null
[[ ! -e "$FIXTURE/state" ]] || fail 'help mutated runtime state'
run_dry status | rg -F 'Clinic Portal: http://127.0.0.1:3001' >/dev/null
[[ ! -e "$FIXTURE/state" ]] || fail 'status mutated runtime state'
run_dry up | rg -F 'docker compose -p vethelp-alpha' >/dev/null
if run_dry invalid >/dev/null 2>&1; then fail 'invalid command accepted'; fi
if run_dry seed invalid >/dev/null 2>&1; then fail 'invalid profile accepted'; fi

for profile in base owner clinic rich-demo all; do
  report="$(run_dry seed "$profile" | tail -n 1)"
  PROFILE="$profile" REPORT="$report" node - <<'NODE'
const report = JSON.parse(process.env.REPORT);
if (report.profile !== process.env.PROFILE || report.schemaVersion !== 1) process.exit(1);
if (!Array.isArray(report.sources) || !Array.isArray(report.dependencies) || !Array.isArray(report.artifacts)) process.exit(1);
if (new Set(report.sources).size !== report.sources.length) throw new Error('duplicate source execution');
NODE
done

STATE="$FIXTURE/state" node - <<'NODE'
const fs = require('fs');
const path = require('path');
const state = process.env.STATE;
const expected = {
  base: { dependencies: [], sources: ['LOCAL_BASE_SEED'] },
  owner: { dependencies: ['base'], sources: ['LOCAL_BASE_SEED', 'LOCAL_IDENTITIES_V1', 'LOCAL_DEV_OWNER_MARKETPLACE'] },
  clinic: { dependencies: ['base'], sources: ['LOCAL_BASE_SEED', 'LOCAL_IDENTITIES_V1', 'LOCAL_CLINIC_EMPLOYEE_V1', 'LOCAL_DEV_QUEUE_FIXTURE'] },
  'rich-demo': { dependencies: ['base'], sources: ['LOCAL_BASE_SEED', 'LOCAL_RICH_DEMO_V1'] },
};
for (const [profile, contract] of Object.entries(expected)) {
  const report = JSON.parse(fs.readFileSync(path.join(state, 'seeds', `profile-${profile}.json`)));
  if (JSON.stringify(report.dependencies) !== JSON.stringify(contract.dependencies)) throw new Error(`${profile} dependencies`);
  if (JSON.stringify(report.sources) !== JSON.stringify(contract.sources)) throw new Error(`${profile} source order`);
}
NODE

all_report="$(run_dry seed all | tail -n 1)"
REPORT="$all_report" node - <<'NODE'
const report = JSON.parse(process.env.REPORT);
if (report.sources.includes('LOCAL_RICH_DEMO_V1')) throw new Error('rich-demo leaked into all');
if (JSON.stringify(report.sources) !== JSON.stringify([
  'LOCAL_BASE_SEED',
  'LOCAL_IDENTITIES_V1',
  'LOCAL_DEV_OWNER_MARKETPLACE',
  'LOCAL_CLINIC_EMPLOYEE_V1',
  'LOCAL_DEV_QUEUE_FIXTURE',
])) throw new Error(`wrong all order: ${report.sources}`);
NODE

legacy_seed="$(run_dry seed | tail -n 1)"
REPORT="$legacy_seed" node -e "if(JSON.parse(process.env.REPORT).profile!=='all')process.exit(1)"

rg -F 'exec "$CANONICAL" seed rich-demo' "$RICH_WRAPPER" >/dev/null
rg -F 'exec "$ROOT_DIR/start-vethelp.sh" up "$@"' "$ROOT_DIR/dev/local/up.sh" >/dev/null
rg -F 'exec "$ROOT_DIR/start-vethelp.sh" stop "$@"' "$ROOT_DIR/dev/local/down.sh" >/dev/null
if rg -n 'docker compose|compose (up|down|stop|run|exec)' "$RICH_WRAPPER" >/dev/null; then
  fail 'rich wrapper owns Compose'
fi
if rg -n 'docker compose|compose (up|down|stop|run|exec)' "$ROOT_DIR/dev/local/up.sh" "$ROOT_DIR/dev/local/down.sh" >/dev/null; then
  fail 'legacy up/down wrapper owns Compose'
fi
rg -F 'compose stop' "$LAUNCHER" >/dev/null
if rg -n 'compose down|kill -KILL|pkill|pgrep.*command|lsof.*-[iP].*300[0-9]-' "$LAUNCHER" >/dev/null; then
  fail 'unsafe lifecycle operation found'
fi
rg -F '.runtime/vethelp-local' "$LAUNCHER" >/dev/null
rg -F 'PORTAL_PORT=3001' "$LAUNCHER" >/dev/null
rg -F 'PROJECT="${VETHELP_PROJECT:-vethelp-alpha}"' "$LAUNCHER" >/dev/null

if VETHELP_DRY_RUN=1 VETHELP_MODE=existing-runtime-validation \
  VETHELP_TEST_STATE_ROOT="$FIXTURE/existing" "$LAUNCHER" up >/dev/null 2>&1; then
  fail 'existing-runtime mode accepted up'
fi
if VETHELP_DRY_RUN=1 VETHELP_MODE=existing-runtime-validation \
  VETHELP_TEST_STATE_ROOT="$FIXTURE/existing" "$LAUNCHER" stop >/dev/null 2>&1; then
  fail 'existing-runtime mode accepted stop'
fi
if VETHELP_DRY_RUN=1 VETHELP_MODE=existing-runtime-validation \
  VETHELP_TEST_STATE_ROOT="$FIXTURE/existing" "$LAUNCHER" seed base >/dev/null 2>&1; then
  fail 'existing-runtime mode accepted implicit mutation'
fi
VETHELP_DRY_RUN=1 VETHELP_TEST_STATE_ROOT="$FIXTURE/existing-explicit" \
  "$LAUNCHER" --mode existing-runtime-validation --allow-mutation seed base >/dev/null

legacy="$ROOT_DIR/.dev-local/rich-demo"
before=absent
[[ ! -e "$legacy" ]] || before=present
run_dry seed rich-demo >/dev/null
after=absent
[[ ! -e "$legacy" ]] || after=present
[[ "$before" == "$after" ]] || fail 'legacy state changed'

while IFS= read -r path; do
  [[ "$(stat -f '%Lp' "$path")" == 700 ]] || fail "directory mode is not 0700: $path"
done < <(find "$FIXTURE/state" -type d)
while IFS= read -r path; do
  [[ "$(stat -f '%Lp' "$path")" == 600 ]] || fail "file mode is not 0600: $path"
done < <(find "$FIXTURE/state" -type f)

mkdir -p "$FIXTURE/state/rich-demo/bootstrap-codes"
printf 'sensitive\n' >"$FIXTURE/state/rich-demo/demo-sessions.json"
printf 'sensitive\n' >"$FIXTURE/state/rich-demo/demo-sessions.html"
printf 'sensitive\n' >"$FIXTURE/state/rich-demo/bootstrap-codes/code"
run_dry stop >/dev/null
run_dry stop >/dev/null
[[ ! -e "$FIXTURE/state/rich-demo/demo-sessions.json" ]] || fail 'session JSON survived cleanup'
[[ ! -e "$FIXTURE/state/rich-demo/demo-sessions.html" ]] || fail 'session HTML survived cleanup'
[[ ! -e "$FIXTURE/state/rich-demo/bootstrap-codes/code" ]] || fail 'bootstrap code survived cleanup'
[[ -s "$FIXTURE/state/seeds/profile-rich-demo.json" ]] || fail 'cleanup removed persistent seed report'

printf '[launcher-test] PASS cli=valid aliases=valid lifecycle=single-owner seedGraph=valid artifacts=private cleanup=idempotent legacyState=preserved\n'
