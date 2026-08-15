"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./primitives";

/**
 * The site's ONLY scroll motion: a 14px rise and fade, 260ms, once.
 *
 * No parallax, no counters, no carousels, no staggered cascades. If
 * prefers-reduced-motion is set, content renders immediately at rest —
 * handled in CSS so it is correct even before hydration.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // NOTE: there is deliberately no prefers-reduced-motion branch here. The
    // stylesheet already renders .reveal at rest with no transition under that
    // media query, regardless of data-visible, so it is correct even before
    // hydration. A JS branch would only duplicate it.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={cx("reveal", className)}
      data-visible={visible ? "true" : "false"}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
