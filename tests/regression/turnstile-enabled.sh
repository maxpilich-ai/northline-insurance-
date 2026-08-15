#!/usr/bin/env bash
#
# REGRESSION TEST — the Turnstile-ENABLED build (finding R3-H3).
#
# Turnstile is off in the shipped demonstration build, so every existing suite
# runs against the disabled path and the entire enabled branch — widget mount,
# token acquisition, the CSP allowance, and what a visitor sees when Cloudflare
# cannot be reached — was untested. That is where R3-H3 lived: the README
# promised fail-open, the browser failed closed, and nothing noticed.
#
# Turnstile is a single build-time switch, so observing it requires a SECOND
# production build with both keys present. That build happens in a scratch copy
# so the main .next directory is untouched.
#
#   bash tests/regression/turnstile-enabled.sh
#
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT=${TURNSTILE_PORT:-4830}
COLLECTOR_PORT=${TURNSTILE_COLLECTOR_PORT:-4897}
WORK="${TMPDIR:-/tmp}/turnstile-build-${PORT}"
COLLECTOR_FILE="${TMPDIR:-/tmp}/turnstile-collector.json"

# Cloudflare's PUBLISHED TEST KEYS. Not credentials — they are documented
# constants anyone can use, and no real key appears in this repository.
#
#   site 1x000...AA    the widget always issues a token
#   secret 1x000...AA  siteverify always ACCEPTS  -> the success path
#   secret 2x000...AA  siteverify always REJECTS  -> the invalid-token path
#
# The secret is read at RUNTIME, so both paths come from ONE build served by two
# servers rather than two builds.
SITE_KEY="1x00000000000000000000AA"
SECRET_PASS="1x0000000000000000000000000000000AA"
SECRET_FAIL="2x0000000000000000000000000000000AA"
FAIL_PORT=$((PORT + 1))

server_pid=""
collector_pid=""
fail_pid=""
cleanup() {
  [ -n "$server_pid" ] && { kill -9 -- "-$server_pid" 2>/dev/null; kill -9 "$server_pid" 2>/dev/null; }
  [ -n "$fail_pid" ] && { kill -9 -- "-$fail_pid" 2>/dev/null; kill -9 "$fail_pid" 2>/dev/null; }
  [ -n "$collector_pid" ] && kill -9 "$collector_pid" 2>/dev/null
  rm -rf "$WORK"
  rm -f "$COLLECTOR_FILE"
}
trap cleanup EXIT

echo ""
echo "=== R3-H3 · the Turnstile-enabled build ==="

for guard_port in "$PORT" "$FAIL_PORT" "$COLLECTOR_PORT"; do
  if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:${guard_port}/"; then
    echo "  FAIL  port ${guard_port} is already in use — refusing to run against an unknown server"
    echo ""; echo "  0 passed, 1 failed"; exit 1
  fi
done

echo "  (building a scratch copy WITH Turnstile keys — this takes a minute)"
rm -rf "$WORK"; mkdir -p "$WORK"
tar -C "$ROOT" --exclude=node_modules --exclude=.next --exclude=.git -cf - . | tar -C "$WORK" -xf -
cp -al "$ROOT/node_modules" "$WORK/node_modules"

( cd "$WORK" && env \
    NEXT_PUBLIC_SITE_URL="http://127.0.0.1:${PORT}" \
    ALLOW_LOCAL_SITE_URL=1 \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY="$SITE_KEY" \
    TURNSTILE_SECRET_KEY="$SECRET_PASS" \
    npx next build ) >"${TMPDIR:-/tmp}/turnstile-build.log" 2>&1
if [ $? -ne 0 ]; then
  echo "  FAIL  the Turnstile build did not complete — see ${TMPDIR:-/tmp}/turnstile-build.log"
  echo ""; echo "  0 passed, 1 failed"; exit 1
fi

setsid node "$ROOT/tests/collector.mjs" "$COLLECTOR_PORT" "$COLLECTOR_FILE" >/dev/null 2>&1 &
collector_pid=$!
sleep 1

start_server() { # port, secret
  setsid env -C "$WORK" \
    NEXT_PUBLIC_SITE_URL="http://127.0.0.1:${PORT}" \
    ALLOW_LOCAL_SITE_URL=1 \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY="$SITE_KEY" \
    TURNSTILE_SECRET_KEY="$2" \
    LEAD_STORE_URL="http://127.0.0.1:${COLLECTOR_PORT}/collect" \
    NODE_ENV=production \
    npx next start -p "$1" >"${TMPDIR:-/tmp}/turnstile-server-$1.log" 2>&1 &
  echo $!
}

server_pid=$(start_server "$PORT" "$SECRET_PASS")
fail_pid=$(start_server "$FAIL_PORT" "$SECRET_FAIL")

wait_up() {
  for _ in $(seq 1 45); do
    curl -s -o /dev/null "http://127.0.0.1:$1/" && return 0
    sleep 1
  done
  return 1
}
if ! wait_up "$PORT" || ! wait_up "$FAIL_PORT"; then
  echo "  FAIL  a Turnstile-enabled server did not start"
  echo ""; echo "  0 passed, 1 failed"; exit 1
fi

# The CSP allowance is checked directly rather than by running the whole
# security-headers suite, which also exercises form submission and would fail
# here for reasons unrelated to Turnstile.
csp=$(curl -sI "http://127.0.0.1:${PORT}/" | tr -d '\r' | grep -i '^content-security-policy:')
csp_ok=1
for directive in "script-src" "connect-src" "frame-src"; do
  echo "$csp" | tr ';' '\n' | grep -E "^ *${directive}" | grep -q "challenges.cloudflare.com" || csp_ok=0
done
if [ "$csp_ok" = "1" ]; then
  echo "  PASS  with Turnstile ON, the CSP allows its script, frame and network host"
else
  echo "  FAIL  with Turnstile ON, the CSP does not allow the Turnstile host"
  echo "        $csp"
fi

# --import ts-resolve: this suite reads site.config.ts to decide whether the
# telephone fallback should be dialable (see the note in turnstile-ui.mjs).
node --import "$ROOT/tests/ts-resolve.mjs" --experimental-strip-types \
  "$ROOT/tests/regression/turnstile-ui.mjs" "http://127.0.0.1:${PORT}" "http://127.0.0.1:${FAIL_PORT}"
ui=$?

[ "$ui" -eq 0 ] && [ "$csp_ok" = "1" ] || exit 1
