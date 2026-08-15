# Service commitments — signed off

**Status: complete.** All twelve items were reviewed by the owner and the answers are applied in the code. This file is now the record of what the site is permitted to say, and why.

The site distinguishes two kinds of statement about the business:

**1. Measurable or auditable facts** — response times, call durations, who answers the telephone, how data is handled, retention periods, commission terms. These are never written as copy. They live as `{{TOKENS}}` in `src/lib/site.config.ts`, render visibly as placeholders until filled in, and any section depending on them does not render at all.

**2. Statements of intent about how the firm works with clients** — the table below. These are the site's *offer*, phrased in the first person. They cannot be tokenised without turning the copy into placeholder soup, so instead they were put to the owner one at a time.

---

## The decisions

| # | Decision | What the site now says |
|---|---|---|
| 1 | **STRUCK** | The claim that the firm stays with the application through underwriting is **gone**. `/about` now says only that we submit the application to the carrier and explain what underwriting will involve. |
| 2 | **CHANGED** | Post-issue review is framed as the client's option, not an ongoing service guarantee: *"If your circumstances later change… you are welcome to come back and have it looked at again."* The FAQ answer remains the `{{POLICY_REVIEW_PRACTICE}}` token. |
| 3 | **STRUCK** | *"If it becomes clear that life insurance is not what you need, we will say so"* is **deleted** from `/how-it-works`. Nothing replaces it. |
| 4 | **KEPT** | Options presented side by side, differences explained plainly, including the ones not in our favour. |
| 5 | **KEPT** | Coverage worked out from the client's circumstances and the arithmetic rather than from a fixed script. |
| 6 | **KEPT** | We go through the issued policy with the client and confirm the beneficiary details are right. |
| 7 | **KEPT** | If asked whether we hold an appointment with a specific insurer, we answer directly. |
| 8 | **KEPT** | No pressure to decide anything during the consultation. |
| 9 | **CHANGED** | Absolute language removed everywhere. The site now describes **what this form does** — *"This form does not ask about conditions, medications, height and weight or family history"* — and states a **preference**: *"We would rather a licensed person gathered that on a call."* It no longer claims detailed health questions are never collected through the website as a matter of policy. |
| 10 | **KEPT** | The telephone number appears on every page, in the utility bar, the footer, the mobile call bar and beside every form. It is never placed behind a form. |
| 11 | **CHANGED** | The recruiting page no longer claims all contract terms are published. The heading is now *"What we can set out up front"*, and the copy states plainly that anything not covered there is dealt with in conversation. Individual terms remain tokens and appear only when filled in. |
| 12 | **CHANGED** | Producer applications post with `kind: "agent"` and land on `/thank-you/apply` rather than a consumer confirmation, so recruiting is recorded separately at the point of intake. The claim that they *route to a separate inbox* is now stated as the conditional it always was: the email transport sends them to `AGENT_LEAD_NOTIFY_EMAIL` **when that optional variable is set**, and falls back to the ordinary notification address otherwise; the webhook transport posts every kind to the one configured `LEAD_STORE_URL`. There is also no analytics in this repository, so there are no conversion figures for recruiting to stay out of. |

---

## Structural claims — true by construction, no sign-off needed

Verifiable in the code rather than promised:

- The quote form asks one health question and no more.
- Form submissions are validated on the server as well as in the browser, using the same schema.
- Consent is stored with its exact text version, a timestamp, and the source URL — the last
  derived on the server from the form, never from a request header. The requesting IP address is
  stored **only when the deployment sets `TRUST_PROXY_HEADERS=1`** and the forwarding header
  carries a routable public address; otherwise the record holds `null` together with the reason,
  so it never claims an address it cannot stand behind. The source URL is likewise `null`, and
  consent submissions are refused outright in production, when the build has no canonical URL.
- A submission that cannot be delivered returns an error and shows the office number, rather than silently succeeding.
- No carrier name or logo is displayed anywhere until `flags.carrierLogos` is turned on.
- No testimonial, carrier name or logo, credential or compensation statement renders until its flag
  and token are set. Numeric business facts — the carrier-appointment count, the count of licensed
  producers — are governed by the token system alone: they are `TOKEN()` values and render as
  visibly unfilled placeholders until an owner supplies them. There is no separate `statistics`
  flag; one was declared and never consulted, so it was removed rather than left as a safeguard
  that existed only in this document.
- Contact-form submissions land on `/thank-you/message`, kept out of the quote conversion count.

---

## If anything changes

Add the claim here before adding it to the copy. The rule that has held throughout: **an uncertain answer becomes a token or gets deleted — it never becomes a factual business promise.**

Two items above are worth revisiting once the business is more settled: **#1**, if he does decide to case-manage through underwriting, is a genuine differentiator worth stating; and **#11**, publishing more of the contract terms, is the single strongest filter available on the recruiting page.
