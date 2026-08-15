import { isResolved, site } from "@/lib/site.config";
import { Container, Eyebrow, Section } from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { ProductionNote } from "@/components/ui/page";
import { Reveal } from "@/components/ui/Reveal";

/**
 * OWNER'S NOTE — and the second photography slot.
 *
 * Two plates, offset rather than stacked flush: the portrait leads, the office
 * sits below and inset. Together they answer the two questions a visitor
 * silently asks about a small brokerage — who is this, and is there a real
 * place behind it.
 *
 * Both are designed placeholders, never stock. A generic smiling-agent or
 * empty-boardroom photograph would be worse than an honest frame: it is the
 * single most recognisable tell of a template site.
 *
 * FRAMING: we know he OWNS the brokerage. We do NOT know that he founded it,
 * or that he previously worked captive. The prompt stays open-ended.
 */
export function OwnerNote() {
  const noteReady = isResolved(site.ownerNote);

  return (
    <Section tone="alt" id="owner">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* ── Photography pair ─────────────────────────────────────────── */}
          <div className="lg:col-span-6">
            <Reveal>
              <PhotoSlot
                label="The owner, in the office"
                brief="Environmental portrait, natural light, at his own desk. Not a studio headshot and not stock — the room is doing as much work as the face."
                ratio="4 / 5"
              />
            </Reveal>

            <Reveal delay={80}>
              <div className="mt-6 sm:ml-[18%]">
                <PhotoSlot
                  label="The office itself"
                  brief="A real interior, wide, shot on the same day as the portrait. Establishes that a physical place exists — which is exactly what a visitor is checking for."
                  ratio="16 / 10"
                />
              </div>
            </Reveal>
          </div>

          {/* ── The note ─────────────────────────────────────────────────── */}
          <Reveal delay={60} className="lg:col-span-5 lg:col-start-8 lg:self-center">
            <Eyebrow tone="accent">A note from the owner</Eyebrow>

            <blockquote className="mt-8">
              <p className="font-display text-h3 text-ink text-pretty">
                <Token value={site.ownerNote} />
              </p>
            </blockquote>

            {!noteReady && (
              <ProductionNote>
                Three or four sentences in his own words, first person, kept in his voice rather
                than tidied into marketing copy. Prompt him openly — what he wants people to
                understand about how he works — rather than steering him toward a particular story.
              </ProductionNote>
            )}

            <footer className="mt-10 border-t border-[var(--rule)] pt-7">
              <p className="font-display text-h4 text-ink">
                <Token value={site.ownerName} />
              </p>
              <p className="mt-1 text-small text-muted">
                <Token value={site.ownerTitle} />
              </p>
            </footer>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
