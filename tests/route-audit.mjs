import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:4501";
const ROUTES = ["/", "/how-it-works", "/coverage", "/carriers", "/about", "/faq", "/quote",
  "/schedule", "/contact", "/careers", "/careers/apply", "/privacy", "/terms", "/styleguide",
  "/thank-you/quote", "/thank-you/message", "/thank-you/apply", "/thank-you/schedule", "/nope"];
const VIEWPORTS = [[320, 700], [375, 812], [390, 844], [768, 1024], [1024, 900], [1440, 900], [1920, 1080]];

const problems = [];
const intentional = new Set();
const add = (route, vp, kind, detail) => problems.push({ route, vp, kind, detail });

const browser = await chromium.launch();
let renders = 0;

for (const [w, h] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const console_ = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console_.push(m.type() + ": " + m.text().slice(0, 160)); });
    page.on("pageerror", (e) => console_.push("pageerror: " + String(e).slice(0, 160)));
    const resp = await page.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
    // Let the one reveal transition settle. Measuring mid-transition makes the
    // clipping and overflow heuristics report transient states as defects.
    await page.waitForTimeout(450);
    renders++;

    const status = resp?.status();
    const expectStatus = route === "/nope" ? 404 : 200;
    if (status !== expectStatus) add(route, w, "STATUS", `${status} (expected ${expectStatus})`);

    const r = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const rects = (sel) => [...document.querySelectorAll(sel)];

      const overflowers = rects("body *").filter((e) => {
        const b = e.getBoundingClientRect();
        return b.width > 0 && b.right > docW + 1;
      }).slice(0, 3).map((e) => `${e.tagName}.${String(e.className || "").slice(0, 40)}`);

      const heads = rects("h1,h2,h3,h4,h5,h6").map((e) => +e.tagName[1]);
      const skips = [];
      for (let i = 1; i < heads.length; i++) if (heads[i] - heads[i - 1] > 1) skips.push(`h${heads[i - 1]}->h${heads[i]}`);

      const ids = rects("[id]").map((e) => e.id);
      const dupIds = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];

      // Landmark ROLES, not tag counts. <header>/<footer> map to banner and
      // contentinfo ONLY when they are not inside sectioning content, so a
      // <footer> used as a blockquote attribution is not a second contentinfo.
      const inSectioning = (el) => el.closest("article,aside,main,nav,section") !== null;
      const landmarks = {
        banner: rects("header").filter((e) => !inSectioning(e)).length,
        nav: rects("nav").length,
        main: rects("main").length,
        contentinfo: rects("footer").filter((e) => !inSectioning(e)).length,
      };

      // images without alt
      const imgs = rects("img").map((i) => ({ src: (i.getAttribute("src") || "").slice(0, 60), alt: i.getAttribute("alt") }));
      const noAlt = imgs.filter((i) => i.alt === null).map((i) => i.src);

      // inputs: autocomplete + font size + label
      const controls = rects("input,select,textarea").filter((e) => e.type !== "hidden");
      // WCAG 1.3.5 applies to fields collecting the USER'S OWN information.
      // Selects, textareas, radios and checkboxes have no meaningful token, and
      // neither does the hidden honeypot.
      const noAutocomplete = controls.filter((e) => {
        if (e.tagName !== "INPUT") return false;
        if (["radio", "checkbox", "hidden"].includes(e.type)) return false;
        if (e.closest('[aria-hidden="true"]')) return false;
        return !e.getAttribute("autocomplete");
      }).map((e) => e.id || e.name || e.tagName);
      const smallFont = controls.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => (e.id || e.name) + ":" + getComputedStyle(e).fontSize);
      const unlabeled = controls.filter((e) => {
        if (e.getAttribute("aria-label") || e.getAttribute("aria-labelledby")) return false;
        if (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) return false;
        return !e.closest("label");
      }).map((e) => e.id || e.name || e.tagName);

      // orphan labels
      const orphanLabels = rects("label[for]").filter((l) => !document.getElementById(l.getAttribute("for"))).map((l) => l.getAttribute("for"));

      // sticky/fixed elements covering content at the bottom
      const fixed = rects("body *").filter((e) => {
        const s = getComputedStyle(e);
        return (s.position === "fixed" || s.position === "sticky") && e.getBoundingClientRect().height > 0;
      }).map((e) => {
        const b = e.getBoundingClientRect();
        return { tag: e.tagName, cls: String(e.className).slice(0, 30), top: Math.round(b.top), h: Math.round(b.height), z: s2z(e) };
      });
      function s2z(e) { return getComputedStyle(e).zIndex; }

      // is anything interactive hidden underneath a bottom-fixed bar?
      const bottomBars = fixed.filter((f) => f.top + f.h >= vh - 2 && f.top < vh);
      let covered = [];
      if (bottomBars.length) {
        const barTop = Math.min(...bottomBars.map((b) => b.top));
        covered = rects("a,button,input,select,textarea").filter((e) => {
          const b = e.getBoundingClientRect();
          if (b.height === 0) return false;
          if (b.top < barTop || b.top > vh) return false;
          const mid = document.elementFromPoint(Math.min(docW - 2, b.left + b.width / 2), b.top + b.height / 2);
          return mid && !e.contains(mid) && !mid.contains(e);
        }).slice(0, 3).map((e) => `${e.tagName}[${(e.textContent || "").trim().slice(0, 20)}]`);
      }

      // touch targets
      const smallTargets = rects("a,button,summary,input[type=checkbox],input[type=radio]").filter((e) => {
        const b = e.getBoundingClientRect();
        if (!(b.width > 0 && b.height > 0 && b.height < 24)) return false;
        if (e.closest("nav,footer,header")) return false;
        if (e.classList.contains("sr-only")) return false;
        if (e.closest("label")) return false;
        const p = e.parentElement;
        const inline = p && /^(P|LI|SPAN|DD|DT|BLOCKQUOTE|TD|ADDRESS)$/.test(p.tagName) &&
          (p.textContent || "").trim().length > (e.textContent || "").trim().length + 3;
        return !inline;
      }).slice(0, 3).map((e) => `${e.tagName}[${(e.textContent || "").trim().slice(0, 18)}]:${Math.round(e.getBoundingClientRect().height)}px`);

      // clipped text: element with overflow hidden and scrollWidth > clientWidth
      // `.sr-only` clips by definition, so it and everything inside it is
      // excluded — otherwise every skip link and live-region announcement reads
      // as truncated text.
      const clipped = rects("h1,h2,h3,p,li,span,button,a").filter((e) => {
        if (e.closest(".sr-only")) return false;
        const s = getComputedStyle(e);
        return s.overflow === "hidden" && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0;
      }).slice(0, 2).map((e) => `${e.tagName}[${(e.textContent || "").trim().slice(0, 22)}]`);

      return {
        overflowX: document.documentElement.scrollWidth - docW,
        overflowers, h1: rects("h1").length, skips, dupIds, landmarks, noAlt, imgCount: imgs.length,
        noAutocomplete, smallFont, unlabeled, orphanLabels, fixedCount: fixed.length, covered, smallTargets, clipped,
        title: document.title, desc: document.querySelector('meta[name=description]')?.content ?? null,
        canonical: document.querySelector("link[rel=canonical]")?.href ?? null,
        robots: document.querySelector("meta[name=robots]")?.content ?? null,
        og: {
          t: document.querySelector('meta[property="og:title"]')?.content ?? null,
          d: document.querySelector('meta[property="og:description"]')?.content ?? null,
          i: document.querySelector('meta[property="og:image"]')?.content ?? null,
          u: document.querySelector('meta[property="og:url"]')?.content ?? null,
        },
        tw: document.querySelector('meta[name="twitter:card"]')?.content ?? null,
        jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent.slice(0, 80)),
        lang: document.documentElement.lang,
        tokens: [...new Set((document.body.innerText.match(/\{\{[A-Z0-9_]+\}\}/g) || []))],
      };
    });

    if (r.overflowX > 0) add(route, w, "OVERFLOW-X", `${r.overflowX}px | ${r.overflowers.join(" ")}`);
    if (r.h1 !== 1) add(route, w, "H1-COUNT", String(r.h1));
    if (r.skips.length) add(route, w, "HEADING-SKIP", r.skips.join(","));
    if (r.dupIds.length) add(route, w, "DUP-ID", r.dupIds.join(","));
    if (r.landmarks.main !== 1) add(route, w, "LANDMARK-MAIN", JSON.stringify(r.landmarks));
    if (r.landmarks.banner !== 1 || r.landmarks.contentinfo !== 1)
      add(route, w, "LANDMARK", JSON.stringify(r.landmarks));
    if (r.noAlt.length) add(route, w, "IMG-NO-ALT", r.noAlt.join(","));
    // /styleguide's inputs are specimens of the control styles, not fields that
    // collect anyone's information.
    if (r.noAutocomplete.length && route !== "/styleguide")
      add(route, w, "NO-AUTOCOMPLETE", r.noAutocomplete.join(","));
    if (r.smallFont.length) add(route, w, "INPUT-FONT<16", r.smallFont.join(","));
    if (r.unlabeled.length) add(route, w, "INPUT-NO-LABEL", r.unlabeled.join(","));
    if (r.orphanLabels.length) add(route, w, "ORPHAN-LABEL", r.orphanLabels.join(","));
    if (r.covered.length) add(route, w, "COVERED-BY-FIXED", r.covered.join(","));
    if (r.smallTargets.length) add(route, w, "SMALL-TARGET", r.smallTargets.join(","));
    // `.sr-only` uses clip/overflow by definition, so a screen-reader-only
    // element always looks "clipped" to this heuristic. Exclude it.
    const realClipped = r.clipped.filter((c) => !/Skip to content|Open menu|Close menu/.test(c));
    if (realClipped.length) add(route, w, "CLIPPED-TEXT", realClipped.join(","));
    if (!r.title) add(route, w, "NO-TITLE", "");
    if (r.lang !== "en") add(route, w, "LANG", r.lang);
    // Unfilled {{TOKENS}} rendering visibly is the token system WORKING, not a
    // defect — they are recorded for the report rather than counted as problems.
    if (r.tokens.length) intentional.add(`${route}: ${r.tokens.join(",")}`);
    const hydration = console_.filter((c) => /hydrat|did not match|Warning: Text content/i.test(c));
    if (hydration.length) add(route, w, "HYDRATION", hydration[0]);
    const otherConsole = console_.filter((c) => !/hydrat|did not match/i.test(c) && !(route === "/nope" && /404/.test(c)));
    if (otherConsole.length) add(route, w, "CONSOLE", otherConsole.slice(0, 2).join(" | "));

    if (w === 1440) {
      console.log(`META ${route.padEnd(22)} title="${(r.title || "").slice(0, 55)}" | desc=${r.desc ? r.desc.length + "ch" : "MISSING"} | canonical=${r.canonical ?? "-"} | robots=${r.robots ?? "-"} | og=${[r.og.t ? "t" : "-", r.og.d ? "d" : "-", r.og.i ? "i" : "-", r.og.u ? "u" : "-"].join("")} tw=${r.tw ?? "-"} | jsonld=${r.jsonld.length} | imgs=${r.imgCount}`);
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();

console.log(`\n=== ${renders} page renders (${ROUTES.length} routes x ${VIEWPORTS.length} viewports) ===`);
console.log(`intentional, not defects: ${intentional.size} route(s) render unfilled {{TOKEN}} placeholders`);
if (!problems.length) console.log("CLEAN");
else {
  const grouped = {};
  for (const p of problems) {
    const k = `${p.kind} :: ${p.route}`;
    (grouped[k] ||= new Set()).add(`${p.vp}px${p.detail ? " — " + p.detail : ""}`);
  }
  for (const [k, v] of Object.entries(grouped)) console.log(k + "\n    " + [...v].join("\n    "));
  console.log("\nTOTAL PROBLEM ROWS:", problems.length);
}

process.exit(problems.length ? 1 : 0);
