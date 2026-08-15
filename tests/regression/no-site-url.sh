#!/usr/bin/env bash
#
# REGRESSION TEST — finding R2-03.
#
# NEXT_PUBLIC_SITE_URL is inlined at BUILD time. A production image built
# without it fell back to http://localhost:3000, and every consent record then
# claimed a real person had given consent at `http://localhost:3000/quote` — a
# uniformly false statement in the one field whose entire purpose is
# provability, produced with no attacker involvement and visible nowhere at
# runtime.
#
# This cannot be tested against the ordinary suite's servers: the value is baked
# into the bundle, so proving the behaviour requires a SECOND production build
# made without the variable. That build is done in a scratch copy of the tree so
# the main .next directory is untouched.
#
#   bash tests/regression/no-site-url.sh
#
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Keyed on the port so two checkouts running this concurrently cannot build
# into the same scratch tree.
WORK="${TMPDIR:-/tmp}/no-site-url-build-${NO_SITE_URL_PORT:-4820}"
PORT=${NO_SITE_URL_PORT:-4820}
COLLECTOR_PORT=${NO_SITE_URL_COLLECTOR_PORT:-4898}
COLLECTOR_FILE="${TMPDIR:-/tmp}/no-site-url-collector.json"

pass=0; fail=0
check() { # name, condition-string result
  if [ "$2" = "1" ]; then pass=$((pass+1)); echo "  PASS  $1";
  else fail=$((fail+1)); echo "  FAIL  $1${3:+  — $3}"; fi
}

server_pid=""
collector_pid=""
# `next start` runs the real server as a GRANDCHILD (sh -c -> next-server), so
# killing the pid that $! reports leaves the listener alive and holding the
# port. Every previous run then orphans a server, and the next run either fails
# the port guard above or — worse, before that guard existed — silently probes
# the stale process and reports its configuration as this build's. The server is
# therefore started with setsid and the whole process GROUP is killed.
cleanup() {
  [ -n "$server_pid" ] && { kill -9 -- "-$server_pid" 2>/dev/null; kill -9 "$server_pid" 2>/dev/null; }
  [ -n "$collector_pid" ] && kill -9 "$collector_pid" 2>/dev/null
  rm -rf "$WORK"
  rm -f "$COLLECTOR_FILE"
}
trap cleanup EXIT

echo ""
echo "=== R2-03 · a production build with no canonical URL ==="

# A LEFTOVER LISTENER WOULD MAKE THIS TEST LIE. Every probe below is a plain
# HTTP request to a port; if something else already answers there, the results
# describe that process instead — which is exactly how an earlier run of this
# file reported a transport as unconfigured when it was talking to a stale
# server from a previous run. Refuse to start rather than produce a confident
# wrong answer.
for guard_port in "$PORT" "$COLLECTOR_PORT"; do
  if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:${guard_port}/"; then
    echo "  FAIL  port ${guard_port} is already in use — refusing to run against an unknown server"
    echo ""
    echo "  0 passed, 1 failed"
    exit 1
  fi
done

echo "  (building a scratch copy without NEXT_PUBLIC_SITE_URL — this takes a minute)"

rm -rf "$WORK"
mkdir -p "$WORK"
# Everything the build needs, except node_modules and the existing output.
tar -C "$ROOT" --exclude=node_modules --exclude=.next --exclude=.git -cf - . | tar -C "$WORK" -xf -
# Hard links, not a symlink: Turbopack refuses a node_modules symlink that
# points outside the project root ("invalid, it points out of the filesystem
# root"). Hard links cost essentially no extra disk and are a real directory.
cp -al "$ROOT/node_modules" "$WORK/node_modules"

# The variable is deliberately absent from this build, and ONLY this build.
( cd "$WORK" && env -u NEXT_PUBLIC_SITE_URL -u ALLOW_LOCAL_SITE_URL npx next build ) >"${TMPDIR:-/tmp}/no-site-url-build.log" 2>&1
if [ $? -ne 0 ]; then
  echo "  FAIL  the scratch build did not complete — see ${TMPDIR:-/tmp}/no-site-url-build.log"
  echo ""
  echo "  0 passed, 1 failed"
  exit 1
fi
check "a build with no NEXT_PUBLIC_SITE_URL still completes (it is not a hard build failure)" 1

# A transport MUST be configured. With none, production answers 503 for every
# lead ("nothing configured"), which would make the 503 this test is looking for
# meaningless — it has to be attributable to the canonical-URL guard alone.
node "$ROOT/tests/collector.mjs" "$COLLECTOR_PORT" "$COLLECTOR_FILE" >/dev/null 2>&1 &
collector_pid=$!
sleep 1

setsid env -C "$WORK" -u NEXT_PUBLIC_SITE_URL -u ALLOW_LOCAL_SITE_URL NODE_ENV=production \
    LEAD_STORE_URL="http://127.0.0.1:${COLLECTOR_PORT}/collect" \
    npx next start -p "$PORT" >"${TMPDIR:-/tmp}/no-site-url-server.log" 2>&1 &
server_pid=$!

up=0
for _ in $(seq 1 40); do
  curl -s -o /dev/null "http://127.0.0.1:${PORT}/" && { up=1; break; }
  sleep 1
done
check "the site still serves (it does not crash on boot)" "$up"
[ "$up" = "1" ] || { echo ""; echo "  $pass passed, $((fail+1)) failed"; exit 1; }

# A quote is the lead kind that CARRIES a consent block, so it is the one whose
# source URL must be provable. The consent echo is deliberately wrong-but-
# present: if the configuration guard did not fire first, this payload would be
# answered 409 (consent mismatch), not 503 — so a 503 here can only come from
# the guard.
LEAD='{"kind":"quote","situation":"family","amount":"250k-500k","age":"45","sex":"female","state":"Minnesota","tobacco":"no","health":"good","name":"Config Probe","email":"probe@example.test","phone":"9522327177","contactTime":"any","notes":"","consent":true,"consentVersion":"consumer-tcpa-v1","consentText":"x"}'

body=$(curl -s -o "${TMPDIR:-/tmp}/r203-body.json" -w "%{http_code}" \
  -X POST "http://127.0.0.1:${PORT}/api/lead" \
  -H "Content-Type: application/json" -d "$LEAD")
payload=$(cat "${TMPDIR:-/tmp}/r203-body.json")

check "a consent-bearing submission is REFUSED, not silently recorded" \
  "$([ "$body" = "503" ] && echo 1 || echo 0)" "status $body"

check "the refusal is a 5xx configuration error, not a 4xx blaming the visitor" \
  "$([ "${body:0:1}" = "5" ] && echo 1 || echo 0)" "status $body"

check "the response carries a request id the operator can correlate" \
  "$(echo "$payload" | grep -q 'requestId' && echo 1 || echo 0)" "$payload"

check "the response does not leak the localhost fallback to the visitor" \
  "$(echo "$payload" | grep -qi 'localhost' && echo 0 || echo 1)" "$payload"

# The point of the finding: nothing may claim localhost was the source.
check "no consent record claiming localhost was produced" \
  "$(echo "$payload" | grep -qi 'localhost:3000' && echo 0 || echo 1)" "$payload"

check "the server log names the missing variable so the operator can act" \
  "$(grep -q 'NEXT_PUBLIC_SITE_URL' "${TMPDIR:-/tmp}/no-site-url-server.log" && echo 1 || echo 0)" \
  "$(tail -3 "${TMPDIR:-/tmp}/no-site-url-server.log" | tr '\n' ' ')"

# A contact message carries no consent block, so it has nothing to be dishonest
# about and must still work — refusing it would be collateral damage.
CONTACT='{"kind":"contact","name":"Config Probe","email":"probe@example.test","phone":"","reason":"general","message":"Still reachable?"}'
cstatus=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:${PORT}/api/lead" \
  -H "Content-Type: application/json" -d "$CONTACT")
check "a contact message (no consent block) is NOT collateral damage" \
  "$([ "$cstatus" = "200" ] && echo 1 || echo 0)" "status $cstatus"

# And the refusal must have happened BEFORE anything was written anywhere.
stored=$(cat "$COLLECTOR_FILE" 2>/dev/null || echo "[]")
check "no quote record reached the store at all" \
  "$(echo "$stored" | grep -Eq '"kind":\s*"quote"' && echo 0 || echo 1)" \
  "$(echo "$stored" | head -c 200)"
check "the contact record DID reach the store (the transport really was working)" \
  "$(echo "$stored" | grep -Eq '"kind":\s*"contact"' && echo 1 || echo 0)" \
  "$(echo "$stored" | head -c 200)"

echo ""
echo "  $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
