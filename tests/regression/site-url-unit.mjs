/**
 * UNIT TESTS — lib/site-url-rules.mjs
 *
 * FINDING R3-M3. The guard asked only whether NEXT_PUBLIC_SITE_URL was *set*:
 *
 *     SITE_URL_IS_FALLBACK = !process.env.NEXT_PUBLIC_SITE_URL
 *
 * so `northline.example` — one missing protocol — produced IS_FALLBACK=false,
 * the R2-03 refusal never fired, and every consent record stored
 * `sourceUrl: "northline.example/quote"`. A string that resolves to nothing, in
 * the field whose only purpose is provability: exactly the defect R2-03 was
 * written to prevent, reachable by a typo.
 *
 * The two directions are equally important and both are asserted here:
 * nonsense must be rejected, and real deployment URLs must NOT be — a validator
 * that fails a legitimate sub-path or IP-literal deployment would be worse than
 * the bug.
 *
 *   node tests/regression/site-url-unit.mjs
 */
import { resolveSiteUrl, isLocalHostname } from "../../src/lib/site-url-rules.mjs";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const dev = (raw) => resolveSiteUrl(raw, { isProduction: false });
const prod = (raw) => resolveSiteUrl(raw, { isProduction: true });
const prodLocal = (raw) => resolveSiteUrl(raw, { isProduction: true, allowLocal: true });

console.log("\n=== accepted: things real deployments actually do ===");
{
  const good = [
    ["plain https", "https://northline.example", "https://northline.example"],
    ["plain http (TLS terminated upstream)", "http://northline.example", "http://northline.example"],
    ["trailing slash normalised", "https://northline.example/", "https://northline.example"],
    ["many trailing slashes", "https://northline.example///", "https://northline.example"],
    ["sub-path deploy", "https://northline.example/app", "https://northline.example/app"],
    ["sub-path with trailing slash", "https://northline.example/app/", "https://northline.example/app"],
    ["explicit port", "https://northline.example:8443", "https://northline.example:8443"],
    ["surrounding whitespace trimmed", "  https://northline.example  ", "https://northline.example"],
    ["punycode host", "https://xn--n3h.example", "https://xn--n3h.example"],
    ["deep subdomain", "https://www.quote.northline.example", "https://www.quote.northline.example"],
    ["uppercase scheme/host", "HTTPS://Northline.Example", "https://northline.example"],
    ["public IPv4 literal", "http://203.0.113.10:8080", "http://203.0.113.10:8080"],
  ];
  for (const [label, raw, expected] of good) {
    const r = prod(raw);
    check(`${label}`, r.status === "configured" && r.url === expected,
      `status=${r.status} url=${JSON.stringify(r.url)} reason=${r.reason}`);
  }
}

console.log("\n=== rejected as MISSING (absent means 'use the fallback') ===");
{
  for (const [label, raw] of [["undefined", undefined], ["null", null], ["empty string", ""], ["whitespace only", "   "]]) {
    const r = prod(raw);
    check(`${label} -> missing`, r.status === "missing", `status=${r.status}`);
  }
}

console.log("\n=== rejected as INVALID (present but unusable) ===");
{
  const bad = [
    ["no protocol — the R3-M3 case", "northline.example"],
    ["protocol-relative", "//northline.example"],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["file:", "file:///etc/passwd"],
    ["ftp:", "ftp://northline.example"],
    ["not a url at all", "!!! not a url !!!"],
    ["bare hostname label", "https://intranet"],
    ["embedded credentials", "https://user:pw@northline.example"],
    ["query string", "https://northline.example?utm=1"],
    ["fragment", "https://northline.example#top"],
    ["newline injected", "https://northline.example\nX-Evil: 1"],
    ["carriage return injected", "https://northline.example\r\nSet-Cookie: a=b"],
    ["tab injected", "https://northline.example\tfoo"],
  ];
  for (const [label, raw] of bad) {
    const r = prod(raw);
    check(`${label} -> invalid`, r.status === "invalid" && r.url === null,
      `status=${r.status} url=${JSON.stringify(r.url)}`);
  }
  check("every invalid result explains itself",
    bad.every(([, raw]) => (prod(raw).reason ?? "").length > 15),
    bad.filter(([, raw]) => (prod(raw).reason ?? "").length <= 15).map(([l]) => l).join(", "));
}

console.log("\n=== localhost: allowed in development, refused in an unopted production build ===");
{
  const locals = ["http://localhost:3000", "http://127.0.0.1:4801", "http://[::1]:3000", "http://0.0.0.0:3000", "https://app.localhost"];
  check("every local form is recognised as local",
    locals.every((u) => isLocalHostname(new URL(u).hostname)),
    locals.filter((u) => !isLocalHostname(new URL(u).hostname)).join(", "));
  check("development accepts localhost",
    locals.every((u) => dev(u).status === "configured"),
    locals.filter((u) => dev(u).status !== "configured").join(", "));
  check("PRODUCTION REFUSES localhost by default",
    locals.every((u) => prod(u).status === "invalid"),
    locals.filter((u) => prod(u).status !== "invalid").join(", "));
  check("production accepts localhost only with the explicit opt-in",
    locals.every((u) => prodLocal(u).status === "configured"),
    locals.filter((u) => prodLocal(u).status !== "configured").join(", "));
  check("the refusal names the opt-in so an operator can act",
    /ALLOW_LOCAL_SITE_URL/.test(prod("http://localhost:3000").reason),
    prod("http://localhost:3000").reason);
  // The opt-in must not be a skeleton key for genuinely broken values.
  check("the opt-in does NOT rescue an invalid value",
    prodLocal("northline.example").status === "invalid" &&
      prodLocal("javascript:alert(1)").status === "invalid");
}

console.log("\n=== the property that matters: nothing unusable is ever reported as usable ===");
{
  const everything = [
    undefined, null, "", "   ", "northline.example", "//x.example", "javascript:alert(1)",
    "data:text/html,x", "file:///etc/passwd", "ftp://x.example", "!!!", "https://intranet",
    "https://u:p@x.example", "https://x.example?a=1", "https://x.example#f",
    "https://x.example\nX: 1", "http://localhost:3000", "http://127.0.0.1:4801",
  ];
  const wronglyConfigured = everything.filter((v) => {
    const r = prod(v);
    if (r.status !== "configured") return false;
    // If it claims to be configured, the url must be a real absolute http(s) URL.
    try {
      const u = new URL(r.url);
      return !(u.protocol === "http:" || u.protocol === "https:");
    } catch {
      return true;
    }
  });
  check("no unusable value is ever reported 'configured'", wronglyConfigured.length === 0,
    JSON.stringify(wronglyConfigured));
  check("a 'configured' url is always re-parseable and absolute",
    ["https://northline.example", "https://northline.example/app/", "  http://203.0.113.9:8080  "]
      .every((v) => { const r = prod(v); return r.status === "configured" && new URL(r.url).protocol.startsWith("http"); }));
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
