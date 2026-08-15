import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { site } from "@/lib/site.config";
import { Hero } from "@/components/home/Hero";
import { IndependenceModule } from "@/components/home/IndependenceModule";
import { CarrierAccess } from "@/components/home/CarrierAccess";
import { CoverageOrientation } from "@/components/home/CoverageOrientation";
import { HowItWorks } from "@/components/home/HowItWorks";
import { OwnerNote } from "@/components/home/OwnerNote";
import { SocialProof } from "@/components/home/SocialProof";
import { Faq } from "@/components/home/Faq";
import { FinalCta } from "@/components/home/FinalCta";
import { FaqSchema, OrganisationSchema } from "@/lib/schema";
import { homepageFaq } from "@/lib/faq";

/**
 * The homepage needs its own canonical and Open Graph URL like every other
 * page — the root layout deliberately sets neither, so nothing inherits a
 * wrong one.
 */
export const metadata: Metadata = pageMeta({
  title: "Independent Brokerage",
  description: site.positioning,
  path: "/",
});

/**
 * HOMEPAGE — modules A–L of the approved architecture.
 *
 * A. Utility bar ────────── layout/Header
 * B. Header ─────────────── layout/Header
 * C. Hero ───────────────── Hero
 * D. Independence Module ── IndependenceModule   ← the core block
 * E. Carrier proof ──────── CarrierAccess        ← zero-permission render state
 * F. Coverage orientation ─ CoverageOrientation  ← questions, never products
 * G. How it works ───────── HowItWorks
 * H. Owner's note ───────── OwnerNote
 * I. Social proof ───────── SocialProof          ← flag-gated, renders null
 * J. FAQ ────────────────── Faq
 * K. Final CTA ──────────── FinalCta
 * L. Footer ─────────────── layout/Footer
 *
 * Tone rhythm: paper → dark → paper → alt → paper → alt → paper → dark → dark.
 */
export default function HomePage() {
  return (
    <>
      {/* Both emit nothing while the underlying facts are still tokens. */}
      <OrganisationSchema />
      <FaqSchema items={homepageFaq} />

      <Hero />
      <IndependenceModule />
      <CarrierAccess />
      <CoverageOrientation />
      <HowItWorks />
      <OwnerNote />
      <SocialProof />
      <Faq />
      <FinalCta />
    </>
  );
}
