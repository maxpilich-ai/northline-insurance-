"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { site } from "@/lib/site.config";
import { contactLeadSchema, fieldErrors } from "@/lib/leads";
import { Arrow, cx } from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { Turnstile, useTurnstileRetry, type TurnstileStatus } from "./Turnstile";
import { VerificationUnavailable } from "./VerificationUnavailable";
import { focusFirstError } from "./focusFirstError";
import { useHydrated } from "./useHydrated";
import { Field, Input, Select, Textarea } from "./fields";

/**
 * Short by design. A contact form that asks a lot is a form nobody sends.
 *
 * NOTE: there is deliberately no "working here as a producer" option. Recruiting
 * has its own funnel at /careers and must not sit inside the consumer
 * conversion path — and an agent enquiry arriving through here would be counted
 * as a consumer conversion, which makes both numbers meaningless.
 *
 * Submissions land on /thank-you/message, not /thank-you/quote, for the same
 * measurement reason.
 */
export function ContactForm() {
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
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    reason: "new-coverage",
    message: "",
    company: "",
  });

  const set = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
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
      kind: "contact" as const,
      ...values,
      turnstileToken,
    };
    const parsed = contactLeadSchema.safeParse(payload);
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      setErrors(found);
      focusFirstError(found, ["name", "email", "phone", "reason", "message"], "c-");
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
      router.replace("/thank-you/message");
    } catch {
      setSubmitError(
        "We could not send that just now. Please try again, or call the office directly."
      );
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-8 border border-[var(--rule)] bg-paper p-6 sm:p-9"
    >
      <div className="grid gap-8 sm:grid-cols-2">
        <Field label="Full name" htmlFor="c-name" error={errors.name}>
          <Input
            id="c-name"
            autoComplete="name"
            value={values.name}
            invalid={!!errors.name}
            aria-describedby={errors.name ? "c-name-error" : undefined}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>

        <Field label="Email" htmlFor="c-email" error={errors.email}>
          <Input
            id="c-email"
            type="email"
            autoComplete="email"
            value={values.email}
            invalid={!!errors.email}
            aria-describedby={errors.email ? "c-email-error" : undefined}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <Field label="Phone" htmlFor="c-phone" optional>
          <Input
            id="c-phone"
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>

        <Field label="What is this about?" htmlFor="c-reason" error={errors.reason}>
          <Select
            id="c-reason"
            value={values.reason}
            invalid={!!errors.reason}
            onChange={(e) => set("reason", e.target.value)}
          >
            <option value="new-coverage">New coverage</option>
            <option value="existing-policy">An existing policy</option>
            <option value="general">A general question</option>
          </Select>
        </Field>
      </div>

      <Field label="How can we help?" htmlFor="c-message" error={errors.message}>
        <Textarea
          id="c-message"
          value={values.message}
          invalid={!!errors.message}
          aria-describedby={errors.message ? "c-message-error" : undefined}
          onChange={(e) => set("message", e.target.value)}
          placeholder="A couple of sentences is plenty."
        />
      </Field>

      {/* Honeypot */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="c-company">Company</label>
        <input
          id="c-company"
          tabIndex={-1}
          autoComplete="off"
          value={values.company}
          onChange={(e) => set("company", e.target.value)}
        />
      </div>

      {submitError && (
        <div className="border border-[#8C2F1F] bg-[#8C2F1F]/[0.04] p-5">
          <p role="alert" className="text-small text-[#8C2F1F]">
            {submitError}
          </p>
          <p className="mt-3 text-small">
            <PhoneLink className="text-ink underline decoration-[var(--rule-strong)] underline-offset-4"><Token value={site.phone} /></PhoneLink>
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
              : "Send message"}
          {hydrated && !submitting && !verificationBlocked && <Arrow />}
        </button>
        <p className="mt-5 text-micro leading-relaxed text-muted">
          Sending a message is not an application for insurance. We will reply about the enquiry you
          submitted.
        </p>
      </div>
    </form>
  );
}
