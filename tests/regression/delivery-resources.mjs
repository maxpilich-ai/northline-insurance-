/**
 * REGRESSION TESTS — delivery transport RESOURCE behaviour.
 *
 * FINDING R3-M2. `deliverStore`/`deliverEmail` correctly never read the remote
 * response body, because an operator-configured endpoint could echo the
 * submitted lead back inside an error page. But not *reading* a body is not the
 * same as *disposing* of one: undici buffers an unconsumed body and keeps its
 * connection out of the pool, so the security rule as first implemented leaked
 * memory and sockets. Measured before the fix, 30 responses of 8 MB each:
 *
 *     body left unread   rss  58 -> 558 MB   sockets opened 48 / closed 27
 *     body cancelled     rss 558 -> 318 MB   sockets opened 33 / closed 52
 *
 * These assertions go through the REAL deliverLead(), not a reimplementation,
 * so they fail if `discardBody` is removed, reordered after an early return, or
 * quietly turned into a body read.
 *
 *   node --import ./tests/ts-resolve.mjs --experimental-strip-types \
 *        tests/regression/delivery-resources.mjs
 */
import { createServer } from "node:http";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const BIG = 8 * 1024 * 1024;
let mode = "json";
let opened = 0, closed = 0;

const server = createServer((req, res) => {
  req.on("data", () => {});
  req.on("end", () => {
    switch (mode) {
      case "big-ok":
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ pad: "x".repeat(BIG) }));
      case "big-error":
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "x".repeat(BIG) }));
      case "big-html":
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end("<html>" + "x".repeat(BIG) + "</html>");
      case "empty":
        res.writeHead(204);
        return res.end();
      default:
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end("{}");
    }
  });
});
server.on("connection", (s) => { opened++; s.on("close", () => closed++); });

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
process.env.LEAD_STORE_URL = `http://127.0.0.1:${port}/collect`;
delete process.env.RESEND_API_KEY;

const { deliverLead } = await import("../../src/lib/delivery.ts");

const record = () => ({
  requestId: "r-resources", kind: "contact", receivedAt: "2026-08-14T00:00:00.000Z",
  fields: { name: "Resource Probe", email: "probe@example.test", message: "hello" },
});
const deliver = async () => (await deliverLead(record())).find((r) => r.transport === "store");
const rssMB = () => Math.round(process.memoryUsage().rss / 1048576);

/* ── The behaviour still has to be right ────────────────────────────────── */
console.log("\n=== disposal did not change the delivery verdict ===");
{
  mode = "json";  check("a small JSON 2xx is still a delivery", (await deliver()).ok === true);
  mode = "empty"; check("a 204 with no body is still a delivery", (await deliver()).ok === true);
  mode = "big-ok";
  const r = await deliver();
  check("a LARGE JSON 2xx is still a delivery", r.ok === true && r.status === 200, JSON.stringify(r));
  mode = "big-html";
  const h = await deliver();
  check("a LARGE html 2xx is still 'not-a-store'", h.ok === false && h.category === "not-a-store", JSON.stringify(h));
  mode = "big-error";
  const e = await deliver();
  check("a LARGE 5xx is still 'remote-error'", e.ok === false && e.category === "remote-error", JSON.stringify(e));
}

/* ── Memory is not retained ─────────────────────────────────────────────── */
console.log("\n=== repeated large responses do not accumulate ===");
{
  // Warm up so the baseline is not measuring first-call allocation.
  mode = "big-ok";
  for (let i = 0; i < 3; i++) await deliver();
  await new Promise((r) => setTimeout(r, 500));

  const before = rssMB();
  const N = 30;
  for (let i = 0; i < N; i++) await deliver();
  await new Promise((r) => setTimeout(r, 1500));
  const after = rssMB();
  const grew = after - before;
  const payloadMB = (N * BIG) / 1048576;

  console.log(`     rss ${before} -> ${after} MB after ${N} x ${BIG / 1048576} MB responses (${payloadMB} MB of body)`);
  // Unreleased, this retained roughly the whole payload and then some. Half the
  // payload is a generous ceiling that still fails loudly on a regression.
  check(`RSS growth stays well under the ${payloadMB} MB of body received`,
    grew < payloadMB / 2, `grew ${grew} MB`);
}

/* ── Connections are released ───────────────────────────────────────────── */
console.log("\n=== sockets are released, not stranded ===");
{
  mode = "big-ok";
  const o0 = opened, c0 = closed;
  for (let i = 0; i < 20; i++) await deliver();
  await new Promise((r) => setTimeout(r, 2000));
  const newlyOpened = opened - o0;
  const newlyClosed = closed - c0;
  const stranded = newlyOpened - newlyClosed;
  console.log(`     sockets opened ${newlyOpened}, closed ${newlyClosed}, outstanding ${stranded}`);
  /* Measured: 0 outstanding with disposal, 5 with the disposal removed. A
     pooled keep-alive connection may legitimately still be open when this
     samples, so the bar is a small absolute number rather than zero — tight
     enough to catch a leak, loose enough not to be a coin flip. */
  check("at most a couple of sockets remain outstanding",
    stranded <= 2, `${stranded} outstanding after 20 deliveries`);
}

/* ── And the body still never reaches the process ───────────────────────── */
console.log("\n=== disposal is not a body READ in disguise ===");
{
  const MARKER = "POLICY-NUMBER-ECHOED-BACK-8891";
  mode = "marker";
  // A bespoke response carrying a marker in both body and a failing status.
  server.removeAllListeners("request");
  server.on("request", (req, res) => {
    req.on("data", () => {});
    req.on("end", () => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: MARKER, echoed: MARKER }));
    });
  });

  const logged = [];
  const original = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  for (const level of ["log", "warn", "error", "info"]) {
    console[level] = (...args) => logged.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  }
  const r = await deliver();
  Object.assign(console, original);

  check("the remote body does not appear in the delivery result",
    !JSON.stringify(r).includes(MARKER), JSON.stringify(r));
  check("the remote body does not appear in any log line",
    !logged.join("\n").includes(MARKER), logged.join(" | ").slice(0, 160));
  check("the status and category are still reported",
    r.status === 500 && r.category === "remote-error", JSON.stringify(r));
}

server.close();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
