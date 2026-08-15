"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isResolved, site } from "@/lib/site.config";
import {
  CONSUMER_CONSENT_TEXT,
  CONSUMER_CONSENT_VERSION,
  consentContractFor,
  fieldErrors,
  quoteLeadSchema,
} from "@/lib/leads";
import { ConsentText } from "./ConsentText";
import { Arrow, cx } from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { Turnstile, useTurnstileRetry, type TurnstileStatus } from "./Turnstile";
import { VerificationUnavailable } from "./VerificationUnavailable";
import { focusFirstError } from "./focusFirstError";
import { useHydrated } from "./useHydrated";
import {
  Checkbox,
  Field,
  FieldError,
  Input,
  OptionCards,
  RadioRow,
  Select,
  Textarea,
} from "./fields";

/**
 * THE PRIMARY CONVERSION.
 *
 * Five steps, one question group per screen, progress indicator, back
 * navigation, and state persisted against an accidental refresh.
 *
 * Naming: the CTA everywhere says "Get Your Quote" because that is what people
 * search for, but this page is headed "Request your personalised quote." and
 * the standfirst sets the expectation that a licensed person reviews it. (The
 * <title> is shorter — "Request a Quote" — so it does not truncate in a search
 * result; the heading is the one that does the expectation-setting.) Implying
 * an instant bindable quote would be both an advertising-compliance problem
 * and a disappointment problem.
 *
 * Validation uses the same zod schema as the API route — see lib/leads.ts.
 * The client copy is a convenience; the server copy is the one that counts.
 */

const STORAGE_KEY = "quote-draft-v1";

type Data = {
  situation: string | null;
  amount: string | null;
  age: string;
  sex: string | null;
  state: string;
  tobacco: string | null;
  health: string | null;
  name: string;
  email: string;
  phone: string;
  contactTime: string;
  notes: string;
  consent: boolean;
  company: string; // honeypot
};

const EMPTY: Data = {
  situation: null,
  amount: null,
  age: "",
  sex: null,
  state: "",
  tobacco: null,
  health: null,
  name: "",
  email: "",
  phone: "",
  contactTime: "any",
  notes: "",
  consent: false,
  company: "",
};

const STEPS = [
  { title: "What brings you here", fields: ["situation"] },
  { title: "How much coverage", fields: ["amount"] },
  { title: "About you", fields: ["age", "sex", "state", "tobacco"] },
  { title: "Your health, broadly", fields: ["health"] },
  { title: "How to reach you", fields: ["name", "email", "phone", "contactTime", "consent"] },
] as const;

export function QuoteForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Finding R2-05: an unhydrated form must not fall back to a native GET.
  const hydrated = useHydrated();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  /**
   * Whether the spam check is usable in THIS browser (finding R3-H3). When
   * it is not, the form says so up front and offers a route that works,
   * instead of letting the visitor fill everything in and hit a 403 they can
   * never get past.
   */
  const [verification, setVerification] = useState<TurnstileStatus>("pending");
  const { key: turnstileKey, retry: retryTurnstile } = useTurnstileRetry();
  const verificationBlocked = verification === "unavailable";
  const headingRef = useRef<HTMLHeadingElement>(null);

  const statesKnown = isResolved(site.licenseStates);

  /**
   * Restore an interrupted draft. A refresh mid-form should not cost someone
   * four screens of work — that is a common and entirely avoidable drop-off.
   *
   * WHY THE RULE IS DISABLED HERE. react-hooks/set-state-in-effect is right
   * almost everywhere: a synchronous setState in an effect body causes a second
   * render pass. The two alternatives it suggests are both wrong for this case.
   * A lazy useState initialiser cannot read sessionStorage, because this
   * component is server-rendered first and the server would produce step 1 while
   * the client produced step 4 — a hydration mismatch, which is a worse defect
   * than one extra render. Restoring from an event handler is not possible
   * either; there is no event, only "the component mounted". A post-mount
   * restore is the correct shape, and it runs once per mount.
   */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: Data; step: number };
        if (parsed?.data) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe restore; see above
          setData({ ...EMPTY, ...parsed.data, consent: false });
          setStep(Math.min(parsed.step ?? 0, STEPS.length - 1));
          setRestored(true);
        }
      }
    } catch {
      /* corrupt draft — start clean rather than fail */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ data, step }));
    } catch {
      /* storage unavailable (private mode) — the form still works */
    }
  }, [data, step]);

  /* Move focus to the new step heading so keyboard and screen-reader users are
     not left at the bottom of the page after pressing Continue. */
  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  const set = <K extends keyof Data>(key: K, value: Data[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  };

  /**
   * The payload carries no timestamp and no source URL: the server stamps both
   * from information it can verify. The consent version and text are echoed so
   * the server can confirm this form displayed the contract it expects, and
   * reject the submission if not.
   */
  const buildPayload = () => ({
    kind: "quote" as const,
    ...data,
    consentVersion: CONSUMER_CONSENT_VERSION,
    consentText: CONSUMER_CONSENT_TEXT,
    turnstileToken,
  });

  const validateStep = (index: number) => {
    const result = quoteLeadSchema.safeParse(buildPayload());
    if (result.success) return true;
    const all = fieldErrors(result.error);
    const stepFields = STEPS[index].fields as readonly string[];
    const relevant: Record<string, string> = {};
    for (const f of stepFields) if (all[f]) relevant[f] = all[f];
    setErrors(relevant);
    // Wizard steps validate one screen at a time, so the first error on THIS
    // step is the one to send focus to.
    focusFirstError(relevant, stepFields as unknown as string[], "");
    return Object.keys(relevant).length === 0;
  };

  /* ── Browser history ────────────────────────────────────────────────────
     THE WIZARD IS IN THE HISTORY STACK (finding R3-M8).

     Every step used to render at the same URL with no history entry of its own.
     Pressing Back on step 4 therefore did not go to step 3 — it left the page
     entirely and took every answer with it. On a phone that is not a deliberate
     act: edge-swipe-back is the ordinary way people navigate, and it silently
     destroyed a half-finished quote on the site's primary conversion form.

     Each step now pushes an entry carrying its index, and popstate puts the
     wizard back on whichever step the browser returned to. Next.js supports the
     native history methods for exactly this — see the "linking and navigating"
     guide in the installed Next docs — so this cooperates with the router
     rather than fighting it.

     The submit path uses router.replace (finding R3-M7), so the confirmation
     page replaces the final step rather than stacking on top of it, and Back
     from the thank-you page does not return to a filled-in form.
     ------------------------------------------------------------------- */

  /** Keeps the URL honest about which step is on screen. */
  const stepUrl = (index: number) => (index === 0 ? window.location.pathname : `?step=${index + 1}`);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const state = event.state as { quoteStep?: number } | null;
      const target = typeof state?.quoteStep === "number" ? state.quoteStep : 0;
      setErrors({});
      setStep(Math.max(0, Math.min(target, STEPS.length - 1)));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const next = () => {
    if (!validateStep(step)) return;
    const target = Math.min(step + 1, STEPS.length - 1);
    if (target !== step) {
      window.history.pushState({ quoteStep: target }, "", stepUrl(target));
    }
    setStep(target);
  };

  const back = () => {
    setErrors({});
    // Let the browser do it, so the in-page control and the browser control
    // move through exactly the same history rather than drifting apart.
    if (step > 0 && (window.history.state as { quoteStep?: number } | null)?.quoteStep === step) {
      window.history.back();
      return;
    }
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    /*
      SUBMISSION IS ONLY MEANINGFUL ON THE LAST STEP (finding R4-01).

      Two different things used to be able to fire this handler from an earlier
      step, and both produced the same ugly result — a full-form validation
      sweep that painted four fields red and announced four errors for questions
      the visitor had not been asked yet:

        · The Continue and Send controls were rendered by a ternary at the same
          position in the tree with no key, so React reconciled them into ONE
          DOM node and mutated `type="button"` into `type="submit"` in place.
          The activation event that triggered `next()` was still propagating,
          met a node that had just become a submit button, and submitted the
          form. Distinct keys below stop that.

        · Pressing Enter in any text field triggers the browser's implicit
          submission, which does not care which step is on screen.

      Keys fix the first. This guard fixes the whole class: a submission that
      did not come from the last step is not a submission, so it is discarded
      before it can touch validation state. Cheap, and it does not depend on
      anyone remembering why the keys are there.
    */
    if (step !== STEPS.length - 1) return;

    if (!validateStep(STEPS.length - 1)) return;

    const payload = buildPayload();
    const result = quoteLeadSchema.safeParse(payload);
    if (!result.success) {
      const found = fieldErrors(result.error);
      setErrors(found);
      focusFirstError(
        found,
        ["situation", "amount", "age", "sex", "state", "tobacco", "health",
          "name", "email", "phone", "contactTime", "notes", "consent"],
        ""
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      if (!res.ok) throw new Error(String(res.status));
      sessionStorage.removeItem(STORAGE_KEY);
      /*
        replace(), not push() (finding R3-M7).

        With push(), the confirmation page was a new history entry and the form
        stayed behind it. Pressing Back returned the visitor to a blank, fully
        re-armed form with every field cleared and the button enabled again, and
        nothing on screen saying their message had already been sent. The
        natural reading is "that did not work" and the natural response is to
        fill it in and send it a second time — the duplicate-lead path that
        matters most, because it is the one ordinary people walk down.
      */
      router.replace("/thank-you/quote");
    } catch {
      setSubmitError(
        "We could not send that just now. Please try again, or call the office directly rather than leave the enquiry unsent."
      );
      setSubmitting(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="border border-[var(--rule)] bg-paper p-6 sm:p-9 md:p-11"
    >
      {/* ── Progress ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-eyebrow font-medium uppercase tracking-[0.14em] text-accent">
            Step <span className="tabular-nums">{step + 1}</span> of{" "}
            <span className="tabular-nums">{STEPS.length}</span>
          </p>
          <p className="text-micro uppercase tracking-[0.08em] text-muted">
            {STEPS[step].title}
          </p>
        </div>
        <div
          className="mt-4 h-px w-full bg-[var(--rule)]"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label="Form progress"
        >
          <div
            className="h-px bg-accent transition-[width] duration-300 ease-editorial"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {restored && step > 0 && (
        <p className="mt-6 border-l-2 border-accent-rule pl-4 text-small text-muted">
          We kept what you had already filled in.
        </p>
      )}

      {/* Announce step changes for assistive technology. */}
      <p aria-live="polite" className="sr-only">
        Step {step + 1} of {STEPS.length}: {STEPS[step].title}
      </p>

      <div className="mt-9">
        <h2
          ref={headingRef}
          id="wizard-step-heading"
          tabIndex={-1}
          className="font-display text-h3 text-ink outline-none text-balance"
        >
          {step === 0 && "What brings you here?"}
          {step === 1 && "Roughly how much coverage do you have in mind?"}
          {step === 2 && "A few basics."}
          {step === 3 && "How would you describe your health?"}
          {step === 4 && "Where should we send it?"}
        </h2>

        {/* ── Step 1 · Situation ─────────────────────────────────────── */}
        {step === 0 && (
          <div className="mt-8">
            <p className="mb-6 max-w-measure text-base text-muted">
              Pick the closest match. If none of them fit, the last option is a perfectly good
              answer — most people do not arrive knowing.
            </p>
            <OptionCards
              labelledBy="wizard-step-heading"
              name="situation"
              invalid={!!errors.situation}
              describedBy="situation-error"
              value={data.situation}
              onChange={(v) => set("situation", v)}
              options={[
                {
                  value: "family",
                  label: "People depend on my income",
                  description: "A partner, children, or anyone who would struggle without it.",
                },
                {
                  value: "mortgage",
                  label: "I want a mortgage or debt covered",
                  description: "So a specific obligation would not fall to someone else.",
                },
                {
                  value: "final-wishes",
                  label: "I want final costs taken care of",
                  description: "So the arrangements are not left to family to fund.",
                },
                {
                  value: "review-existing",
                  label: "I already have a policy and want it reviewed",
                  description: "Including coverage through an employer.",
                },
                {
                  value: "declined-before",
                  label: "I have been declined or rated before",
                  description: "This is the situation where working across carriers matters most.",
                },
                {
                  value: "not-sure",
                  label: "I am not sure yet",
                  description: "Genuinely fine. Working that out is part of the conversation.",
                },
              ]}
            />
            {errors.situation && <FieldError id="situation-error">{errors.situation}</FieldError>}
          </div>
        )}

        {/* ── Step 2 · Amount ────────────────────────────────────────── */}
        {step === 1 && (
          <div className="mt-8">
            <p className="mb-6 max-w-measure text-base text-muted">
              An approximate range is enough — we will work out a figure properly with you. If you
              have no idea, say so and we will start from the arithmetic instead.
            </p>
            <OptionCards
              labelledBy="wizard-step-heading"
              name="amount"
              invalid={!!errors.amount}
              describedBy="amount-error"
              columns={2}
              value={data.amount}
              onChange={(v) => set("amount", v)}
              options={[
                { value: "under-250k", label: "Under $250,000" },
                { value: "250k-500k", label: "$250,000 – $500,000" },
                { value: "500k-1m", label: "$500,000 – $1 million" },
                { value: "1m-2m", label: "$1 million – $2 million" },
                { value: "over-2m", label: "Over $2 million" },
                {
                  value: "not-sure",
                  label: "I do not know yet",
                  description: "We will work it out from your circumstances.",
                },
              ]}
            />
            {errors.amount && <FieldError id="amount-error">{errors.amount}</FieldError>}
          </div>
        )}

        {/* ── Step 3 · About you ─────────────────────────────────────── */}
        {step === 2 && (
          <div className="mt-8 space-y-8">
            <p className="max-w-measure text-base text-muted">
              These four facts are what actually drive an initial comparison. Nothing else is
              needed at this stage.
            </p>

            <div className="grid gap-8 sm:grid-cols-2">
              <Field label="Age" htmlFor="age" error={errors.age}>
                <Input
                  id="age"
                  name="age"
                  inputMode="numeric"
                  autoComplete="off"
                  value={data.age}
                  invalid={!!errors.age}
                  aria-describedby={errors.age ? "age-error" : undefined}
                  onChange={(e) => set("age", e.target.value)}
                  placeholder="e.g. 42"
                />
              </Field>

              <Field label="Sex as listed on your application" htmlFor="sex" error={errors.sex} group>
                <RadioRow
                  labelledBy="sex-label"
                  name="sex"
                  invalid={!!errors.sex}
                  describedBy="sex-error"
                  value={data.sex}
                  onChange={(v) => set("sex", v)}
                  options={[
                    { value: "female", label: "Female" },
                    { value: "male", label: "Male" },
                  ]}
                />
              </Field>
            </div>

            <Field
              label="State of residence"
              htmlFor="state"
              error={errors.state}
              hint={
                statesKnown ? undefined : (
                  <>
                    Once the licensed-states list is supplied this becomes a menu restricted to{" "}
                    <Token value={site.licenseStates} /> — the form will not be able to offer a
                    state we are not licensed in.
                  </>
                )
              }
            >
              {statesKnown ? (
                <Select
                  id="state"
                  name="state"
                  value={data.state}
                  invalid={!!errors.state}
                  aria-describedby={errors.state ? "state-error" : undefined}
                  onChange={(e) => set("state", e.target.value)}
                >
                  <option value="">Select your state</option>
                  {site.licenseStates.split(/,\s*/).map((s) => (
                    <option key={s} value={s.trim()}>
                      {s.trim()}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="state"
                  name="state"
                  autoComplete="address-level1"
                  value={data.state}
                  invalid={!!errors.state}
                  aria-describedby={
                    errors.state ? "state-error state-hint" : "state-hint"
                  }
                  onChange={(e) => set("state", e.target.value)}
                  placeholder="Your state"
                />
              )}
            </Field>

            <Field label="Do you use tobacco or nicotine?" htmlFor="tobacco" error={errors.tobacco} group>
              <RadioRow
                labelledBy="tobacco-label"
                name="tobacco"
                invalid={!!errors.tobacco}
                describedBy="tobacco-error"
                value={data.tobacco}
                onChange={(v) => set("tobacco", v)}
                options={[
                  { value: "no", label: "No" },
                  { value: "yes", label: "Yes" },
                  { value: "not-sure", label: "Not sure how it counts" },
                ]}
              />
            </Field>
          </div>
        )}

        {/* ── Step 4 · Health ────────────────────────────────────────── */}
        {step === 3 && (
          <div className="mt-8">
            <p className="mb-6 max-w-measure text-base text-muted">
              One question. This form does not go further than that.
            </p>
            <OptionCards
              labelledBy="wizard-step-heading"
              name="health"
              invalid={!!errors.health}
              describedBy="health-error"
              value={data.health}
              onChange={(v) => set("health", v)}
              options={[
                { value: "excellent", label: "Excellent" },
                { value: "good", label: "Good" },
                { value: "fair", label: "Fair" },
                { value: "poor", label: "Poor" },
                { value: "not-sure", label: "I would rather discuss it" },
              ]}
            />
            {errors.health && <FieldError id="health-error">{errors.health}</FieldError>}

            <p className="mt-8 max-w-measure border-l-2 border-accent-rule pl-5 text-small text-muted">
              This form does not ask about conditions, medications, height and weight or family
              history. We would rather a licensed person gathered that on a call — it is faster,
              and the answers are not usable for a real quote without follow-up anyway.
            </p>
          </div>
        )}

        {/* ── Step 5 · Contact ───────────────────────────────────────── */}
        {step === 4 && (
          <div className="mt-8 space-y-8">
            <div className="grid gap-8 sm:grid-cols-2">
              <Field label="Full name" htmlFor="name" error={errors.name}>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  value={data.name}
                  invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>

              <Field label="Email" htmlFor="email" error={errors.email}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={data.email}
                  invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              <Field label="Phone" htmlFor="phone" error={errors.phone}>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={data.phone}
                  invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>

              <Field label="Best time to reach you" htmlFor="contactTime">
                <Select
                  id="contactTime"
                  name="contactTime"
                  value={data.contactTime}
                  onChange={(e) => set("contactTime", e.target.value)}
                >
                  <option value="any">Any time during business hours</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </Select>
              </Field>
            </div>

            <Field label="Anything you would like us to know" htmlFor="notes" optional>
              <Textarea
                id="notes"
                name="notes"
                value={data.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Optional. A sentence is plenty."
              />
            </Field>

            {/* Honeypot — visually and semantically hidden from people. */}
            <div aria-hidden="true" className="hidden">
              <label htmlFor="company">Company</label>
              <input
                id="company"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={data.company}
                onChange={(e) => set("company", e.target.value)}
              />
            </div>

            <div className="border-t border-[var(--rule)] pt-7">
              <Checkbox
                id="consent"
                checked={data.consent}
                invalid={!!errors.consent}
                onChange={(v) => set("consent", v)}
              >
                {/* Rendered FROM the shared constant, so what is displayed and
                    what the server stores cannot drift apart. Full language
                    visible without expanding, unchecked by default. */}
                <ConsentText
                  contract={consentContractFor("quote")}
                  emphasise="Consent is not a condition of purchase."
                />
              </Checkbox>
              {errors.consent && <FieldError id="consent-error">{errors.consent}</FieldError>}
            </div>

            <Turnstile
              key={turnstileKey}
              onToken={setTurnstileToken}
              onStatus={setVerification}
            />
            {verificationBlocked && (
              <VerificationUnavailable
                onRetry={() => {
                  setVerification("pending");
                  retryTurnstile();
                }}
              />
            )}

            <p className="text-micro leading-relaxed text-muted">
              Submitting this form is a request for a comparison. It is not an application, not an
              offer of insurance, and not a binding quote. Coverage is subject to underwriting and
              approval by the issuing carrier.
            </p>
          </div>
        )}
      </div>

      {submitError && (
        <div className="mt-8 border border-[#8C2F1F] bg-[#8C2F1F]/[0.04] p-5">
          <p role="alert" className="text-small text-[#8C2F1F]">
            {submitError}
          </p>
          <p className="mt-3 text-small text-muted">
            <PhoneLink className="text-ink underline decoration-[var(--rule-strong)] underline-offset-4"><Token value={site.phone} /></PhoneLink>
          </p>
        </div>
      )}

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="mt-10 flex flex-col-reverse items-stretch gap-4 border-t border-[var(--rule)] pt-8 sm:flex-row sm:items-center sm:justify-between">
        {step > 0 ? (
          <button
            type="button"
            onClick={back}
            className="text-small text-muted underline decoration-[var(--rule-strong)]
                       underline-offset-[6px] transition-colors hover:text-ink hover:decoration-ink"
          >
            Back
          </button>
        ) : (
          <span className="hidden sm:block" />
        )}

        {step < STEPS.length - 1 ? (
          <button
            key="wizard-continue"
            type="button"
            onClick={next}
            className="group inline-flex items-center justify-center gap-2.5 rounded border
                       border-accent bg-accent px-8 py-4 text-base font-medium text-paper
                       transition-colors hover:border-accent-hover hover:bg-accent-hover"
          >
            Continue <Arrow />
          </button>
        ) : (
          <button
            key="wizard-submit"
            type="submit"
            disabled={submitting || !hydrated || verificationBlocked}
            className={cx(
              "group inline-flex items-center justify-center gap-2.5 rounded border px-8 py-4",
              "text-base font-medium transition-colors",
              submitting || !hydrated || verificationBlocked
                ? "cursor-wait border-[var(--rule-strong)] bg-paper-alt text-muted"
                : "border-accent bg-accent text-paper hover:border-accent-hover hover:bg-accent-hover"
            )}
          >
            {verificationBlocked
                ? "Verification unavailable"
                : !hydrated
                  ? "Preparing form…"
                  : submitting
                    ? "Sending…"
                    : "Send my request"}
            {!submitting && <Arrow />}
          </button>
        )}
      </div>
    </form>
  );
}
