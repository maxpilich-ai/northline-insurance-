import { isIP } from "node:net";

/**
 * ============================================================================
 * IP ADDRESS CLASSIFICATION — one rule, two callers
 * ============================================================================
 *
 * Round 4 raised the same underlying defect in two unrelated places:
 *
 *   R4-18  `request-identity.ts` stored `10.1.2.3`, `127.0.0.1` and
 *          `169.254.169.254` as consent evidence when TRUST_PROXY_HEADERS=1,
 *          because the only question asked was "is this a syntactically valid
 *          address?" (`net.isIP`). All three are valid. None of them
 *          identifies a member of the public.
 *
 *   R4-14  `delivery.ts` followed a store's `302 Location:
 *          http://169.254.169.254/…` and made an outbound request to the cloud
 *          metadata service, because the only question asked was "did fetch
 *          give me a response?".
 *
 * Both needed the same predicate: *is this address one a member of the public
 * on the internet could actually be using?* Written twice, the two copies
 * would drift — which is the defect class Round 4 found most of. So it is
 * written once, here, and both callers import it.
 *
 * WHAT "publicly routable" MEANS HERE. Not "reachable" — that depends on
 * routing tables this process cannot see. It means: not drawn from a range
 * that IANA has set aside for private use, loopback, link-local, multicast,
 * documentation, benchmarking or future use. Those are the ranges where an
 * address either identifies nobody in particular (so recording it as evidence
 * is a fiction) or identifies something inside our own perimeter (so sending a
 * lead to it is an SSRF).
 *
 * IPv4-in-IPv6 IS DECODED, NOT TRUSTED. `::ffff:127.0.0.1` and `::127.0.0.1`
 * are loopback wearing a costume, and treating them as "some IPv6 address we
 * do not recognise, therefore public" is the standard way this check is
 * bypassed. Any embedded IPv4 is extracted and classified as IPv4.
 */

export type IpClass =
  /** Not an IP address at all. */
  | "invalid"
  /** 0.0.0.0/8, :: — "this host", and on many stacks a synonym for loopback. */
  | "unspecified"
  /** 127.0.0.0/8, ::1 */
  | "loopback"
  /** RFC 1918 (10/8, 172.16/12, 192.168/16) and RFC 6598 CGNAT (100.64/10). */
  | "private"
  /** fc00::/7 — IPv6 unique local, the RFC 1918 equivalent. */
  | "unique-local"
  /** 169.254.0.0/16, fe80::/10 — but see "metadata" for the famous member. */
  | "link-local"
  /**
   * The cloud instance-metadata addresses. A subset of link-local, named
   * separately because it is the one an SSRF is usually aiming at and because
   * "blocked: link-local" is a less useful thing to read in an incident than
   * "blocked: metadata".
   */
  | "metadata"
  /** 224.0.0.0/4, ff00::/8 */
  | "multicast"
  /** Documentation, benchmarking, 6to4 relay, 240/4 future use, broadcast. */
  | "reserved"
  /** Everything else — an address a member of the public may hold. */
  | "public";

/** Human-readable reason, safe to put in a record or a log line. */
export const IP_CLASS_REASON: Record<IpClass, string> = {
  invalid: "not a valid IP address",
  unspecified: "the unspecified address, which identifies no host",
  loopback: "a loopback address, which identifies this machine",
  private: "a private-range address, which is not routable on the internet",
  "unique-local": "an IPv6 unique-local address, which is not routable on the internet",
  "link-local": "a link-local address, which is not routable beyond one network segment",
  metadata: "a cloud instance-metadata address",
  multicast: "a multicast address, which identifies no single host",
  reserved: "an address from a reserved range",
  public: "a publicly routable address",
};

/** Strips brackets and any zone index (`fe80::1%eth0`), then trims. */
function normalise(value: string): string {
  return value.trim().replace(/^\[/, "").replace(/\]$/, "").split("%")[0] ?? "";
}

function classifyV4(ip: string): IpClass {
  const o = ip.split(".").map(Number);
  const [a = 0, b = 0, c = 0, d = 0] = o;

  if (a === 0) return "unspecified";
  if (a === 127) return "loopback";
  if (a === 10) return "private";
  if (a === 172 && b >= 16 && b <= 31) return "private";
  if (a === 192 && b === 168) return "private";
  // RFC 6598 carrier-grade NAT. Shared between subscribers, so it identifies
  // no one person — and inside a CGNAT it addresses other subscribers' kit.
  if (a === 100 && b >= 64 && b <= 127) return "private";
  if (a === 169 && b === 254) {
    return c === 169 && d === 254 ? "metadata" : "link-local";
  }
  if (a >= 224 && a <= 239) return "multicast";
  // 192.0.0.0/24 IETF protocol assignments, 192.0.2.0/24 TEST-NET-1,
  // 198.51.100.0/24 TEST-NET-2, 203.0.113.0/24 TEST-NET-3, 198.18.0.0/15
  // benchmarking, 192.88.99.0/24 6to4 relay anycast (deprecated).
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return "reserved";
  if (a === 198 && c === 100 && b === 51) return "reserved";
  if (a === 203 && b === 0 && c === 113) return "reserved";
  if (a === 198 && (b === 18 || b === 19)) return "reserved";
  if (a === 192 && b === 88 && c === 99) return "reserved";
  // 240.0.0.0/4 reserved for future use, and 255.255.255.255 broadcast.
  if (a >= 240) return "reserved";

  return "public";
}

/** Expands any IPv6 address Node accepts into its eight 16-bit groups. */
function expandV6(ip: string): number[] | null {
  let head = ip;
  let embeddedV4: number[] | null = null;

  // A trailing dotted quad (::ffff:1.2.3.4) occupies the last two groups.
  const dotted = head.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted?.[1]) {
    const parts = dotted[1].split(".").map(Number);
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    embeddedV4 = parts;
    head = head.slice(0, -dotted[1].length);
    head = head.replace(/:$/, head.endsWith("::") ? ":" : "");
  }

  const wanted = 8 - (embeddedV4 ? 2 : 0);
  const [left, right, extra] = head.split("::");
  if (extra !== undefined) return null;

  const toGroups = (s: string | undefined) =>
    (s ?? "").split(":").filter((g) => g !== "").map((g) => parseInt(g, 16));

  const l = toGroups(left);
  const r = head.includes("::") ? toGroups(right) : [];
  if ([...l, ...r].some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null;

  let groups: number[];
  if (head.includes("::")) {
    const fill = wanted - l.length - r.length;
    if (fill < 0) return null;
    groups = [...l, ...Array<number>(fill).fill(0), ...r];
  } else {
    if (l.length !== wanted) return null;
    groups = l;
  }

  if (embeddedV4) {
    const [a = 0, b = 0, c = 0, d = 0] = embeddedV4;
    groups = [...groups, (a << 8) | b, (c << 8) | d];
  }
  return groups.length === 8 ? groups : null;
}

function classifyV6(ip: string): IpClass {
  const g = expandV6(ip);
  if (!g) return "invalid";

  const allZeroPrefix = g.slice(0, 5).every((n) => n === 0);

  // ::ffff:0:0/96 IPv4-mapped, and the deprecated ::/96 IPv4-compatible form.
  // Both address an IPv4 host; classify them as what they actually reach,
  // never as "an IPv6 address we do not recognise".
  if (allZeroPrefix && (g[5] === 0xffff || g[5] === 0)) {
    const lo = ((g[6] ?? 0) << 16) | (g[7] ?? 0);
    if (lo !== 0 && lo !== 1) {
      const v4 = [(lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff].join(".");
      return classifyV4(v4);
    }
  }

  // 64:ff9b::/96 and 64:ff9b:1::/48 — NAT64. The low 32 bits are an IPv4
  // address that a NAT64 gateway will translate to and connect to for us.
  if (g[0] === 0x64 && g[1] === 0xff9b) {
    const lo = ((g[6] ?? 0) << 16) | (g[7] ?? 0);
    const v4 = [(lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff].join(".");
    return classifyV4(v4);
  }

  if (g.every((n) => n === 0)) return "unspecified";
  if (allZeroPrefix && g[5] === 0 && g[6] === 0 && g[7] === 1) return "loopback";

  const first = g[0] ?? 0;
  // fd00:ec2::254 — the IPv6 instance-metadata address on AWS.
  if (first === 0xfd00 && g[1] === 0x0ec2) return "metadata";
  if ((first & 0xfe00) === 0xfc00) return "unique-local";
  if ((first & 0xffc0) === 0xfe80) return "link-local";
  if ((first & 0xff00) === 0xff00) return "multicast";
  // 2001:db8::/32 documentation, 100::/64 discard-only, 2002::/16 6to4.
  if (first === 0x2001 && g[1] === 0x0db8) return "reserved";
  if (first === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return "reserved";
  if (first === 0x2002) return "reserved";

  return "public";
}

/**
 * Classifies an address string. Accepts bracketed and zone-suffixed forms
 * because both turn up in headers and URLs.
 */
export function classifyIp(value: string): IpClass {
  const ip = normalise(value);
  if (!ip || ip.length > 45) return "invalid";
  const version = isIP(ip);
  if (version === 4) return classifyV4(ip);
  if (version === 6) return classifyV6(ip);
  return "invalid";
}

/**
 * The predicate both callers actually want.
 *
 * Deliberately a positive allow-list ("is it public?") rather than a
 * blocklist ("is it one of these bad ranges?"). A blocklist fails open on
 * anything it has not heard of — a new reserved range, a parsing quirk, an
 * encoding nobody anticipated. This fails closed: `classifyIp` returns
 * "public" only after the address has been fully parsed and matched nothing
 * else, so an unparseable input is not routable rather than not-blocked.
 */
export function isPubliclyRoutable(value: string): boolean {
  return classifyIp(value) === "public";
}
