/**
 * REGRESSION TESTS — invariants about the SOURCE, not the running server.
 *
 * Some defects are structural: they are not observable as behaviour today, but
 * they are the mechanism by which behaviour goes wrong later. Those get a test
 * that reads the tree.
 *
 * FINDING R2-07. `NEXT_PUBLIC_SITE_URL` was read directly in lib/schema.tsx as
 * well as in lib/site-url.ts, with a different fallback (`""` rather than
 * `http://localhost:3000`). Two readers of one build-time variable is how the
 * canonical URL, the sitemap and the JSON-LD came to disagree in the first
 * place — the whole reason lib/site-url.ts exists. Nothing observable was wrong
 * at the time, because demo mode emits no JSON-LD; the point is that the next
 * person to turn JSON-LD on would inherit the bug.
 *
 *   node tests/regression/source-invariants.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const ROOT = new URL("../../src", import.meta.url).pathname;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(ROOT).map((path) => ({
  path,
  rel: path.slice(ROOT.length + 1),
  text: readFileSync(path, "utf8"),
}));

/** Lines that are not comments — a mention in prose is not a second reader. */
const codeLines = (text) =>
  text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return t && !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
    });

console.log("\n=== R2-07 · one reader per build-time variable ===");
{
  const readers = files.filter((f) =>
    codeLines(f.text).some((l) => l.includes("process.env.NEXT_PUBLIC_SITE_URL"))
  );
  check("NEXT_PUBLIC_SITE_URL is read in exactly one module",
    readers.length === 1 && readers[0].rel === "lib/site-url.ts",
    readers.map((f) => f.rel).join(", ") || "no module reads it at all");

  // The single reader must still export the two things everything else uses,
  // or "one reader" was achieved by deleting the feature.
  const siteUrl = files.find((f) => f.rel === "lib/site-url.ts");
  check("that module still exports SITE_URL and SITE_URL_IS_FALLBACK",
    /export const SITE_URL\b/.test(siteUrl?.text ?? "") &&
      /export const SITE_URL_IS_FALLBACK\b/.test(siteUrl?.text ?? ""));

  const importers = files.filter((f) =>
    /from "[./@a-z-]*site-url"/.test(f.text) || /from "@\/lib\/site-url"/.test(f.text)
  );
  check("other modules obtain it by importing, and there are several",
    importers.length >= 3, `${importers.length} importer(s): ${importers.map((f) => f.rel).join(", ")}`);
}

console.log("\n=== the trust boundary is not re-crossed elsewhere ===");
{
  /* X-Forwarded-Host was the original H1 defect: comparing two attacker-
     controlled headers. Nothing may consult it again. */
  const offenders = files.filter((f) =>
    codeLines(f.text).some((l) => /x-forwarded-host/i.test(l))
  );
  check("no module reads x-forwarded-host", offenders.length === 0,
    offenders.map((f) => f.rel).join(", "));

  /* Forwarding headers may be turned into an identity in exactly one place. */
  const identityReaders = files.filter((f) =>
    codeLines(f.text).some((l) => /get\(\s*"x-forwarded-for"/i.test(l))
  );
  check("x-forwarded-for is read in exactly one module",
    identityReaders.length === 1 && identityReaders[0].rel === "lib/request-identity.ts",
    identityReaders.map((f) => f.rel).join(", "));
}

console.log("\n=== the store response body is never read ===");
{
  const delivery = files.find((f) => f.rel === "lib/delivery.ts");
  const lines = codeLines(delivery?.text ?? "");
  const reads = lines.filter((l) => /res\.(text|json)\(\)/.test(l));
  check("lib/delivery.ts never calls res.text() or res.json() on a remote response",
    reads.length === 0, reads.map((l) => l.trim()).join(" | "));
}

/* ══════════════════════════════════════════════════════════════════════════
   NO SERVER-ONLY SECRET NAME REACHES A CLIENT CHUNK (finding R6-13)
   ══════════════════════════════════════════════════════════════════════════

   Round 7 introduced this defect and its own security probe caught it. The
   R6-02 fix put a runtime-environment read into `lib/turnstile.ts` as a
   MODULE-SCOPE CONSTANT. That file is imported by a `"use client"` component,
   and a constant cannot be tree-shaken, so its initialiser was compiled into a
   browser chunk:

       !function(e=...env){e.NEXT_PUBLIC_TURNSTILE_SITE_KEY||e.TURNSTILE_SECRET_KEY}()

   The VALUE was never exposed — `process.env` is `{}` in the browser and Next
   inlines only `NEXT_PUBLIC_*` — but the name of a secret appeared in a client
   chunk for the first time in this project's history, and dead server-only
   logic shipped to every visitor. Measured: 0 chunks before, 1 after.

   This scans the BUILT client bundle rather than the source, because the
   property survives minification while the import graph that produced it does
   not. `npm test` builds before it runs, so `.next/static` is present.
   ══════════════════════════════════════════════════════════════════════════ */
{
  const { existsSync, readdirSync, readFileSync: rf, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const dir = ".next/static";
  if (!existsSync(dir)) {
    check("client bundle scan (skipped — no build present)", true);
  } else {
    const files = [];
    const walk = (d) => {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".js")) files.push(p);
      }
    };
    walk(dir);

    /** Names that must never appear in anything the browser downloads. */
    const FORBIDDEN = [
      "TURNSTILE_SECRET_KEY", "RESEND_API_KEY", "LEAD_STORE_TOKEN",
      "LEAD_STORE_URL", "LEAD_NOTIFY_EMAIL", "AGENT_LEAD_NOTIFY_EMAIL",
      "LEAD_FROM_EMAIL", "TRUST_PROXY_HEADERS",
    ];
    const hits = [];
    for (const f of files) {
      const text = rf(f, "utf8");
      for (const name of FORBIDDEN) if (text.includes(name)) hits.push(`${name} in ${f}`);
    }
    check(
      `no server-only environment name appears in ${files.length} client chunks`,
      hits.length === 0,
      hits.slice(0, 4).join(" | ")
    );
  }
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
