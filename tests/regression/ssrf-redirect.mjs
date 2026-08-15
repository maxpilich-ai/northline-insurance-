import { createServer } from "node:http";
import { once } from "node:events";
import {
  BlockedRequestError,
  assertRequestable,
  followRedirects,
  safeFetch,
} from "../../src/lib/safe-fetch.ts";
import { deliverLead } from "../../src/lib/delivery.ts";

/**
 * ============================================================================
 * REDIRECT-BASED SSRF, AND THE POST THAT USED TO BECOME A GET (R4-14)
 * ============================================================================
 *
 * The audit stood up a store that answered `302 Location:
 * http://169.254.169.254/latest/meta-data/` and observed this application make
 * the outbound request. Three properties are asserted here:
 *
 *   1. NO REDIRECT TARGET MAY BE NON-PUBLIC. Not the first, not the fourth.
 *      Every address class is tried, in both families, including the encodings
 *      used to smuggle a private address past a check like this.
 *
 *   2. THE CHAIN IS BOUNDED. Loops are detected as loops, long chains are cut,
 *      and a 3xx without a Location is an error rather than a silent success.
 *
 *   3. THE POST SURVIVES THE REDIRECT. `fetch`'s built-in following rewrites
 *      301/302/303 POSTs to GET, which would have delivered an empty request
 *      to a moved store and — if that answered 200 with JSON — reported the
 *      lead as delivered. Every redirect status re-issues the method and body.
 *
 * WHERE THE BOUNDARY IS. The configured URL is the operator's own choice and is
 * checked for scheme only — a store on 127.0.0.1 or 10.x is an ordinary
 * self-hosted deployment, and this suite's own collector is one. What the
 * operator does not choose is where that endpoint REDIRECTS, so hops 1+ must be
 * publicly routable. Both halves of that rule are asserted below: the private
 * destinations are refused as redirect targets, and the same addresses are
 * accepted as a configured URL, because breaking self-hosted installs would not
 * be a fix.
 *
 * Three levels, deliberately. The hop check is exercised as a pure function
 * against addresses no test server could ever bind. The redirect logic is
 * exercised against a REAL server emitting real 301/302/307/308 responses.
 * Finally `deliverLead` itself is pointed at a store that redirects to the
 * metadata address — the actual scenario in the finding, end to end, with
 * nothing substituted.
 */

let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failed = 1;
};

const blockOf = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err instanceof BlockedRequestError ? err.block : { reason: `threw ${err?.name}` };
  }
};

/* ══ 1. Every address class, as a destination ══════════════════════════ */

console.log("\n1 · hop validation by address class");

/** Stands in for an ordinary operator-configured store on the public internet. */
const PUBLIC_ORIGIN = new URL("https://store.example.com/intake");

const DESTINATIONS = [
  ["http://127.0.0.1/x", "loopback", "loopback IPv4"],
  ["http://127.0.0.1:9999/x", "loopback", "loopback with a port"],
  ["http://10.1.2.3/x", "private", "private IPv4 (RFC 1918)"],
  ["http://192.168.1.1/x", "private", "private IPv4"],
  ["http://172.16.5.5/x", "private", "private IPv4"],
  ["http://100.64.1.1/x", "private", "CGNAT"],
  ["http://169.254.1.1/x", "link-local", "link-local IPv4"],
  ["http://169.254.169.254/latest/meta-data/", "metadata", "THE metadata address"],
  ["http://[::1]/x", "loopback", "loopback IPv6"],
  ["http://[fd00::1]/x", "unique-local", "private IPv6 (ULA)"],
  ["http://[fe80::1]/x", "link-local", "link-local IPv6"],
  ["http://[fd00:ec2::254]/x", "metadata", "IPv6 metadata"],
  ["http://[::ffff:169.254.169.254]/x", "metadata", "IPv4-mapped metadata"],
  ["http://[::ffff:127.0.0.1]/x", "loopback", "IPv4-mapped loopback"],
  ["http://[64:ff9b::7f00:1]/x", "loopback", "NAT64-embedded loopback"],
  ["http://0.0.0.0/x", "unspecified", "the unspecified address"],
  ["http://255.255.255.255/x", "reserved", "broadcast"],
];

// As a REDIRECT TARGET (hop 1): every one must be refused.
for (const [url, wantClass, why] of DESTINATIONS) {
  const block = await blockOf(() => assertRequestable(new URL(url), 1, PUBLIC_ORIGIN));
  check(
    `redirect refused: ${why.padEnd(28)} ${url}`,
    block?.reason === "not-publicly-routable" && block?.ipClass === wantClass,
    block ? `reason=${block.reason} class=${block.ipClass}` : "NOT BLOCKED"
  );
}

// As the OPERATOR'S OWN URL (hop 0): every one must be allowed. A self-hosted
// store on a private address is a deployment, not an attack.
console.log("\n  the same addresses as a configured LEAD_STORE_URL (hop 0)");
{
  const wrongly = [];
  for (const [url] of DESTINATIONS) {
    if ((await blockOf(() => assertRequestable(new URL(url), 0))) !== null) wrongly.push(url);
  }
  check("a self-hosted store on a private address still works", wrongly.length === 0, wrongly.join(", "));
}

console.log("\n  and the addresses that must NOT be over-blocked, at any hop");
for (const url of ["http://8.8.8.8/x", "https://1.1.1.1/x", "http://[2606:4700::1111]/x"]) {
  const block = await blockOf(() => assertRequestable(new URL(url), 1, PUBLIC_ORIGIN));
  check(`allowed: ${url}`, block === null, block && JSON.stringify(block));
}

console.log("\n  non-HTTP schemes — refused at every hop, including hop 0");
for (const url of ["file:///etc/passwd", "gopher://8.8.8.8/x", "ftp://8.8.8.8/x", "data:text/plain,hi"]) {
  for (const hop of [0, 1]) {
    const block = await blockOf(() => assertRequestable(new URL(url), hop, PUBLIC_ORIGIN));
    check(`refused at hop ${hop}: ${url}`, block?.reason === "unsupported-scheme", block && JSON.stringify(block));
  }
}

console.log("\n  hostnames are resolved before they are trusted");
{
  const block = await blockOf(() => assertRequestable(new URL("http://localhost/x"), 1, PUBLIC_ORIGIN));
  check(
    "a redirect to a NAME resolving to loopback is refused, not just a literal",
    block?.reason === "not-publicly-routable",
    block ? JSON.stringify(block) : "NOT BLOCKED"
  );
}
{
  const block = await blockOf(() =>
    assertRequestable(new URL("http://this-name-does-not-exist.invalid/x"), 1, PUBLIC_ORIGIN)
  );
  check(
    "a redirect to an unresolvable name is refused (fails closed)",
    block?.reason === "unresolvable-host",
    block ? JSON.stringify(block) : "NOT BLOCKED"
  );
}
/**
 * THE SAME-ENDPOINT EXCEPTION, AND ITS EDGES.
 *
 * A store may redirect within itself — that is the http -> https upgrade every
 * internal service does. What it may not do is use that exception to reach a
 * DIFFERENT service. The Round 5 security recheck found exactly that hole in
 * the first version of this rule: matching on hostname alone let a store on
 * `127.0.0.1:8080` redirect to `127.0.0.1:22`, turning the one operator-chosen
 * URL into a port scanner of the machine the application runs on.
 */
console.log("\n  the same-endpoint exception, and its edges");
{
  const origin = new URL("http://10.0.0.5/intake");
  const cases = [
    ["http://10.0.0.5/moved", true, "same host, same port, different path"],
    ["https://10.0.0.5/intake", true, "the http -> https upgrade this exists for"],
    ["http://10.0.0.5:22/", false, "SAME HOST, DIFFERENT PORT — a different service"],
    ["http://10.0.0.5:6379/", false, "same host, Redis"],
    ["http://10.0.0.6/intake", false, "a neighbouring private host"],
    ["http://169.254.169.254/", false, "the metadata address"],
    ["http://127.0.0.1/intake", false, "loopback, from a private-LAN store"],
  ];
  for (const [target, allowed, why] of cases) {
    const block = await blockOf(() => assertRequestable(new URL(target), 1, origin));
    check(
      `${allowed ? "allowed" : "refused"}: ${target.padEnd(30)} (${why})`,
      allowed ? block === null : block?.reason === "not-publicly-routable",
      JSON.stringify(block)
    );
  }
}
{
  // A TLS downgrade must not ride in on the exception either.
  const block = await blockOf(() =>
    assertRequestable(new URL("http://10.0.0.5/intake"), 1, new URL("https://10.0.0.5/intake"))
  );
  check("refused: https -> http downgrade on the same host", block?.reason === "not-publicly-routable", JSON.stringify(block));
}

/* ══ 2. Redirect chains, against a real server ═════════════════════════ */

console.log("\n2 · redirect handling, against a real HTTP server");

/**
 * The permissive hop check used for this section only. It still records what
 * it was asked about, so the assertions below can prove the checker was
 * consulted on EVERY hop rather than only the first.
 */
const seenHops = [];
const permissive = async (url, hop) => {
  seenHops.push({ hop, href: url.href });
};

const received = [];
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    received.push({ path: req.url, method: req.method, body });
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const to = url.searchParams.get("to");

    if (url.pathname === "/r") {
      res.writeHead(Number(url.searchParams.get("code")), { location: to });
      res.end("redirecting");
    } else if (url.pathname === "/no-location") {
      res.writeHead(302);
      res.end();
    } else if (url.pathname === "/loop-a") {
      res.writeHead(302, { location: `http://127.0.0.1:${port}/loop-b` });
      res.end();
    } else if (url.pathname === "/loop-b") {
      res.writeHead(302, { location: `http://127.0.0.1:${port}/loop-a` });
      res.end();
    } else if (url.pathname === "/chain") {
      const n = Number(url.searchParams.get("n") ?? 0);
      res.writeHead(302, { location: `http://127.0.0.1:${port}/chain?n=${n + 1}` });
      res.end();
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true}');
    }
  });
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const post = (target, assertHop = permissive) =>
  followRedirects(target, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lead: "payload" }),
    signal: AbortSignal.timeout(5000),
  }, assertHop);

for (const code of [301, 302, 303, 307, 308]) {
  received.length = 0;
  const res = await post(`${base}/r?code=${code}&to=${encodeURIComponent(`${base}/final`)}`);
  const final = received.at(-1);
  check(
    `${code} → followed, and the POST body survives`,
    res.status === 200 && final?.method === "POST" && final?.body.includes("payload"),
    `status=${res.status} method=${final?.method} body=${JSON.stringify(final?.body)}`
  );
}

// The specific regression: fetch's own following would have made this a GET.
{
  received.length = 0;
  const res = await fetch(`${base}/r?code=301&to=${encodeURIComponent(`${base}/final`)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lead: "payload" }),
  });
  await res.body?.cancel();
  const final = received.at(-1);
  check(
    "CONTROL: plain fetch really does downgrade a 301 POST to GET",
    final?.method === "GET" && final?.body === "",
    `method=${final?.method} body=${JSON.stringify(final?.body)} — if this now says POST, the fix's justification changed`
  );
}

{
  const block = await blockOf(() => post(`${base}/loop-a`));
  check("a two-URL ping-pong is reported as a loop", block?.reason === "redirect-loop", JSON.stringify(block));
}
{
  received.length = 0;
  const block = await blockOf(() => post(`${base}/chain?n=0`));
  check("a long chain is cut", block?.reason === "too-many-redirects", JSON.stringify(block));
  /**
   * ...and cut SHORT. "Eventually stops" is not the property — a cap of 60
   * would satisfy that while making sixty outbound requests for one lead, which
   * is an amplifier pointed at whatever the chain leads to. Counted from the
   * server's side, so it measures requests actually made rather than a
   * constant in the source.
   */
  check(
    `the store saw ${received.length} request(s), not a long tail`,
    received.length <= 4,
    `${received.length} requests: ${received.map((r) => r.path).join(" -> ").slice(0, 160)}`
  );
}
{
  const block = await blockOf(() => post(`${base}/no-location`));
  check("a 3xx with no Location is an error, not a success", block?.reason === "redirect-without-location", JSON.stringify(block));
}

/* The property that matters most: the check runs on the TARGET, not only on
   the configured URL. A checker consulted once is not a checker. */
{
  seenHops.length = 0;
  await blockOf(() => post(`${base}/r?code=302&to=${encodeURIComponent("http://169.254.169.254/")}`, async (url, hop) => {
    seenHops.push({ hop, href: url.href });
    if (hop > 0) await assertRequestable(url, hop);
  }));
  check(
    "the hop check is consulted on the redirect TARGET",
    seenHops.length === 2 && seenHops[1].href.includes("169.254.169.254"),
    JSON.stringify(seenHops)
  );
}

/* And with the REAL check — nothing substituted — the metadata redirect is
   refused at hop 1, while the loopback store itself is reached normally. */
{
  const block = await blockOf(() =>
    safeFetch(`${base}/r?code=302&to=${encodeURIComponent("http://169.254.169.254/")}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
  );
  check(
    "safeFetch refuses the metadata redirect at hop 1",
    block?.reason === "not-publicly-routable" && block?.hop === 1 && block?.ipClass === "metadata",
    JSON.stringify(block)
  );
}
{
  const res = await safeFetch(`${base}/final`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  await res.body?.cancel();
  check("safeFetch still reaches a loopback store directly", res.status === 200, `status=${res.status}`);
}

/* ══ 3. deliverLead itself, against a redirecting store ════════════════ */

console.log("\n3 · delivery.ts end to end — the finding's exact scenario");

const record = {
  requestId: "ssrf-probe",
  kind: "contact",
  receivedAt: new Date().toISOString(),
  fields: { name: "SSRF Probe", message: "not a real lead" },
};

process.env.LEAD_STORE_URL = `${base}/r?code=302&to=${encodeURIComponent("http://169.254.169.254/latest/meta-data/")}`;
received.length = 0;
{
  const [result] = await deliverLead(record);
  check(
    "a store redirecting to the metadata address is a FAILURE, not a delivery",
    result?.ok === false && result?.category === "blocked-destination",
    JSON.stringify(result)
  );
  check(
    "the failure names the hop, and quotes nothing the remote sent",
    typeof result?.detail === "string" && /hop 1/.test(result.detail) && !/169\.254/.test(result.detail),
    JSON.stringify(result?.detail)
  );
}

process.env.LEAD_STORE_URL = `${base}/final`;
{
  const [result] = await deliverLead(record);
  check(
    "an ordinary loopback store still delivers",
    result?.ok === true && result?.transport === "store",
    JSON.stringify(result)
  );
}

process.env.LEAD_STORE_URL = `${base}/r?code=307&to=${encodeURIComponent(`${base}/moved`)}`;
received.length = 0;
{
  const [result] = await deliverLead(record);
  const final = received.at(-1);
  check(
    "a store that has MOVED still receives the record, as a POST with its body",
    result?.ok === true && final?.method === "POST" && final?.body.includes("ssrf-probe"),
    `${JSON.stringify(result)} method=${final?.method}`
  );
}

delete process.env.LEAD_STORE_URL;
server.close();

console.log("");
console.log(failed ? "SSRF REDIRECT: FAILURES" : "SSRF REDIRECT: all checks passed");
process.exit(failed);
