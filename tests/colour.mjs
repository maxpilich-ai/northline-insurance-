/**
 * ============================================================================
 * COLOUR MATHS FOR CONTRAST ASSERTIONS — one implementation, one parser
 * ============================================================================
 *
 * WHY THIS FILE EXISTS. Two suites measure contrast in the browser, and both
 * had their own copy of "parse a computed colour". Both copies assumed the
 * computed value looks like `rgb(…)` or `rgba(…)`, which was true right up
 * until a colour was declared with `color-mix()`. Chromium computes
 * `color-mix(in srgb, …)` to `color(srgb 0.933333 0.921569 0.890196 / 0.6)` —
 * a valid CSS colour, in the 0-1 range, in a notation neither parser knew.
 *
 * The failure was not an exception. The naive parser pulled the first three
 * numbers out of the string and read 0.93, 0.92, 0.89 as 8-bit channels, i.e.
 * as very nearly black — and reported the site's lightest panel as a 1.12:1
 * contrast failure. Screenshotting that panel and sampling the actual pixels
 * gave background (242, 239, 232), text (26, 26, 23), 15.19:1. The page was
 * fine; the ruler was broken.
 *
 * A measuring tool that silently mis-reads its input is worse than no tool,
 * because its output is believed. So the parser lives once, here, it knows
 * every notation Chromium emits, and it THROWS on anything it does not
 * recognise rather than guessing — a new notation must fail loudly.
 *
 * Exported as source text because it has to run inside `page.evaluate`.
 */
export const COLOUR_HELPERS = String.raw`
  /**
   * Parses any colour Chromium can compute.
   *
   *   rgb(26, 26, 23)                                8-bit channels
   *   rgba(26, 26, 23, 0.6)                          8-bit + alpha
   *   color(srgb 0.1 0.1 0.09 / 0.6)                 0-1 channels, from color-mix()
   *   transparent / rgba(0, 0, 0, 0)                 alpha 0
   *
   * Returns {r, g, b, a} with r/g/b in 0-255. Throws on anything else.
   */
  function parseColour(input) {
    const s = String(input).trim();
    if (s === "transparent" || s === "") return { r: 0, g: 0, b: 0, a: 0 };

    const fn = s.match(/^color\(\s*srgb\s+([^)]+)\)$/i);
    if (fn) {
      const parts = fn[1].split("/");
      const rgb = parts[0].trim().split(/\s+/).map(Number);
      const a = parts.length > 1 ? Number(parts[1].trim()) : 1;
      if (rgb.length !== 3 || rgb.some(Number.isNaN) || Number.isNaN(a)) {
        throw new Error("unparseable color(srgb ...): " + s);
      }
      // 0-1 channels. Clamped because color-mix can produce values marginally
      // outside the range through rounding.
      return {
        r: Math.min(255, Math.max(0, rgb[0] * 255)),
        g: Math.min(255, Math.max(0, rgb[1] * 255)),
        b: Math.min(255, Math.max(0, rgb[2] * 255)),
        a,
      };
    }

    const legacy = s.match(/^rgba?\(([^)]+)\)$/i);
    if (legacy) {
      const n = legacy[1].split(/[,\/\s]+/).filter(Boolean).map(Number);
      if (n.length < 3 || n.slice(0, 3).some(Number.isNaN)) {
        throw new Error("unparseable rgb(): " + s);
      }
      return { r: n[0], g: n[1], b: n[2], a: n.length > 3 && !Number.isNaN(n[3]) ? n[3] : 1 };
    }

    throw new Error("unrecognised colour notation: " + s);
  }

  /** Composites a translucent colour over an opaque one. */
  function compositeOver(fg, bg) {
    return {
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    };
  }

  function relativeLuminance(c) {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function contrastRatio(a, b) {
    const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  /**
   * The colour actually painted behind an element, composited from the root
   * down. Walking DOWN rather than up matters: a translucent panel over a
   * coloured section is the common case, and taking the first non-transparent
   * ancestor would ignore everything the panel is sitting on.
   */
  function effectiveBackground(el) {
    const chain = [];
    for (let e = el; e; e = e.parentElement) chain.push(e);
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (const node of chain.reverse()) {
      const c = parseColour(getComputedStyle(node).backgroundColor);
      if (c.a === 0) continue;
      base = compositeOver(c, base);
    }
    return base;
  }
`;
