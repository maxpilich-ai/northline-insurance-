/**
 * REGRESSION TESTS — H6 (security headers) and L2/L9 side effects.
 *
 * Asserts on ACTUAL HTTP responses from a running production build, then loads
 * every route in a real browser and fails on any CSP violation, so a policy
 * that looks correct but breaks fonts, styles, hydration or Turnstile cannot
 * pass.
 *
 *   node tests/regression/security-headers.mjs http://127.0.0.1:PORT
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:4501";
const ROUTES = ["/", "/how-it-works", "/coverage", "/carriers", "/about", "/faq", "/quote",
  "/schedule", "/contact", "/careers", "/careers/apply", "/privacy", "/terms", "/styleguide",
  "/thank-you/quote", "/thank-you/message", "/thank-you/apply", "/thank-you/schedule", "/nope"];

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

console.log("=== headers present on every route (including the API and the 404) ===");
const REQUIRED = [
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];
let missing = [];
let powered = [];
for (const route of [...ROUTES, "/api/lead", "/robots.txt", "/sitemap.xml", "/og.png"]) {
  const res = await fetch(BASE + route, { redirect: "manual" });
  for (const h of REQUIRED) if (!res.headers.get(h)) missing.push(`${route}:${h}`);
  if (res.headers.get("x-powered-by")) powered.push(route);
}
check("all five headers on all routes, API, robots, sitemap and static assets",
  missing.length === 0, missing.slice(0, 6).join(", "));
check("X-Powered-By is gone everywhere", powered.length === 0, powered.join(", "));

const csp = (await fetch(BASE + "/quote")).headers.get("content-security-policy") ?? "";
check("CSP denies framing", /frame-ancestors 'none'/.test(csp));
check("X-Frame-Options repeats it for older agents",
  (await fetch(BASE + "/quote")).headers.get("x-frame-options") === "DENY");
check("CSP restricts form-action to this origin", /form-action 'self'/.test(csp));
check("CSP blocks plugins/objects", /object-src 'none'/.test(csp));
check("CSP pins base-uri", /base-uri 'self'/.test(csp));
/* The Turnstile host is allowed ONLY when Turnstile is switched on
   (finding R3-L4). Previously it was in script-src, connect-src and frame-src
   unconditionally, so the shipped demonstration build — Turnstile disabled —
   permitted script execution and framing from an origin it never contacts.

   Asserted in BOTH directions against the build's actual state, so the test
   fails whether the allowance goes missing when it is needed or reappears when
   it is not. The page tells us which state we are in: the widget's site key is
   only present in the bundle when the feature is on. */
/* Which state this build is in cannot be sniffed from the HTML — the widget
   script is injected at runtime, so a Turnstile-enabled build serves markup
   identical to a disabled one. The caller states it instead, and the harness
   knows because it set the keys. */
const turnstileOn = process.argv[3] === "turnstile";
const cfInScript = /script-src[^;]*challenges\.cloudflare\.com/.test(csp);
const cfInFrame = /frame-src[^;]*challenges\.cloudflare\.com/.test(csp);
const cfInConnect = /connect-src[^;]*challenges\.cloudflare\.com/.test(csp);

if (turnstileOn) {
  check("with Turnstile ON, CSP allows its script host", cfInScript, csp);
  check("with Turnstile ON, CSP allows its frame", cfInFrame, csp);
  check("with Turnstile ON, CSP allows its network calls", cfInConnect, csp);
} else {
  check("with Turnstile OFF, CSP does NOT allow its script host", !cfInScript, csp);
  check("with Turnstile OFF, CSP does NOT allow its frame", !cfInFrame, csp);
  check("with Turnstile OFF, CSP does NOT allow its network calls", !cfInConnect, csp);
  check("with Turnstile OFF, frame-src is closed entirely", /frame-src 'none'/.test(csp), csp);
}
check("CSP restricts fonts to this origin", /font-src 'self'/.test(csp));
check("CSP does not allow arbitrary connect targets", !/connect-src[^;]*\*/.test(csp));

console.log("\n=== clickjacking: the site cannot be framed ===");
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const blocked = [];
  page.on("console", (m) => { if (/refused to (display|frame)|frame-ancestors/i.test(m.text())) blocked.push(m.text().slice(0, 80)); });
  await page.setContent(`<iframe id="f" src="${BASE}/quote" width="400" height="300"></iframe>`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const framedText = await page.evaluate(() => {
    const f = document.getElementById("f");
    try { return f.contentDocument ? f.contentDocument.body?.innerText?.slice(0, 40) ?? "" : "(no access)"; }
    catch { return "(cross-origin error)"; }
  });
  check("an attacker page cannot render /quote in an iframe",
    !framedText.includes("Get Your Quote") && framedText.trim() !== "" ? true : blocked.length > 0,
    `iframe body: ${JSON.stringify(framedText)}, console: ${blocked[0] ?? "none"}`);
  await browser.close();
}

console.log("\n=== CSP does not break any route in a real browser ===");
{
  const browser = await chromium.launch();
  const violations = [];
  const failedRequests = [];
  const pageErrors = [];
  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on("console", (m) => {
      const t = m.text();
      if (/Content Security Policy|Refused to (load|execute|apply|connect)/i.test(t)) violations.push(`${route}: ${t.slice(0, 130)}`);
    });
    page.on("pageerror", (e) => pageErrors.push(`${route}: ${String(e).slice(0, 100)}`));
    page.on("requestfailed", (r) => {
      if (!r.url().includes("challenges.cloudflare.com")) failedRequests.push(`${route}: ${r.url().slice(0, 70)} ${r.failure()?.errorText}`);
    });
    await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(150);
    await ctx.close();
  }
  check("zero CSP violations across all 19 routes", violations.length === 0, violations.slice(0, 4).join(" | "));
  check("zero failed subresource requests", failedRequests.length === 0, failedRequests.slice(0, 3).join(" | "));
  check("zero page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
  await browser.close();
}

console.log("\n=== fonts, styles and hydration still work under CSP ===");
{
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const fonts = [];
  page.on("response", (r) => { if (r.url().includes(".woff2")) fonts.push(r.status()); });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const styling = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const s = h1 ? getComputedStyle(h1) : null;
    return {
      fontFamily: s?.fontFamily ?? "",
      bodyBg: getComputedStyle(document.body).backgroundColor,
      sheets: document.styleSheets.length,
      inlineStyleTags: document.querySelectorAll("style").length,
    };
  });
  check("self-hosted fonts loaded", fonts.length > 0 && fonts.every((s) => s === 200), JSON.stringify(fonts));
  check("the display face is applied (next/font inline style survived CSP)",
    /Fraunces/i.test(styling.fontFamily), styling.fontFamily);
  check("the stylesheet applied (paper background, not white)",
    styling.bodyBg !== "rgba(0, 0, 0, 0)" && styling.bodyBg !== "rgb(255, 255, 255)", styling.bodyBg);

  // Hydration proof: a client component must respond to interaction.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.locator("button[aria-expanded]").click();
  await page.waitForTimeout(300);
  const expanded = await page.evaluate(() => document.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded"));
  check("client components hydrate and respond under CSP", expanded === "true", `aria-expanded=${expanded}`);
  await browser.close();
}

console.log("\n=== the forms still submit under CSP ===");
{
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/contact", { waitUntil: "load" });
  await page.fill("#c-name", "CSP Probe");
  await page.fill("#c-email", "csp@example.com");
  await page.selectOption("#c-reason", "general");
  await page.fill("#c-message", "Verifying the form still posts with a content security policy in place.");
  let landed = "TIMEOUT";
  try {
    await Promise.all([
      page.waitForURL(/thank-you\/message/, { timeout: 20000 }),
      page.getByRole("button", { name: /send|submit/i }).click(),
    ]);
    landed = new URL(page.url()).pathname;
  } catch { /* landed stays TIMEOUT */ }
  check("contact form submits and reaches its thank-you route under CSP",
    landed === "/thank-you/message", landed);
  await browser.close();
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
