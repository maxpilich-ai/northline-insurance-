# Demonstration content notice

**This repository does not describe a real business.**

`Northline Life & Insurance` is a fictional company created to demonstrate a
website design. Every business detail in this repository — the company name,
the owner's name, the office address, the telephone number and the state of
licensure — is illustrative prototype content. The carrier-appointment count
and the number of licensed producers are not even illustrative: they are
unfilled tokens and render as visible placeholders, because a count of carrier
appointments and a count of state-licensed people are the kind of claim a
regulator would test.

## Specifically

| Detail | Status |
|---|---|
| Company name, owner name | Fictional |
| Office address | Illustrative — not a verified business premises |
| Telephone number, office address, owner name | **No value is published.** Held as `{{OFFICE_PHONE}}`, `{{OFFICE_ADDRESS}}` and `{{OWNER_NAME}}` tokens, rendered as visible placeholders |
| Email | Not issued |
| State of licensure | Illustrative. **Not a verified insurance licence.** |
| Carrier count, producer count | **No figure is published.** Held as `{{CARRIER_COUNT}}` and `{{TEAM_SIZE}}` tokens, rendered as visible placeholders |

## What is deliberately absent

No insurance producer licence number and no National Producer Number appear
anywhere in this repository. Those are government-issued identifiers, verifiable
in state registries and in the NIPR database. A placeholder is an unfilled
field; a fabricated licence number is a false credential, which is a different
kind of thing entirely. They are held as `{{RESIDENT_LICENSE}}`,
`{{AGENCY_LICENSE}}` and `{{NPN}}` tokens and render visibly as placeholders.

Also absent: any claim of years in business, any award, ranking, statistic,
testimonial or client outcome.

## How the running site declares itself

While `flags.demo` is `true` in `src/lib/site.config.ts`:

- a persistent notice appears above the header on every page
- the licensing block in the footer is labelled as demonstration content
- all structured data (`InsuranceAgency`, `FAQPage`, `BreadcrumbList`) is
  suppressed, so nothing is machine-readable as a real business entity
- the whole site is `noindex` and `robots.txt` disallows crawling

Turning `flags.demo` off is a deliberate act that should happen only when every
value has been confirmed by a real business and the licence numbers are real.
