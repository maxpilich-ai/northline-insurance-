import { classifyIp, isPubliclyRoutable } from "../../src/lib/ip-classify.ts";
import { identityFromHeaders } from "../../src/lib/request-identity.ts";

/**
 * ============================================================================
 * IP CLASSIFICATION, AND CONSENT-EVIDENCE ATTRIBUTION (R4-18)
 * ============================================================================
 *
 * Two halves:
 *
 *   1. The classifier itself, against every range it has to know about and —
 *      more importantly — against the encodings that are used to sneak past
 *      checks like this one. `::ffff:127.0.0.1` is loopback. `64:ff9b::7f00:1`
 *      is loopback via NAT64. A classifier that calls either of those "public"
 *      is worse than no classifier, because it is trusted.
 *
 *   2. The consequence: under TRUST_PROXY_HEADERS=1, an address a member of
 *      the public cannot hold must not be written into `consent.ip`, and the
 *      request must still be counted. R4-18 was that `10.1.2.3`, `127.0.0.1`
 *      and `169.254.169.254` were all recorded as evidence.
 *
 * Run twice by the harness, with TRUST_PROXY_HEADERS on and off, because the
 * two configurations are meant to behave differently and only running one
 * proves nothing about the other.
 */

const TRUSTED = process.env.TRUST_PROXY_HEADERS === "1";

let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failed = 1;
};

console.log(`\n1 · classification (TRUST_PROXY_HEADERS=${TRUSTED ? "1" : "unset"})`);

/** Every case is [address, expected class, why it is in the list]. */
const CASES = [
  // ── the eight classes R4-18 named, IPv4 ────────────────────────────────
  ["8.8.8.8", "public", "an ordinary public address"],
  ["203.0.114.5", "public", "adjacent to TEST-NET-3, deliberately: off-by-one"],
  ["0.0.0.0", "unspecified", "the unspecified address"],
  ["127.0.0.1", "loopback", "loopback"],
  ["127.255.255.254", "loopback", "the far end of 127/8"],
  ["10.1.2.3", "private", "RFC 1918 — the exact address in the finding"],
  ["172.16.0.1", "private", "RFC 1918 lower bound"],
  ["172.31.255.255", "private", "RFC 1918 upper bound"],
  ["172.32.0.1", "public", "one past the RFC 1918 upper bound"],
  ["172.15.255.255", "public", "one before the RFC 1918 lower bound"],
  ["192.168.1.1", "private", "RFC 1918"],
  ["100.64.0.1", "private", "RFC 6598 CGNAT — shared, identifies nobody"],
  ["100.128.0.1", "public", "one past CGNAT"],
  ["169.254.1.1", "link-local", "link-local"],
  ["169.254.169.254", "metadata", "the cloud metadata address from the finding"],
  ["224.0.0.1", "multicast", "multicast"],
  ["240.0.0.1", "reserved", "reserved for future use"],
  ["255.255.255.255", "reserved", "broadcast"],
  ["192.0.2.5", "reserved", "TEST-NET-1"],
  ["198.51.100.5", "reserved", "TEST-NET-2"],
  ["203.0.113.5", "reserved", "TEST-NET-3"],
  ["198.18.0.1", "reserved", "benchmarking"],

  // ── IPv6 ───────────────────────────────────────────────────────────────
  ["2606:4700::1111", "public", "an ordinary public IPv6 address"],
  ["::1", "loopback", "IPv6 loopback"],
  ["::", "unspecified", "IPv6 unspecified"],
  ["fe80::1", "link-local", "IPv6 link-local"],
  ["fc00::1", "unique-local", "IPv6 ULA, low half"],
  ["fd00::1", "unique-local", "IPv6 ULA, high half"],
  ["fd00:ec2::254", "metadata", "the IPv6 instance-metadata address"],
  ["ff02::1", "multicast", "IPv6 multicast"],
  ["2001:db8::1", "reserved", "IPv6 documentation range"],
  ["2002:0102:0304::1", "reserved", "6to4"],

  // ── the bypasses ───────────────────────────────────────────────────────
  ["::ffff:127.0.0.1", "loopback", "IPv4-mapped loopback"],
  ["::ffff:10.0.0.1", "private", "IPv4-mapped RFC 1918"],
  ["::ffff:169.254.169.254", "metadata", "IPv4-mapped metadata"],
  ["::ffff:8.8.8.8", "public", "IPv4-mapped public — must NOT be over-blocked"],
  ["::127.0.0.1", "loopback", "deprecated IPv4-compatible loopback"],
  ["64:ff9b::7f00:1", "loopback", "NAT64-embedded loopback"],
  ["64:ff9b::0808:0808", "public", "NAT64-embedded public"],
  ["[::1]", "loopback", "bracketed, as it appears in a URL"],
  ["fe80::1%eth0", "link-local", "zone-suffixed, as it appears in a header"],
  ["  10.0.0.1  ", "private", "padded, as it appears in an X-Forwarded-For"],

  // ── not addresses at all ───────────────────────────────────────────────
  ["2001:db8:::::1", "invalid", "the string R2-x's hand-rolled regex accepted"],
  ["not-an-ip", "invalid", "obviously not an address"],
  ["", "invalid", "empty"],
  ["999.1.1.1", "invalid", "out of range"],
  ["0x7f.0.0.1", "invalid", "hex-octet encoding of loopback"],
  ["2130706433", "invalid", "decimal encoding of loopback"],
  ["127.1", "invalid", "short-form loopback"],
];

for (const [ip, want, why] of CASES) {
  const got = classifyIp(ip);
  check(`${JSON.stringify(ip).padEnd(26)} → ${want.padEnd(13)} (${why})`, got === want, `got ${got}`);
}

console.log("\n2 · isPubliclyRoutable agrees with classifyIp, and fails closed");
check(
  "only 'public' is routable",
  CASES.every(([ip, want]) => isPubliclyRoutable(ip) === (want === "public")),
  CASES.filter(([ip, want]) => isPubliclyRoutable(ip) !== (want === "public")).map(([ip]) => ip).join(", ")
);
/**
 * FAILS CLOSED. Anything the parser cannot fully account for must come back
 * NOT routable. A blocklist would return "not blocked" for these; this
 * allow-list returns "not public", which is the safe direction.
 */
for (const junk of ["  ", "", "\t", "localhost", "0x7f000001", "1.2.3.4.5", "::gg", "\u0000"]) {
  check(`garbage is not routable: ${JSON.stringify(junk)}`, !isPubliclyRoutable(junk));
}

/* ══ 3. The consequence for the consent record ══════════════════════════ */

console.log("\n3 · consent evidence attribution (R4-18)");

const id = (xff) => identityFromHeaders({ xff, realIp: null, forwarded: null });

/** The eight classes, as they would arrive in a forwarding header. */
const HEADER_CASES = [
  ["8.8.8.8", true, "public"],
  ["10.1.2.3", false, "private"],
  ["127.0.0.1", false, "loopback"],
  ["169.254.169.254", false, "metadata"],
  ["169.254.10.1", false, "link-local"],
  ["fd00::1", false, "unique-local"],
  ["::1", false, "IPv6 loopback"],
  ["::ffff:10.0.0.1", false, "IPv4-mapped private"],
  ["2606:4700::1111", true, "public IPv6"],
];

for (const [ip, recordable, label] of HEADER_CASES) {
  const r = id(ip);
  const shouldRecord = TRUSTED && recordable;

  check(
    `${label.padEnd(20)} ${ip.padEnd(22)} ip=${shouldRecord ? "recorded" : "null"} trust=${shouldRecord ? "proxy" : "observed"}`,
    r.ip === (shouldRecord ? ip : null) && r.trust === (shouldRecord ? "proxy" : "observed"),
    `got ip=${JSON.stringify(r.ip)} trust=${r.trust}`
  );

  // The half of the fix that is easy to lose: refusing to RECORD must never
  // mean refusing to COUNT. R2-02 was exactly that mistake in another field.
  check(`${label.padEnd(20)} is still counted`, typeof r.key === "string" && r.key.length > 0, r.key);

  // And the reason must say what happened, not be a generic shrug.
  check(
    `${label.padEnd(20)} carries a reason`,
    typeof r.reason === "string" && r.reason.length > 20,
    r.reason
  );
}

if (TRUSTED) {
  check(
    "a non-routable address never leaks into the record via `reason`",
    !id("10.1.2.3").reason.includes("10.1.2.3"),
    id("10.1.2.3").reason
  );
  check(
    "two different private addresses get different counting keys",
    id("10.1.2.3").key !== id("10.1.2.4").key
  );
}

console.log("");
console.log(failed ? "IP CLASSIFICATION: FAILURES" : "IP CLASSIFICATION: all checks passed");
process.exit(failed);
