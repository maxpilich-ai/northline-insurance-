/**
 * UNIT TESTS — lib/request-identity.ts
 *
 * Behind Next.js an `x-forwarded-for` header is always present, so the
 * `x-real-ip`, RFC 7239 `Forwarded` and "no header at all" branches cannot be
 * reached over HTTP. Finding R2-09 called that out: shipping parser code that
 * no test can exercise is false confidence. This exercises them directly.
 *
 *   node --experimental-strip-types tests/regression/identity-unit.mjs
 *
 * TRUST_PROXY_HEADERS is read at module load, so the trusted-proxy half is run
 * by re-invoking this file with the variable set (see the bottom of the file).
 */
const { identityFromHeaders, TRUST_PROXY_HEADERS } = await import(
  "../../src/lib/request-identity.ts"
);

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const id = (xff = null, realIp = null, forwarded = null) =>
  identityFromHeaders({ xff, realIp, forwarded });

console.log(`\n=== identity resolution (TRUST_PROXY_HEADERS=${TRUST_PROXY_HEADERS}) ===`);

/* Every shape must yield a usable counting key — this is the R2-02 property. */
{
  const shapes = [
    ["valid IPv4 in XFF", id("9.9.9.7")],
    ["valid IPv6 in XFF", id("2001:db8::1")],
    ["XFF chain", id("9.9.9.7, 10.0.0.1, 172.16.0.1")],
    ["malformed XFF", id("not-an-ip")],
    ["out-of-range IPv4", id("999.999.999.999")],
    ["malformed IPv6", id("2001:db8:::::1")],
    ["empty XFF", id("")],
    ["whitespace XFF", id("   ")],
    ["1000-char XFF", id("A".repeat(1000))],
    ["X-Real-IP only", id(null, "9.9.9.8")],
    ["Forwarded only", id(null, null, "for=9.9.9.9;proto=https")],
    ["Forwarded quoted IPv6", id(null, null, 'for="[2001:db8::2]";proto=https')],
    ["no headers at all", id()],
  ];
  check("every shape produces a non-empty counting key",
    shapes.every(([, r]) => typeof r.key === "string" && r.key.length > 0),
    shapes.filter(([, r]) => !r.key).map(([l]) => l).join(", "));
  check("every shape states a reason",
    shapes.every(([, r]) => typeof r.reason === "string" && r.reason.length > 10));
  for (const [label, r] of shapes) {
    console.log(`     ${label.padEnd(24)} trust=${r.trust.padEnd(12)} ip=${JSON.stringify(r.ip).padEnd(16)} key=${r.key.slice(0, 18)}…`);
  }
}

/* Distinct callers must get distinct keys; identical callers the same key. */
{
  check("different addresses produce different keys", id("9.9.9.1").key !== id("9.9.9.2").key);
  check("the same address produces the same key", id("9.9.9.1").key === id("9.9.9.1").key);
  check("different malformed values produce different keys", id("junk-a").key !== id("junk-b").key);
  check("the key does not contain the raw address",
    !id("9.9.9.1").key.includes("9.9.9.1"));
}

/* Only a request with NO forwarding header may be unattributed — the bucket
   with the larger allowance must not be selectable by a caller. */
{
  check("an empty header is 'observed', never 'unattributed'", id("").trust === "observed", id("").trust);
  check("a whitespace header is 'observed'", id("   ").trust === "observed", id("   ").trust);
  check("a malformed header is 'observed'", id("not-an-ip").trust === "observed");
  check("only a wholly absent header is 'unattributed'", id().trust === "unattributed");
  check("the empty-header bucket differs from the unattributed bucket",
    id("").key !== id().key, `${id("").key} vs ${id().key}`);
}

/* The IP is evidence only when the deployment vouches for the header. */
if (TRUST_PROXY_HEADERS) {
  check("a valid IP is recorded when the proxy is trusted", id("9.9.9.7").ip === "9.9.9.7");
  check("trust is reported as 'proxy'", id("9.9.9.7").trust === "proxy");
  check("a malformed value is still NOT recorded", id("not-an-ip").ip === null);
  /* Every non-address shape, not just the obvious one. An earlier validator
     checked only "hex digits and at least one colon", so `2001:db8:::::1` was
     recorded as the client's address under a trusted proxy — a string that is
     not an address, written into the field whose purpose is provability. */
  {
    const notAddresses = [
      "2001:db8:::::1", "999.999.999.999", "1.2.3", "1.2.3.4.5", "::gggg",
      "not-an-ip", "12345", "1.2.3.4:80", "-1.2.3.4", "A".repeat(1000),
    ];
    const recorded = notAddresses.filter((v) => id(v).ip !== null);
    check("no non-address value is ever recorded as an IP",
      recorded.length === 0,
      `recorded: ${recorded.map((v) => JSON.stringify(id(v).ip)).join(", ")}`);
    check("every non-address value is downgraded to 'observed'",
      notAddresses.every((v) => id(v).trust === "observed"),
      notAddresses.filter((v) => id(v).trust !== "observed").join(", "));
    /* Real addresses must still be recorded — the tightened validator must not
       have been tightened into rejecting everything.

       NARROWED BY R4-18. This list used to include `2001:db8::1` (documentation
       range), `::1` (loopback) and `fe80::1` (link-local), because at the time
       the only question was whether `net.isIP` accepted the string. All three
       are now correctly refused as consent evidence — they identify nobody —
       and `tests/regression/ip-classify-unit.mjs` asserts that refusal for
       every address class. What belongs here is the other half: addresses a
       member of the public really can hold must still be recorded, in both
       families, or the fix would have been a silent outage of the evidence
       field. */
    const addresses = ["9.9.9.7", "8.8.8.8", "1.1.1.1", "2606:4700::1111"];
    check("every publicly routable address is still recorded",
      addresses.every((v) => id(v).ip === v),
      addresses.filter((v) => id(v).ip !== v).join(", "));
  }
  check("X-Real-IP is honoured when XFF is absent", id(null, "9.9.9.8").ip === "9.9.9.8");
  check("Forwarded is honoured when the others are absent",
    id(null, null, "for=9.9.9.9;proto=https").ip === "9.9.9.9");
  /* Public address, not 2001:db8::2 — the documentation range is no longer
     recordable (R4-18), and this assertion is about bracket unwrapping. */
  check("bracketed IPv6 in Forwarded is unwrapped",
    id(null, null, 'for="[2606:4700::1111]"').ip === "2606:4700::1111",
    id(null, null, 'for="[2606:4700::1111]"').ip);
} else {
  check("no IP is ever recorded when the proxy is not trusted",
    [id("9.9.9.7"), id(null, "9.9.9.8"), id(null, null, "for=9.9.9.9")].every((r) => r.ip === null));
  check("trust is reported as 'observed', not 'proxy'", id("9.9.9.7").trust === "observed");
  check("the reason names the missing configuration",
    /TRUST_PROXY_HEADERS/.test(id("9.9.9.7").reason), id("9.9.9.7").reason);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
