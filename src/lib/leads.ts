import { z } from "zod";
import { isResolved, site } from "./site.config";

/**
 * ============================================================================
 * LEAD SCHEMAS AND CONSENT CONTRACTS
 * ============================================================================
 *
 * TRUST BOUNDARY. Everything in a request body is attacker-controlled. The
 * browser sends a *claim* about what consent was shown; it never sends the
 * evidence. The server holds the canonical consent text, stamps its own
 * timestamp, and derives the source URL from request headers it can check.
 *
 * The client-echoed consent fields exist only so the server can REJECT a
 * submission whose consent claim does not match what the corresponding form is
 * built to display. They are cross-checks, not evidence.
 */

/* ══════════════════════════════════════════════════════════════════════════
   CONSENT CONTRACTS

   Two distinct contracts, because the two forms ask for consent to two
   different things. Reusing the consumer text on the producer application
   would mean storing a record saying someone consented to be called about
   life insurance when the page in front of them said producer opportunities.
   ══════════════════════════════════════════════════════════════════════════ */

export const CONSUMER_CONSENT_VERSION = "consumer-tcpa-v1";

export const CONSUMER_CONSENT_TEXT =
  `By providing my telephone number and submitting this form, I agree that ${site.companyName} ` +
  `and its licensed insurance producers may contact me at the number provided about life ` +
  `insurance, including by automatic telephone dialing system, prerecorded or artificial voice, ` +
  `and text message. Consent is not a condition of purchase. Message and data rates may apply. ` +
  `I may revoke consent at any time by replying STOP or by asking us to stop contacting me.`;

export const AGENT_CONSENT_VERSION = "agent-tcpa-v1";

export const AGENT_CONSENT_TEXT =
  `By providing my telephone number and submitting this application, I agree that ` +
  `${site.companyName} may contact me at the number provided about producer opportunities, ` +
  `including by automatic telephone dialing system, prerecorded or artificial voice, and text ` +
  `message. Consent is not a condition of anything. Message and data rates may apply. I may ` +
  `revoke consent at any time.`;

export type ConsentContract = { version: string; text: string };

/**
 * The server selects the contract from `lead.kind`, never from anything the
 * client asserts about which contract applied.
 */
export function consentContractFor(kind: "quote" | "agent"): ConsentContract {
  return kind === "agent"
    ? { version: AGENT_CONSENT_VERSION, text: AGENT_CONSENT_TEXT }
    : { version: CONSUMER_CONSENT_VERSION, text: CONSUMER_CONSENT_TEXT };
}

/* ══════════════════════════════════════════════════════════════════════════
   LICENSED STATES

   An insurance producer may only transact in states where a licence is held.
   The browser narrows the field to a menu; that is a convenience. This is the
   rule.
   ══════════════════════════════════════════════════════════════════════════ */

export function licensedStates(): string[] {
  if (!isResolved(site.licenseStates)) return [];
  return site.licenseStates
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Case-insensitive so "minnesota" is accepted; the stored value is canonical. */
export function canonicalLicensedState(value: string): string | null {
  const states = licensedStates();
  if (states.length === 0) return null;
  const hit = states.find((s) => s.toLowerCase() === value.trim().toLowerCase());
  return hit ?? null;
}

/* ══════════════════════════════════════════════════════════════════════════
   SHARED FIELD RULES
   ══════════════════════════════════════════════════════════════════════════ */

const name = z.string().trim().min(2, "Enter your name.").max(80);
const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .email("Enter a complete email address.")
  .max(160);
const phone = z
  .string()
  .trim()
  .min(1, "Enter a phone number.")
  .max(32)
  .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number.");

/**
 * Fields the client echoes back so the server can verify the form displayed
 * what it was supposed to. Never stored as-is.
 */
const consentEcho = {
  consent: z.literal(true, { message: "We need your consent in order to contact you." }),
  consentVersion: z.string().max(64),
  consentText: z.string().max(4000),
};

/**
 * Honeypot — humans never see it, bots fill it.
 *
 * The schema deliberately ACCEPTS a filled value. Rejecting it here would
 * return a 422 naming the field, which tells a bot precisely what tripped it.
 * The route checks the value instead and answers 200 with no delivery, so a
 * bot learns nothing from either the status or the body. Length is capped so
 * the field cannot be used to push a large payload.
 */
const honeypot = z.string().max(200).optional().or(z.literal(""));

/** Cloudflare Turnstile token. Presence is enforced server-side when enabled. */
const turnstileToken = z.string().max(4096).optional().or(z.literal(""));

/* ══════════════════════════════════════════════════════════════════════════
   QUOTE REQUEST

   NOTE ON HEALTH DATA: one self-rated field and nothing more. Conditions,
   medications, height/weight and family history are gathered by a licensed
   person on a call.
   ══════════════════════════════════════════════════════════════════════════ */

export const situationValues = [
  "family",
  "mortgage",
  "final-wishes",
  "review-existing",
  "declined-before",
  "not-sure",
] as const;

export const amountValues = [
  "under-250k",
  "250k-500k",
  "500k-1m",
  "1m-2m",
  "over-2m",
  "not-sure",
] as const;

export const healthValues = ["excellent", "good", "fair", "poor", "not-sure"] as const;
export const contactTimeValues = ["morning", "afternoon", "evening", "any"] as const;

/**
 * State validation. When a licence footprint is configured the value must be
 * one of those states — enforced here, so it applies on the server as well as
 * in the browser. With no footprint configured the field falls back to a
 * length check and the API logs that the business rule is unenforceable.
 */
const stateField = z
  .string()
  .trim()
  .min(2, "Select your state.")
  .max(64)
  .superRefine((value, ctx) => {
    const states = licensedStates();
    if (states.length === 0) return; // no footprint configured — see route.ts
    if (!canonicalLicensedState(value)) {
      ctx.addIssue({
        code: "custom",
        message: `We are only licensed in ${states.join(", ")}.`,
      });
    }
  });

export const quoteLeadSchema = z.object({
  kind: z.literal("quote"),
  situation: z.enum(situationValues, { message: "Choose the closest match." }),
  amount: z.enum(amountValues, { message: "Choose an approximate amount." }),
  age: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "Enter your age in years.")
    .refine((v) => Number(v) >= 18 && Number(v) <= 100, "Enter an age between 18 and 100."),
  sex: z.enum(["female", "male"], { message: "Select one." }),
  state: stateField,
  tobacco: z.enum(["no", "yes", "not-sure"], { message: "Select one." }),
  health: z.enum(healthValues, { message: "Choose the closest description." }),
  name,
  email,
  phone,
  contactTime: z.enum(contactTimeValues),
  notes: z.string().trim().max(1200).optional().or(z.literal("")),
  ...consentEcho,
  company: honeypot,
  turnstileToken,
});

export type QuoteLead = z.infer<typeof quoteLeadSchema>;

/* ══════════════════════════════════════════════════════════════════════════
   PRODUCER APPLICATION
   ══════════════════════════════════════════════════════════════════════════ */

export const agentLeadSchema = z.object({
  kind: z.literal("agent"),
  name,
  email,
  phone,
  states: z.string().trim().min(2, "Which state or states?").max(160),
  licensed: z.enum(["licensed", "in-progress", "not-licensed"], {
    message: "Select your licensing status.",
  }),
  licenseNumber: z.string().trim().max(40).optional().or(z.literal("")),
  experience: z.enum(["none", "under-1", "1-3", "3-10", "over-10"], {
    message: "Select your experience level.",
  }),
  currentAffiliation: z.string().trim().max(120).optional().or(z.literal("")),
  motivation: z.string().trim().min(10, "A sentence or two is enough.").max(2000),
  availability: z.enum(["immediately", "1-3-months", "exploring"], {
    message: "Select your availability.",
  }),
  resumeUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "Enter a link beginning http:// or https://")
    .optional()
    .or(z.literal("")),
  ...consentEcho,
  company: honeypot,
  turnstileToken,
});

export type AgentLead = z.infer<typeof agentLeadSchema>;

/* ══════════════════════════════════════════════════════════════════════════
   CONTACT ENQUIRY

   No TCPA consent block: this form carries no marketing-contact permission,
   so none is claimed, echoed or stored.
   ══════════════════════════════════════════════════════════════════════════ */

export const contactLeadSchema = z.object({
  kind: z.literal("contact"),
  name,
  email,
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  reason: z.enum(["new-coverage", "existing-policy", "general"], {
    message: "Select a reason.",
  }),
  message: z.string().trim().min(5, "Tell us briefly how we can help.").max(2000),
  company: honeypot,
  turnstileToken,
});

export const anyLeadSchema = z.discriminatedUnion("kind", [
  quoteLeadSchema,
  agentLeadSchema,
  contactLeadSchema,
]);

export type AnyLead = z.infer<typeof anyLeadSchema>;

/** True for the two kinds that carry a consent contract. */
export function carriesConsent(lead: AnyLead): lead is QuoteLead | AgentLead {
  return lead.kind === "quote" || lead.kind === "agent";
}

/** Flatten zod issues into a field → message map the forms can render. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
