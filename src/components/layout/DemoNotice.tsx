import { flags } from "@/lib/site.config";
import { Container } from "@/components/ui/primitives";

/**
 * PERSISTENT DEMONSTRATION NOTICE.
 *
 * Sits above the utility bar on every page, so it reads as a wrapper around
 * the site rather than as part of it.
 *
 * The reason it exists: the prototype now carries a company name, an owner, an
 * address, a telephone number and a state of licensure. Those are convincing
 * enough to be mistaken for a real firm, and an insurance website implying
 * credentials it does not hold is not a design problem — it is a regulatory
 * one. The notice is the honest counterweight to how finished the rest looks.
 *
 * Deliberately styled OUT of the palette's calm register — a light band above
 * the dark chrome — so it reads as scaffolding, not decoration.
 *
 * LENGTH IS A MOBILE PROBLEM. This sits inside the sticky header, so every
 * pixel it occupies is a pixel permanently unavailable on a phone. The full
 * paragraph ran to three lines at 375px, which — with the header and the
 * bottom call bar — left about 41% of the viewport permanently consumed by
 * chrome. So the notice states the essential fact at every width and reveals
 * the full disclosure from `sm` upwards, where the space exists. Nothing is
 * hidden from anyone: the same disclosure is repeated in full in the footer's
 * licensing block on every page.
 */
export function DemoNotice() {
  if (!flags.demo) return null;

  return (
    <div className="border-b border-[var(--rule-strong)] bg-paper-alt">
      <Container>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-micro leading-relaxed text-muted sm:py-2.5">
          <span className="font-medium uppercase tracking-[0.14em] text-accent">
            Demonstration prototype
          </span>
          {/*
            THE FIRST SENTENCE IS NOT RESPONSIVE (finding R4-06).

            It used to carry `sm:hidden`, directly beneath a comment claiming
            "Always visible, at every width." The opposite was true: at 640px
            and above the only sentence stating the company is fictional was not
            rendered at all, and the banner degraded to an enumeration of which
            details are illustrative. Grepping all nineteen rendered routes at
            desktop width turned up no visible text anywhere saying the company
            does not exist — beside a real-looking name, telephone number and
            street address.

            It now renders at every width. The enumeration that follows is the
            part that may fold away on a narrow screen, because it is the
            elaboration; the claim itself is not.
          */}
          <span className="font-medium text-ink">Fictional company — not a real agency.</span>
          <span className="hidden sm:inline">
            Company name, owner, address, telephone and state of licensure are illustrative
            content for design review — not verified business information. No licence number,
            National Producer Number, credential or client outcome is represented here.
          </span>
        </p>
      </Container>
    </div>
  );
}
