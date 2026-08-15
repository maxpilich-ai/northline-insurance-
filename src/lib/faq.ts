import { flags, site } from "./site.config";

/**
 * FAQ CONTENT — single source for /faq, the homepage accordion, and the
 * FAQPage structured data.
 *
 * Answers are plain strings so they can be emitted as JSON-LD without
 * re-authoring. Any answer still containing an unresolved {{TOKEN}} is
 * filtered out of the structured data automatically (see lib/schema.tsx) —
 * publishing a placeholder to a search engine would be worse than publishing
 * nothing.
 *
 * DELIBERATELY ABSENT: "what does it cost to work with you". It is the single
 * most common objection and the compensation model is unconfirmed, so it
 * appears only when flags.compensation is turned on.
 */

export type FaqItem = { q: string; a: string };
export type FaqGroup = { heading: string; items: FaqItem[] };

const workingWithUs: FaqItem[] = [
  {
    q: "What does “independent” actually mean?",
    a: `A captive agent is contracted to one insurance company and can submit business only to that company. An independent brokerage holds appointments with many — in our case ${site.carrierCount} — and can submit an application to whichever company's underwriting guidelines suit the applicant. Nothing else about the policy changes; what changes is how many sets of rules the application can be measured against.`,
  },
  {
    q: "Are you an insurance company?",
    a: "No. We are a brokerage. Insurance companies underwrite policies, issue them and pay claims. We arrange the coverage, compare what different carriers can offer, and handle the application. The policy contract is between you and the issuing carrier.",
  },
  {
    // BUSINESS PRACTICE — not an assumption. The answer is whatever he confirms
    // it to be; the site does not get to decide that a brokerage never sells
    // lead data. Filtered out of the FAQ structured data while unresolved.
    q: "What happens to my information after I submit the form?",
    a: site.dataSharingPractice,
  },
  {
    q: "Is anything on this site a real quote?",
    a: "No. Nothing on this website is an offer of insurance, a binding quote, or a guarantee of coverage. Premiums and eligibility are set by the issuing carrier and depend on underwriting. What you get from us is a comparison and a recommendation — the carrier makes the decision.",
  },
  {
    q: "Do I have to meet in person?",
    a: site.remoteServicePractice,
  },
];

const gettingCovered: FaqItem[] = [
  {
    q: "How long does this take from start to finish?",
    // Underwriting duration is the CARRIER's clock and safe to state. How long
    // we take to come back is a claim about this firm — withheld.
    a: "Underwriting is the long part — commonly two to six weeks, though it varies considerably by carrier, by product and by applicant. Anyone promising same-day coverage is describing an application, not an issued policy.",
  },
  {
    q: "Will I need a medical exam?",
    a: "It depends on the carrier, the policy, the coverage amount and your age. Many applications still involve a paramedical exam, usually a nurse visiting you to take basic measurements and samples. Some carriers offer accelerated underwriting that can skip the exam for applicants who meet their criteria. Knowing which carriers offer a realistic accelerated route for a given applicant is part of what carrier matching is for.",
  },
  {
    q: "What will the insurance company look at?",
    a: "Depending on the application, a carrier may review a paramedical exam, records requested from your doctor, your prescription history, and industry databases that insurers share. Some applications also involve a short phone interview covering medical history, travel and occupation.",
  },
  {
    q: "I have been declined before. Is it worth trying again?",
    a: "A decline reflects one company's assessment of one application against its own filed guidelines. Other carriers file different guidelines and may weigh the same history differently. It is exactly the circumstance where working across multiple carriers is worth something — though no broker can promise a different outcome.",
  },
  {
    q: "What happens if I am approved at a different rate than expected?",
    a: "You are under no obligation to accept it. That is the point at which we can compare how other carriers assess the same profile, before you decide anything. An agent contracted to a single company has no equivalent option.",
  },
  {
    q: "Can I get coverage if I use tobacco?",
    a: "Yes. Tobacco use is generally assessed as a separate rate class rather than a bar to coverage. Definitions of what counts as tobacco use, and how long you must have stopped to be assessed otherwise, differ between carriers — which is one of the more common reasons the same applicant is priced differently in different places.",
  },
  {
    q: "What if my circumstances change after the policy is issued?",
    a: site.policyReviewPractice,
  },
];

const practical: FaqItem[] = [
  {
    q: "Which states can you work in?",
    a: `Insurance producers are licensed state by state. We are licensed in ${site.licenseStates}, and we cannot arrange coverage for a resident of a state where we do not hold a license.`,
  },
  {
    q: "How much information do I have to give the website?",
    a: "Very little. The quote form asks what you are trying to cover, roughly how much coverage you have in mind, and four basic facts — age, sex, state and tobacco use — plus how to reach you. It does not go further into your health than a single self-rated question. We would rather the detail was gathered by a licensed person on a call.",
  },
  {
    q: "Will I be called repeatedly if I fill in the form?",
    a: site.contactPolicy,
  },
  {
    q: "I would rather call than fill in a form.",
    a: `That is a supported route rather than a fallback: the number is ${site.phone}, it is published on every page, and it is never placed behind a form. The quote form and the calendar exist for people who prefer them.`,
  },
];

const compensationItem: FaqItem = {
  q: "What does it cost to work with you?",
  a: site.compensationModel,
};

export const faqGroups: FaqGroup[] = [
  {
    heading: "Working with an independent brokerage",
    items: flags.compensation
      ? [workingWithUs[0], compensationItem, ...workingWithUs.slice(1)]
      : workingWithUs,
  },
  { heading: "Getting covered", items: gettingCovered },
  { heading: "Practical questions", items: practical },
];

/** The five most common objections, surfaced on the homepage. */
export const homepageFaq: FaqItem[] = [
  workingWithUs[0],
  gettingCovered[1],
  gettingCovered[0],
  gettingCovered[3],
  workingWithUs[3],
];

export const allFaqItems: FaqItem[] = faqGroups.flatMap((g) => g.items);
