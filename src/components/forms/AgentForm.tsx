"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AGENT_CONSENT_TEXT,
  AGENT_CONSENT_VERSION,
  agentLeadSchema,
  consentContractFor,
  fieldErrors,
} from "@/lib/leads";
import { ConsentText } from "./ConsentText";
import { Arrow, cx } from "@/components/ui/primitives";
import { Turnstile, useTurnstileRetry, type TurnstileStatus } from "./Turnstile";
import { VerificationUnavailable } from "./VerificationUnavailable";
import { focusFirstError } from "./focusFirstError";
import { useHydrated } from "./useHydrated";
import { Checkbox, Field, FieldError, Input, RadioRow, Select, Textarea } from "./fields";

/**
 * PRODUCER APPLICATION.
 *
 * Submits with kind:"agent" so the API route can send it to a separate inbox.
 * Recruiting numbers are reported independently of consumer conversion — the
 * two averaged together are meaningless.
 *
 * Resume is collected as a LINK rather than an upload. A file input with no
 * storage destination behind it is worse than no file input: it looks like it
 * worked. Swap to multipart upload once a storage target is chosen.
 */
export function AgentForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Finding R2-05: an unhydrated form must not fall back to a native GET.
  const hydrated = useHydrated();
  const [submitError, setSubmitError] = useState<string | null>(null);
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
  const [v, setV] = useState({
    name: "",
    email: "",
    phone: "",
    states: "",
    licensed: "",
    licenseNumber: "",
    experience: "",
    currentAffiliation: "",
    motivation: "",
    availability: "",
    resumeUrl: "",
    consent: false,
    company: "",
  });

  const set = (key: keyof typeof v, value: string | boolean) => {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      kind: "agent" as const,
      ...v,
      // The AGENT contract — this form asks about producer opportunities, not
      // life insurance. Server-side stamping covers timestamp and source URL.
      consentVersion: AGENT_CONSENT_VERSION,
      consentText: AGENT_CONSENT_TEXT,
      turnstileToken,
    };
    const parsed = agentLeadSchema.safeParse(payload);
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      setErrors(found);
      // Was: querySelector("[aria-invalid='true']") immediately after setErrors,
      // which reads the DOM before React has rendered the new error state and so
      // focuses whatever was invalid on the PREVIOUS attempt — or nothing at all.
      focusFirstError(
        found,
        ["name", "email", "phone", "states", "licensed", "licenseNumber", "experience",
          "currentAffiliation", "motivation", "availability", "resumeUrl", "consent"],
        "a-"
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) throw new Error(String(res.status));
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
      router.replace("/thank-you/apply");
    } catch {
      setSubmitError("We could not send that just now. Please try again in a moment.");
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-9 border border-[var(--rule)] bg-paper p-6 sm:p-9 md:p-11"
    >
      <fieldset className="space-y-8">
        <legend className="font-display text-h4 text-ink">About you</legend>

        <div className="grid gap-8 sm:grid-cols-2">
          <Field label="Full name" htmlFor="a-name" error={errors.name}>
            <Input
              id="a-name"
              autoComplete="name"
              value={v.name}
              invalid={!!errors.name}
              aria-describedby={errors.name ? "a-name-error" : undefined}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="a-email" error={errors.email}>
            <Input
              id="a-email"
              type="email"
              autoComplete="email"
              value={v.email}
              invalid={!!errors.email}
              aria-describedby={errors.email ? "a-email-error" : undefined}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <Field label="Phone" htmlFor="a-phone" error={errors.phone}>
            <Input
              id="a-phone"
              type="tel"
              autoComplete="tel"
              value={v.phone}
              invalid={!!errors.phone}
              aria-describedby={errors.phone ? "a-phone-error" : undefined}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field
            label="State or states"
            htmlFor="a-states"
            error={errors.states}
            hint="Where you are licensed, or intend to be."
          >
            <Input
              id="a-states"
              autoComplete="address-level1"
              value={v.states}
              invalid={!!errors.states}
              aria-describedby={errors.states ? "a-states-error a-states-hint" : "a-states-hint"}
              onChange={(e) => set("states", e.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-8 border-t border-[var(--rule)] pt-9">
        <legend className="font-display text-h4 text-ink">Licensing and experience</legend>

        <Field label="Licensing status" htmlFor="a-licensed" error={errors.licensed} group>
          <RadioRow
            labelledBy="a-licensed-label"
            name="licensed"
            invalid={!!errors.licensed}
            describedBy="a-licensed-error"
            value={v.licensed || null}
            onChange={(val) => set("licensed", val)}
            options={[
              { value: "licensed", label: "Life licensed" },
              { value: "in-progress", label: "In progress" },
              { value: "not-licensed", label: "Not yet licensed" },
            ]}
          />
        </Field>

        {v.licensed === "licensed" && (
          <Field label="License number" htmlFor="a-license-no" optional>
            <Input
              id="a-license-no"
              value={v.licenseNumber}
              onChange={(e) => set("licenseNumber", e.target.value)}
            />
          </Field>
        )}

        <div className="grid gap-8 sm:grid-cols-2">
          <Field label="Years selling insurance" htmlFor="a-experience" error={errors.experience}>
            <Select
              id="a-experience"
              value={v.experience}
              invalid={!!errors.experience}
              aria-describedby={errors.experience ? "a-experience-error" : undefined}
              onChange={(e) => set("experience", e.target.value)}
            >
              <option value="">Select</option>
              <option value="none">None yet</option>
              <option value="under-1">Under a year</option>
              <option value="1-3">1–3 years</option>
              <option value="3-10">3–10 years</option>
              <option value="over-10">Over 10 years</option>
            </Select>
          </Field>

          <Field label="Current affiliation" htmlFor="a-affiliation" optional>
            <Input
              id="a-affiliation"
              autoComplete="organization"
              value={v.currentAffiliation}
              onChange={(e) => set("currentAffiliation", e.target.value)}
              placeholder="Carrier, agency, or independent"
            />
          </Field>
        </div>

        <Field label="Availability" htmlFor="a-availability" error={errors.availability} group>
          <RadioRow
            labelledBy="a-availability-label"
            name="availability"
            invalid={!!errors.availability}
            describedBy="a-availability-error"
            value={v.availability || null}
            onChange={(val) => set("availability", val)}
            options={[
              { value: "immediately", label: "Immediately" },
              { value: "1-3-months", label: "In 1–3 months" },
              { value: "exploring", label: "Just exploring" },
            ]}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-8 border-t border-[var(--rule)] pt-9">
        <legend className="font-display text-h4 text-ink">Why you are looking</legend>

        <Field
          label="What are you hoping to find?"
          htmlFor="a-motivation"
          error={errors.motivation}
          hint="A couple of sentences. Specific beats polished."
        >
          <Textarea
            id="a-motivation"
            value={v.motivation}
            invalid={!!errors.motivation}
            aria-describedby={
              errors.motivation ? "a-motivation-error a-motivation-hint" : "a-motivation-hint"
            }
            onChange={(e) => set("motivation", e.target.value)}
          />
        </Field>

        <Field
          label="Link to a resume or LinkedIn profile"
          htmlFor="a-resume"
          optional
          hint="A link rather than an upload, so nothing is lost in transit."
        >
          <Input
            id="a-resume"
            autoComplete="url"
            type="url"
            value={v.resumeUrl}
            aria-describedby="a-resume-hint"
            onChange={(e) => set("resumeUrl", e.target.value)}
            placeholder="https://"
          />
        </Field>
      </fieldset>

      {/* Honeypot */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="a-company">Company</label>
        <input
          id="a-company"
          tabIndex={-1}
          autoComplete="off"
          value={v.company}
          onChange={(e) => set("company", e.target.value)}
        />
      </div>

      <div className="border-t border-[var(--rule)] pt-9">
        <Checkbox
          id="a-consent"
          checked={v.consent}
          invalid={!!errors.consent}
          onChange={(val) => set("consent", val)}
        >
          <ConsentText
            contract={consentContractFor("agent")}
            emphasise="Consent is not a condition of anything."
          />
        </Checkbox>
        {errors.consent && <FieldError id="a-consent-error">{errors.consent}</FieldError>}
      </div>

      {submitError && (
        <div className="border border-[#8C2F1F] bg-[#8C2F1F]/[0.04] p-5">
          <p role="alert" className="text-small text-[#8C2F1F]">
            {submitError}
          </p>
        </div>
      )}

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

      <div className="border-t border-[var(--rule)] pt-8">
        <button
          type="submit"
          disabled={submitting || !hydrated || verificationBlocked}
          className={cx(
            "group inline-flex w-full items-center justify-center gap-2.5 rounded border px-8 py-4",
            "text-base font-medium transition-colors sm:w-auto",
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
              : "Submit application"}
          {!submitting && <Arrow />}
        </button>
      </div>
    </form>
  );
}
