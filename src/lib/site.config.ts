/**
 * ============================================================================
 * SITE CONFIGURATION — the single file the business owner fills in.
 * ============================================================================
 *
 * RULE: nothing in this file may be invented. Every value below is either
 * confirmed by the owner or left as a {{TOKEN}}. Tokens render VISIBLY in the
 * page (dotted underline) so that no unverified claim can reach launch
 * unnoticed.
 *
 * RULE: sections whose tokens are unfilled do not render at all. This is
 * enforced in the component layer via `isResolved()` / `<IfResolved>` — it is
 * not left to a content pass. The site is structurally incapable of publishing
 * an unverified claim.
 */

export const TOKEN = (name: string) => `{{${name}}}` as const;

/** A value is "resolved" once it is no longer a {{TOKEN}} placeholder. */
export function isResolved(value: string | undefined | null): boolean {
  if (!value) return false;
  return !/^\{\{[A-Z0-9_]+\}\}$/.test(value.trim());
}

/** True only if every supplied value has been filled in. */
export function allResolved(...values: (string | undefined | null)[]): boolean {
  return values.every(isResolved);
}

/**
 * True when an email value is actually an address rather than a status word
 * such as "Coming Soon". Guards every mailto: — a mail client opened with a
 * placeholder in the To field reads as a broken business.
 */
export function isEmailAddress(value: string): boolean {
  return isResolved(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const site = {
  // ── Identity ──────────────────────────────────────── DEMO ────────────────
  companyName: "Northline Life & Insurance",
  dbaName: TOKEN("DBA_NAME"),
  tagline: "Clear guidance. Coverage built around your life.",
  positioning:
    "An independent life insurance brokerage helping individuals and families explore coverage options from a wide range of insurance carriers.",

  // ── Contact & office ───────────────────────────────── DEMO ───────────────
  phone: TOKEN("OFFICE_PHONE"),
  /** Digits only, for tel: links. Separate so formatting never breaks dialling. */
  phoneHref: TOKEN("OFFICE_PHONE_HREF"),
  /**
   * A TOKEN, not the words "Coming Soon" (finding R3-L5).
   *
   * "Coming Soon" is a resolved string as far as isResolved() is concerned, so
   * it escaped the placeholder system entirely and rendered as plain text where
   * an address belongs — "Questions about these terms: Coming Soon" on /terms,
   * and in the footer of every page. isEmailAddress() correctly suppressed the
   * mailto:, but the string still published as though it were the answer. As a
   * token it renders visibly unfilled, which is what it is.
   */
  email: TOKEN("OFFICE_EMAIL"),
  officeAddress: TOKEN("OFFICE_ADDRESS"),
  officeCityState: "Elk River, Minnesota",
  officeHours: "Monday–Friday, 9:00 AM–5:00 PM",
  /** Google Maps embed URL for /contact. Renders a designed placeholder until set. */
  mapEmbedUrl: TOKEN("MAP_EMBED_URL"),

  // ── Licensing ─────────────────────────────────────────────────────────────
  /**
   * DEMO. "Minnesota" is prototype content standing in for a real licence
   * footprint — it is not a verified credential and the site says so.
   *
   * License numbers and the NPN stay TOKENS on purpose. These are
   * government-issued identifiers that can be looked up in a state registry
   * and in the NIPR database. Inventing one would not be a placeholder, it
   * would be a fabricated credential — which is a different order of problem
   * from an unfilled field, and the one thing a demo must never do.
   */
  licenseStates: "Minnesota",
  residentLicense: TOKEN("RESIDENT_LICENSE"),
  agencyLicense: TOKEN("AGENCY_LICENSE"),
  npn: TOKEN("NPN"),

  /* ── Business facts ────────────────────────────────────────────────────────
     COUNTS ARE TOKENS (finding R3-H6).

     `carrierCount` was "30" and `teamSize` was "6". Both were RESOLVED values,
     so <Token> rendered them as ordinary prose — no dotted underline, no
     tooltip, no data-token — across nine places on six routes: "we can look
     across 30 carriers", "Appointments held — 30 insurance carriers",
     "Licensed producers — 6".

     The demonstration banner did not cover them. It enumerates what is
     illustrative — "Company name, owner, address, telephone and state of
     licensure" — and then says "No licence number, National Producer Number,
     credential or client outcome is represented here." A carrier-appointment
     count and a count of state-licensed individuals appear in neither list,
     and an enumerated disclaimer that omits an item reads as excluding it. On
     narrow viewports the banner degrades to one line and the enumeration is not
     shown at all.

     A carrier appointment count and a producer headcount are exactly the sort
     of claim a regulator would test, and neither can be substantiated from this
     repository. They are therefore tokens like every other unverified business
     fact: they render visibly marked, and the sentences around them were
     written to read correctly either way.
     ---------------------------------------------------------------------- */
  carrierCount: TOKEN("CARRIER_COUNT"),
  /** Carriers beyond those with published-logo permission. */
  additionalCarrierCount: TOKEN("ADDITIONAL_CARRIER_COUNT"),
  /** Not supplied. No founding year, and no claim about years of experience. */
  yearFounded: TOKEN("YEAR_FOUNDED"),
  yearsInBusiness: TOKEN("YEARS_IN_BUSINESS"),
  teamSize: TOKEN("TEAM_SIZE"),

  // ── Owner ──────────────────────────────────────────── DEMO ───────────────
  ownerName: TOKEN("OWNER_NAME"),
  ownerTitle: TOKEN("OWNER_TITLE"),
  /**
   * Prompted open-endedly. We know he OWNS the brokerage — not that he founded
   * it, and not that he was previously captive. No "why I went independent" arc.
   */
  ownerNote: TOKEN("OWNER_NOTE"),
  /** Longer first-person account for /about. */
  ownerAccount: TOKEN("OWNER_ACCOUNT"),

  // ── Unconfirmed — render nothing until filled ─────────────────────────────
  compensationModel: TOKEN("COMPENSATION_MODEL"),
  designations: TOKEN("DESIGNATIONS"),
  associations: TOKEN("ASSOCIATIONS"),
  /** How the organisation is structured / who works under it. /about only. */
  teamDescription: TOKEN("TEAM_DESCRIPTION"),

  // ── Scheduling ────────────────────────────────────────────────────────────
  /** Cal.com / Calendly embed URL. Placeholder frame renders until supplied. */
  calendarEmbedUrl: TOKEN("CALENDAR_EMBED_URL"),
  /** How long the introductory call actually runs. Stated once, on /schedule. */
  callLength: TOKEN("CALL_LENGTH"),

  // ── Service commitments ───────────────────────────────────────────────────
  /**
   * EVERYTHING IN THIS BLOCK IS A BUSINESS PRACTICE, NOT AN INDUSTRY FACT.
   *
   * How fast he responds, who answers the telephone, how often he contacts
   * people, who can see a submitted enquiry, how long records are kept — none
   * of these can be inferred from "independent life insurance brokerage". They
   * are exactly the class of claim the token system exists to quarantine, and
   * they are the easiest to drift into writing because they sound like
   * atmosphere rather than fact.
   */
  matchingTurnaround: TOKEN("MATCHING_TURNAROUND"),
  initialResponseTime: TOKEN("INITIAL_RESPONSE_TIME"),
  phoneHandling: TOKEN("PHONE_HANDLING"),
  contactPolicy: TOKEN("CONTACT_POLICY"),
  policyReviewPractice: TOKEN("POLICY_REVIEW_PRACTICE"),
  remoteServicePractice: TOKEN("REMOTE_SERVICE_PRACTICE"),
  dataAccessPractice: TOKEN("DATA_ACCESS_PRACTICE"),
  retentionPeriod: TOKEN("RETENTION_PERIOD"),
  accessibilitySupportPractice: TOKEN("ACCESSIBILITY_SUPPORT_PRACTICE"),

  // ── Recruiting ────────────────────────────────────────────────────────────
  recruitingValueProp: TOKEN("RECRUITING_VALUE_PROP"),
  commissionStructure: TOKEN("COMMISSION_STRUCTURE"),
  vestingPolicy: TOKEN("VESTING_POLICY"),
  releasePolicy: TOKEN("RELEASE_POLICY"),
  leadPolicy: TOKEN("LEAD_POLICY"),
  chargebackPolicy: TOKEN("CHARGEBACK_POLICY"),
  trainingProgram: TOKEN("TRAINING_PROGRAM"),
  agentTechStack: TOKEN("AGENT_TECH_STACK"),
  backOfficeSupport: TOKEN("BACK_OFFICE_SUPPORT"),
  applicationReviewPractice: TOKEN("APPLICATION_REVIEW_PRACTICE"),
  employmentStatus: TOKEN("EMPLOYMENT_STATUS"),
  downlineDisclosure: TOKEN("DOWNLINE_DISCLOSURE"),
  prelicensingSupport: TOKEN("PRELICENSING_SUPPORT"),
  recruitingStates: TOKEN("RECRUITING_STATES"),

  // ── Legal ─────────────────────────────────────────────────────────────────
  /**
   * How enquiry data is actually handled — whether details are ever shared with
   * or sold to other agencies or lead buyers.
   *
   * This is a BUSINESS PRACTICE, not a given. "We never sell your information"
   * is one of the strongest trust statements available and it must come from
   * him, not from an assumption about how brokerages behave. Every place the
   * site would otherwise make that claim is gated on this token.
   */
  dataSharingPractice: TOKEN("DATA_SHARING_PRACTICE"),
  privacyEffectiveDate: TOKEN("PRIVACY_EFFECTIVE_DATE"),
  termsEffectiveDate: TOKEN("TERMS_EFFECTIVE_DATE"),
  privacyContactEmail: TOKEN("PRIVACY_CONTACT_EMAIL"),
} as const;

/**
 * Feature flags. Every one of these is OFF until real, verified, compliant
 * material exists. Flipping a flag with no material behind it is the failure
 * mode this structure exists to prevent.
 */
export const flags = {
  /**
   * DEMONSTRATION PROTOTYPE.
   *
   * The business details in `site` above are illustrative content for a design
   * prototype, not verified information about a real brokerage. While this is
   * true the site displays a persistent notice and labels the licensing block
   * accordingly, so nothing here can be mistaken for a real credential.
   *
   * Set to false only when every value has been confirmed by the business and
   * the licence numbers and NPN are real.
   */
  demo: true,

  /** Several states restrict testimonial use in insurance advertising, and FTC
   *  endorsement rules apply regardless. Requires written client consent. */
  testimonials: false,

  /** Carrier advertising rules commonly require written permission and often
   *  advertising pre-approval. Assume zero permission until confirmed
   *  carrier by carrier. */
  carrierLogos: false,

  /*
   * `statistics` USED TO LIVE HERE, AND DID NOTHING (finding R3-M11).
   *
   * It was declared `false` and described as gating "figures he can
   * substantiate from his own records", and the styleguide published it in a
   * governance table under the heading "These render nothing at all until real
   * material exists. Enforced in the component layer." Nothing consulted it.
   * The only reference in the entire repository was the styleguide row that
   * advertised it. Meanwhile the two figures it purported to gate —
   * carrierCount "30" and teamSize "6" — rendered as unmarked prose on six
   * routes (finding R3-H6).
   *
   * It is gone rather than implemented because the placeholder system already
   * does this job, and does it better: an unverified figure is a TOKEN, it
   * renders visibly marked wherever it appears, and `IfResolved` hides the
   * panels built around it until the owner supplies a real value. A second
   * boolean gate over the same figures would be one more thing to keep in sync
   * and one more place for the two to disagree. carrierCount and teamSize are
   * now tokens, which is the enforcement the flag only claimed to provide.
   */

  /** Renders the "how we're paid" section on /how-it-works and the matching
   *  FAQ entry. Off until the compensation model is confirmed. */
  compensation: false,

  /** Emit LocalBusiness / InsuranceAgency JSON-LD. Auto-suppressed while the
   *  underlying facts are still tokens — see lib/schema.ts. */
  structuredData: true,

  /**
   * Whether the product lines below have been CONFIRMED by the business as
   * things it can actually place.
   *
   * Off. The list is populated with demonstration content, and a populated list
   * is not a confirmation — that conflation is exactly what this flag exists to
   * prevent. While it is off, /coverage labels the section as demonstration
   * content and words it as a description of the category rather than a claim
   * about this firm. Turn it on only when someone has confirmed the actual
   * appointments, at which point the section becomes a plain "what we place".
   */
  productsConfirmed: false,
} as const;

/**
 * PRODUCT LINES — NOT CONFIRMED FOR ANY REAL BUSINESS.
 *
 * The three entries below are DEMONSTRATION CONTENT. They describe how these
 * product categories work in general; they are not a statement that this firm
 * holds appointments to place any of them.
 *
 * Populating this array used to flip /coverage from educational mode into a
 * "what we place" treatment with no other signal — a fictional configuration
 * silently becoming an apparent product offering. That is now impossible:
 * while `flags.demo` is true the section renders under an explicit
 * demonstration label (see /coverage), and `productsConfirmed` below is the
 * switch that must be turned on deliberately, by a person, once the business
 * has confirmed what it actually places.
 */
export const productLines: { slug: string; name: string; summary: string }[] = [
  {
    slug: "term-life",
    name: "Term Life Insurance",
    summary:
      "Coverage for a fixed number of years. If the need you are covering has an end date — years left on a mortgage, years until the children are independent — this is usually where the conversation starts.",
  },
  {
    slug: "whole-life",
    name: "Whole Life Insurance",
    summary:
      "Permanent coverage with a level premium and a guaranteed cash value that builds over time. Designed to stay in force for life provided it is funded as the contract requires.",
  },
  {
    slug: "universal-life",
    name: "Universal Life Insurance",
    summary:
      "Permanent coverage with flexibility in how the premium is paid and how the policy is funded over time. The structure varies considerably between carriers, which is where comparing them earns its keep.",
  },
];

/** Primary navigation — consumer only. Recruiting never appears here. */
export const nav = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Coverage", href: "/coverage" },
  { label: "Carriers", href: "/carriers" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

export const routes = {
  quote: "/quote",
  schedule: "/schedule",
  contact: "/contact",
  careers: "/careers",
  apply: "/careers/apply",
} as const;

/*
 * NOTE — lead delivery is NOT configured here.
 *
 * There used to be a `leadDelivery` object in this file holding
 * {{LEAD_NOTIFY_EMAIL}} and {{AGENT_LEAD_NOTIFY_EMAIL}} tokens, with a comment
 * claiming the API route required both a mail transport and a persisted store.
 * Nothing imported it, and both statements were wrong: the addresses are
 * environment variables (they are credentials-adjacent and differ per
 * environment), and any ONE working transport is sufficient.
 *
 * Delivery is configured entirely through the environment — see .env.example
 * and the "Lead delivery" section of README.md.
 */
