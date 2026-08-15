import type { Config } from "tailwindcss";

/**
 * DESIGN SYSTEM — single source of truth for scale.
 * Colour values live in globals.css as CSS custom properties so that the
 * styleguide can read and display them directly. Everything else is here.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        "paper-alt": "var(--paper-alt)",
        /* Translucent band — a real token, never `paper-alt/60`. See R4-09. */
        "paper-alt-wash": "var(--paper-alt-wash)",
        ink: "var(--ink)",
        "ink-deep": "var(--ink-deep)",
        /*
         * NOTE ON ALPHA MODIFIERS (finding R4-09).
         *
         * These are bare `var(--x)` values, not `rgb(var(--x) / <alpha-value>)`,
         * so Tailwind cannot apply an opacity modifier to them. Writing
         * `text-muted/60` does not produce 60% muted — it produces NOTHING, the
         * declaration is dropped, and whatever Preflight or the cascade supplies
         * wins instead. That is exactly how a `placeholder:text-muted/60` on the
         * styleguide rendered at 2.33:1 against a 4.5:1 requirement while the
         * real forms, which use the unmodified class, sat at 6.22:1.
         *
         * If a translucent variant is ever genuinely needed, add a real token
         * with its own measured contrast rather than reaching for `/NN`.
         * tests/regression/doc-consistency.mjs fails the build-time check if a
         * `/NN` modifier appears on one of these colours again.
         */
        muted: "var(--muted)",
        "muted-dark": "var(--muted-dark)",
        "on-dark": "var(--on-dark)",
        accent: "var(--accent)",
        /* Translucent accent, as real tokens — see the note above and R4-09. */
        "accent-rule": "var(--accent-rule)",
        "accent-wash": "var(--accent-wash)",
        "accent-hover": "var(--accent-hover)",
        "accent-light": "var(--accent-light)",
        "accent-light-rule": "var(--accent-light-rule)",
        rule: "var(--rule)",
        "rule-dark": "var(--rule-dark)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Iowan Old Style", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        // Fluid editorial scale. Min → max across the viewport range.
        eyebrow: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.14em" }],
        micro: ["0.75rem", { lineHeight: "1.5", letterSpacing: "0.02em" }],
        small: ["0.8125rem", { lineHeight: "1.6" }],
        base: ["0.9375rem", { lineHeight: "1.7" }],
        body: ["1.0625rem", { lineHeight: "1.7" }],
        "body-lg": ["clamp(1.125rem, 0.4vw + 1.05rem, 1.25rem)", { lineHeight: "1.65" }],
        h4: ["clamp(1.0625rem, 0.3vw + 1rem, 1.1875rem)", { lineHeight: "1.4", letterSpacing: "-0.005em" }],
        h3: ["clamp(1.3125rem, 0.9vw + 1.1rem, 1.75rem)", { lineHeight: "1.3", letterSpacing: "-0.012em" }],
        h2: ["clamp(1.875rem, 2.2vw + 1.3rem, 2.875rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        h1: ["clamp(2.375rem, 3.4vw + 1.5rem, 4rem)", { lineHeight: "1.06", letterSpacing: "-0.028em" }],
        display: ["clamp(2.75rem, 4.8vw + 1.5rem, 5.25rem)", { lineHeight: "1.02", letterSpacing: "-0.034em" }],
        numeral: ["clamp(3.5rem, 8vw + 1rem, 8rem)", { lineHeight: "0.9", letterSpacing: "-0.04em" }],
      },
      spacing: {
        gutter: "var(--gutter)",
        section: "clamp(4.5rem, 8vw, 9.5rem)",
        "section-sm": "clamp(3rem, 5vw, 5.5rem)",
      },
      maxWidth: {
        shell: "84.5rem", // 1352px outer shell
        content: "72rem",
        measure: "36rem", // ~68–72ch at body size
        "measure-tight": "31rem",
      },
      borderRadius: {
        DEFAULT: "2px",
        sm: "1px",
        md: "3px",
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
