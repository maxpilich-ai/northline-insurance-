/**
 * REGRESSION TESTS — lib/delivery.ts, the store transport.
 *
 * FINDING R2-06. `deliverStore` reported success on any 2xx. LEAD_STORE_URL is
 * operator-configured and long-lived, so the realistic failure is not a hostile
 * endpoint but a stale one: a parked domain, a captive portal, a marketing page
 * or a decommissioned webhook whose host still answers 200 with an HTML page.
 * Every lead sent to such a URL was reported to the visitor as received and to
 * the operator as delivered, and vanished.
 *
 * Also pinned here, because both are load-bearing promises made in comments and
 * in the README, and a promise no test checks is just a comment:
 *
 *   · the remote response BODY is never read (a custom store endpoint could
 *     echo the lead back inside an error page, which would then reach the logs)
 *   · a genuine JSON or empty-bodied 2xx still succeeds — the HTML check must
 *     not have been implemented by rejecting everything
 *
 *   node --import ./tests/ts-resolve.mjs --experimental-strip-types \
 *        tests/regression/delivery-unit.mjs
 */
import { createServer } from "node:http";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

/* A stub "store" whose response is set per-test. */
let respond = { status: 200, type: "application/json", body: "{}" };

const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const payload = respond.body;
    res.writeHead(respond.status, {
      ...(respond.type ? { "Content-Type": respond.type } : {}),
      "Content-Length": Buffer.byteLength(payload),
    });
    res.end(payload);
  });
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

process.env.LEAD_STORE_URL = `http://127.0.0.1:${port}/collect`;
delete process.env.RESEND_API_KEY;

const { deliverLead } = await import("../../src/lib/delivery.ts");

const record = () => ({
  requestId: "r-delivery-unit",
  kind: "contact",
  receivedAt: "2026-08-14T00:00:00.000Z",
  fields: { name: "Delivery Probe", email: "probe@example.test", message: "hello" },
});

const deliver = async () => (await deliverLead(record())).find((r) => r.transport === "store");

console.log("\n=== R2-06 · a 2xx is not automatically a delivery ===");

/* ── The regression itself ─────────────────────────────────────────────── */
{
  respond = { status: 200, type: "text/html; charset=utf-8", body: "<html><body>Parked domain — buy this domain!</body></html>" };
  const r = await deliver();
  check("a 200 text/html response is NOT reported as a delivery",
    r.ok === false, JSON.stringify(r));
  check("it is categorised as 'not-a-store', not as a generic error",
    r.category === "not-a-store", String(r.category));
  check("the HTTP status is still reported for the operator", r.status === 200, String(r.status));
}
{
  respond = { status: 200, type: "application/xhtml+xml", body: "<html/>" };
  const r = await deliver();
  check("an XHTML response is rejected the same way", r.ok === false && r.category === "not-a-store");
}
{
  respond = { status: 201, type: "text/html", body: "<html>Captive portal login</html>" };
  const r = await deliver();
  check("a 201 HTML response is rejected too (not just 200)",
    r.ok === false && r.category === "not-a-store", JSON.stringify(r));
}
{
  // A charset parameter must not defeat the check.
  respond = { status: 200, type: "TEXT/HTML; charset=ISO-8859-1", body: "<html/>" };
  const r = await deliver();
  check("the check is case- and parameter-insensitive",
    r.ok === false && r.category === "not-a-store", JSON.stringify(r));
}

/* ── The fix must not have been "reject everything" ────────────────────── */
console.log("\n=== real store responses still succeed ===");
{
  respond = { status: 200, type: "application/json", body: '{"ok":true,"id":"abc"}' };
  const r = await deliver();
  check("a JSON 2xx is a delivery", r.ok === true && r.status === 200, JSON.stringify(r));
}
{
  respond = { status: 204, type: null, body: "" };
  const r = await deliver();
  check("a 204 with no content type is a delivery", r.ok === true, JSON.stringify(r));
}
{
  respond = { status: 200, type: "text/plain", body: "OK" };
  const r = await deliver();
  check("a text/plain 'OK' is a delivery (many webhooks answer this way)",
    r.ok === true, JSON.stringify(r));
}

/* ── Failures are still classified as before ───────────────────────────── */
console.log("\n=== failure classification is unchanged ===");
for (const [status, category] of [[401, "auth"], [403, "auth"], [429, "rate-limited"], [500, "remote-error"], [400, "rejected"]]) {
  respond = { status, type: "application/json", body: "{}" };
  const r = await deliver();
  check(`${status} is categorised '${category}'`, r.ok === false && r.category === category,
    `${r.category}`);
}

/* ── The response body must never be read ──────────────────────────────── */
console.log("\n=== the remote response body is never read ===");
{
  const MARKER = "SSN-123-45-6789-ECHOED-BY-THE-STORE";
  respond = { status: 500, type: "application/json", body: JSON.stringify({ error: MARKER }) };

  const logged = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  for (const level of ["log", "warn", "error"]) {
    console[level] = (...args) => { logged.push(args.map(String).join(" ")); };
  }
  const r = await deliver();
  Object.assign(console, original);

  check("a failing store response does not put the remote body in a result field",
    !JSON.stringify(r).includes(MARKER), JSON.stringify(r));
  check("a failing store response does not put the remote body in the logs",
    !logged.join("\n").includes(MARKER), logged.join(" | ").slice(0, 200));
  check("the result still carries the status and category the operator needs",
    r.status === 500 && r.category === "remote-error", JSON.stringify(r));
}

/* ── Transport errors ──────────────────────────────────────────────────── */
console.log("\n=== transport errors ===");
{
  process.env.LEAD_STORE_URL = "http://127.0.0.1:1/collect"; // nothing listening
  const r = await deliver();
  check("a refused connection is 'network', not a delivery",
    r.ok === false && r.category === "network", JSON.stringify(r));
}

server.close();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
