#!/usr/bin/env bash
#
# Runs the whole test suite against a real production build.
#
#   npm run build && npm test
#
# Four servers are started because some properties can only be observed under a
# particular configuration: the rate-limit ceilings need deterministic values,
# the proxy-trust behaviour differs by design between a deployment that vouches
# for its forwarding headers and one that does not, and the opt-in global
# submission guard has to be observed both off (the default) and on.
#
# A fifth production image is built by the last suite, in a scratch tree, because
# NEXT_PUBLIC_SITE_URL is inlined at build time and finding R2-03 is only
# observable in a build made without it.
#
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MAIN_PORT=${MAIN_PORT:-4801}
LIMIT_PORT=${LIMIT_PORT:-4802}
PROXY_PORT=${PROXY_PORT:-4803}
GLOBAL_PORT=${GLOBAL_PORT:-4804}
COLLECTOR_PORT=${COLLECTOR_PORT:-4899}
COLLECTOR_FILE=${COLLECTOR_FILE:-/tmp/test-collector.json}
export COLLECTOR_FILE
BASE="http://127.0.0.1:${MAIN_PORT}"

pids=()
# `npx next start` runs the real server as a GRANDCHILD, so killing the pid that
# $! reports leaves the listener alive holding the port. Runs then accumulate
# orphaned servers, and because every assertion here is an HTTP request to a
# port, a later run can silently probe a stale process and report ITS behaviour
# as this build's. That is not hypothetical — it happened, and a test spent
# several iterations "failing" against a server built from different source.
# Each server is therefore started in its own process group, and the whole group
# is killed.
cleanup() {
  for pid in "${pids[@]:-}"; do
    kill -9 -- "-$pid" 2>/dev/null
    kill -9 "$pid" 2>/dev/null
  done
}
trap cleanup EXIT

wait_for() {
  for _ in $(seq 1 40); do
    curl -s -o /dev/null "http://127.0.0.1:$1/" && return 0
    sleep 1
  done
  echo "server on port $1 did not start" >&2
  return 1
}

# Nothing may already be listening on the ports this suite is about to describe.
for guard_port in "$MAIN_PORT" "$LIMIT_PORT" "$PROXY_PORT" "$GLOBAL_PORT" "${BROKEN_PORT:-4805}" "$COLLECTOR_PORT"; do
  if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:${guard_port}/"; then
    echo "port ${guard_port} is already in use — refusing to run against an unknown server" >&2
    exit 1
  fi
done

start() {
  local port=$1; shift
  setsid env "$@" NEXT_PUBLIC_SITE_URL="http://127.0.0.1:${port}" NODE_ENV=production \
    ALLOW_LOCAL_SITE_URL=1 \
    npx next start -p "$port" >"/tmp/test-server-${port}.log" 2>&1 &
  pids+=($!)
  wait_for "$port"
}

# ALLOW_LOCAL_SITE_URL: a production build pointed at 127.0.0.1 is normally a
# configuration error and now fails the build (finding R3-M3). This harness is
# the legitimate exception, so it opens that door explicitly rather than the
# validator leaving it open for everyone.
export ALLOW_LOCAL_SITE_URL=1

echo "▸ building"
NEXT_PUBLIC_SITE_URL="$BASE" npm run build >/tmp/test-build.log 2>&1 || {
  echo "build failed — see /tmp/test-build.log" >&2; exit 1; }

echo "▸ starting the store collector"
rm -f "$COLLECTOR_FILE"
setsid node tests/collector.mjs "$COLLECTOR_PORT" "$COLLECTOR_FILE" &
pids+=($!)
sleep 1

echo "▸ starting servers"
# MAIN and LIMIT deliberately leave LEAD_RATE_LIMIT_GLOBAL unset: off is the
# shipped default after R2-01, and a suite that always set it would never
# exercise the default path.
start "$MAIN_PORT"   LEAD_STORE_URL="http://127.0.0.1:${COLLECTOR_PORT}/collect" LEAD_RATE_LIMIT_PER_IDENTITY=50
start "$LIMIT_PORT"  LEAD_STORE_URL="http://127.0.0.1:${COLLECTOR_PORT}/collect" LEAD_RATE_LIMIT_PER_IDENTITY=3
start "$PROXY_PORT"  LEAD_STORE_URL="http://127.0.0.1:${COLLECTOR_PORT}/collect" LEAD_RATE_LIMIT_PER_IDENTITY=3 TRUST_PROXY_HEADERS=1
# One server WITH the opt-in global guard, to prove it is real and that garbage
# cannot drive it.
start "$GLOBAL_PORT" LEAD_STORE_URL="http://127.0.0.1:${COLLECTOR_PORT}/collect" LEAD_RATE_LIMIT_GLOBAL=8 LEAD_RATE_LIMIT_PER_IDENTITY=50
# One server whose ONLY transport cannot be reached, so the delivery-failure
# paths are observable (finding R6-03). The port is deliberately dead.
BROKEN_PORT=${BROKEN_PORT:-4805}
start "$BROKEN_PORT" LEAD_STORE_URL="http://127.0.0.1:4198/nothing-listens-here" LEAD_RATE_LIMIT_PER_IDENTITY=5

failed=0
run() {
  local label="$1"; shift
  echo ""
  echo "──────── ${label} ────────"
  if "$@"; then :; else failed=1; echo "  ^^ ${label} FAILED"; fi
}

run "regression · source invariants (R2-07)" \
  node tests/regression/source-invariants.mjs
run "regression · documentation / code consistency (R4-02/07/09/11/17/21)" \
  node tests/regression/doc-consistency.mjs
# --import ./tests/ts-resolve.mjs: this suite imports src/lib/delivery.ts, which
# now imports "./safe-fetch" — an extensionless TS specifier Node cannot resolve
# on its own. Every other suite that reaches into src/ already uses the hook.
run "regression · trust boundary (H1-H4)" \
  node --import ./tests/ts-resolve.mjs --experimental-strip-types tests/regression/trust-boundary.mjs "$BASE"
run "unit · request identity, untrusted proxy (R2-02/R2-09)" \
  node --import ./tests/ts-resolve.mjs --experimental-strip-types tests/regression/identity-unit.mjs
run "unit · request identity, trusted proxy (R2-02/R2-09)" \
  env TRUST_PROXY_HEADERS=1 node --import ./tests/ts-resolve.mjs --experimental-strip-types tests/regression/identity-unit.mjs
run "unit · IP classification + consent evidence, untrusted (R4-18)" \
  node --import ./tests/ts-resolve.mjs --experimental-strip-types tests/regression/ip-classify-unit.mjs
run "unit · IP classification + consent evidence, trusted proxy (R4-18)" \
  env TRUST_PROXY_HEADERS=1 node --import ./tests/ts-resolve.mjs --experimental-strip-types tests/regression/ip-classify-unit.mjs
run "unit · redirect SSRF + POST preservation (R4-14)" \
  node --import ./tests/ts-resolve.mjs --experimental-strip-types tests/regression/ssrf-redirect.mjs
run "regression · rate limiting, untrusted proxy (H2/M8/R2-01/R2-02)" \
  node tests/regression/rate-limit.mjs "http://127.0.0.1:${LIMIT_PORT}" untrusted
run "regression · rate limiting, trusted proxy (H2/R2-01/R2-02)" \
  node tests/regression/rate-limit.mjs "http://127.0.0.1:${PROXY_PORT}" trusted
run "regression · honeypot accounting (R3-H1)" \
  node tests/regression/honeypot.mjs "http://127.0.0.1:${LIMIT_PORT}"
run "regression · budget attribution matrix (R4-04/R4-12/R6-03/R6-04)" \
  node --import ./tests/ts-resolve.mjs --experimental-strip-types tests/regression/budget-matrix.mjs "http://127.0.0.1:${LIMIT_PORT}" "http://127.0.0.1:${BROKEN_PORT}"
run "unit · Turnstile configuration coherence (R6-02)" \
  node --import ./tests/ts-resolve.mjs --experimental-strip-types tests/regression/turnstile-config-unit.mjs
run "unit · site url validation (R3-M3)" \
  node tests/regression/site-url-unit.mjs
run "unit · delivery resources (R3-M2)" \
  node --import ./tests/ts-resolve.mjs --experimental-strip-types tests/regression/delivery-resources.mjs
run "regression · global budget off by default (R2-01)" \
  node tests/regression/global-budget.mjs "http://127.0.0.1:${LIMIT_PORT}" off
run "regression · global budget opt-in, garbage-proof (R2-01)" \
  node tests/regression/global-budget.mjs "http://127.0.0.1:${GLOBAL_PORT}" 8
run "unit · delivery transport (R2-06)" \
  node --import ./tests/ts-resolve.mjs --experimental-strip-types tests/regression/delivery-unit.mjs
run "regression · indexing directives (R2-08)" \
  node tests/regression/seo-meta.mjs "$BASE"
run "regression · hydration gate and breakpoint (R2-04/R2-05)" \
  node tests/regression/hydration-ui.mjs "$BASE"
run "regression · mobile menu + focus visibility (R3-H2/R3-H4)" \
  node tests/regression/menu-focus.mjs "$BASE"
run "regression · quote wizard step 5, radio a11y, focus (R4-01/R4-15/R6-05)" \
  node tests/regression/quote-wizard.mjs "$BASE"
run "regression · chrome, focus, contrast (R4-03/06/08/09/10, R6-06)" \
  node tests/regression/chrome-focus.mjs "$BASE"
run "regression · every route x 11 widths incl. landscape (R3-H2/R3-M12)" \
  node tests/regression/viewport-sweep.mjs "$BASE"
run "regression · security headers (H6/R3-L4)" \
  node tests/regression/security-headers.mjs "$BASE"
run "regression · content claims (R4-05/R4-19/R4-20)" \
  node --import ./tests/ts-resolve.mjs --experimental-strip-types tests/regression/content-claims.mjs "$BASE"
run "regression · demo safety (H7/M11/M12)" \
  node tests/regression/demo-safety.mjs "$BASE"
run "regression · accessibility (M3/M4/M5/M7)" \
  node tests/regression/accessibility.mjs "$BASE"
run "api contract" \
  node tests/api-contract.mjs "$BASE"
run "form flows, end to end" \
  node tests/form-flows.mjs "$BASE"
run "route audit · 19 routes x 7 viewports" \
  node tests/route-audit.mjs "$BASE"
# Last, because each of these builds another production image in a scratch tree.
run "regression · production build with no canonical URL (R2-03)" \
  bash tests/regression/no-site-url.sh
run "regression · Turnstile-enabled build (R3-H3)" \
  bash tests/regression/turnstile-enabled.sh

echo ""
if [ "$failed" -eq 0 ]; then echo "ALL SUITES PASSED"; else echo "ONE OR MORE SUITES FAILED"; fi
exit "$failed"
