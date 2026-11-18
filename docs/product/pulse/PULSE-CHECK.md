# Pulse Check

**Seen a claim? Check what the evidence says.** · People's Pulse · Powered by ELK

Built 2026-11-18 (mission 928) for the owner's brief _P0 — PEOPLE'S PULSE:
PULSE CHECK_, as the fourth phase of People's Pulse ([V1](PEOPLES-PULSE.md),
[V2](PEOPLES-PULSE-V2.md), [Quick Ideas](QUICK-IDEAS.md)). **No new
application**: a Pulse Check is a People's Pulse of kind `check`, so its poll
uses the same vote store, one-vote-per-browser rule, network cap, signed
ballot, referral circles, results, map, card and moderation. What a Pulse
does not have — the investigation, the discussion, a private screenshot —
lives beside it (ADR 023, proposed).

The journey is the brief's: **SEE IT → SUBMIT IT → INVESTIGATE IT → PUBLISH
IT → SHARE IT → DISCUSS IT.**

## Routes

| Route                                    | What                                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/check`                                 | Discovery: Check a claim; Trending, Recent, Most discussed, Recently updated evidence; `?p=BC` adds "About British Columbia" |
| `/check/new`                             | The four-step phone form: See it · Why · Investigate · Publish                                                               |
| `/check/<claim-words>-<id>`              | The permanent public page. `/check/<id>` and `/labs/pulse/<id>` redirect here                                                |
| `/check/<slug>/opengraph-image`          | The link preview: claim, People's Pulse, evidence status. Never the screenshot                                               |
| `/api/pulse/check`                       | GET shelves · POST publish                                                                                                   |
| `/api/pulse/check/analyse`               | Read a claim's own words (rules, nothing fetched)                                                                            |
| `/api/pulse/check/read`                  | Open one public page: `as: "origin"` (where it was seen) or `"evidence"`                                                     |
| `/api/pulse/check/<id>/correct`          | A correction, by the browser that published                                                                                  |
| `/api/pulse/check/<id>/posts`            | The discussion: GET, POST                                                                                                    |
| `/api/pulse/check/posts/<post>/report`   | Report a post; three different browsers hide it                                                                              |
| `/api/pulse/check/<id>/file`             | The screenshot: its publisher's browser or a Passport administrator only                                                     |
| `/api/pulse/check/event`                 | Aggregate visit (by kind of referring site) and share (by channel) counts                                                    |
| `/api/pulse/check/admin`, `/admin/pulse` | Moderation: reported posts, moderator notes, visit and share counts                                                          |

## How the brief is met

| Brief                   | Built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2. Submit               | Link (read when it can be: a news page's headline can become the claim; Facebook, Instagram, X, TikTok, Threads and LinkedIn are never fetched, and the page says why), screenshot or photo (`accept="image/*"`, so a phone offers its camera), the claim typed or pasted, where it was seen, and **Why are you asking?** kept apart from the claim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| — uploads               | Re-drawn on the phone to ≤1600 px JPEG (which drops camera, time and GPS metadata), ≤1.5 MB; the server checks the bytes are a JPEG, PNG or WebP (never a name or a declared type) and the size. Stored in its own closed table, served only to the publisher's browser or an administrator, `private, no-store`, `nosniff`, sandboxed CSP. Never on the public page, never in a preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 3. Investigate          | The claim read by rules (`analyseClaim`): figures, dates, places, organisations, key terms, whether it seems to name a person. Questions a careful reader would ask (`missingContext`) — each one a question, never an answer. **Where to look**: searches of the publisher's own site by topic (Interior Health, BC Gov News, CIHI, StatCan, CMHC, Elections Canada / BC, Environment Canada, news), labelled "places to look, not evidence".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| — evidence              | Every source is a page the **server opened itself** (the V2 source check's safe fetcher: https only, private addresses refused at connection time, redirects re-checked, 7 s, 900 KB). Title, publisher, the date the page declares, the date it was read, and sentences copied word for word that state the claim's figures or use its words, plus whether the claim's figure appears at all. The result is **sealed** (HMAC); publish refuses any source it didn't read, so no excerpt can be invented in the browser.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| — assessment            | SUPPORTED · PARTIALLY SUPPORTED · CONTRADICTED · INSUFFICIENT EVIDENCE · OUTDATED. The rules suggest one from how the asker placed the sources (supports / contradicts / context). The asker chooses, but each verdict needs a source of its own kind (`assessmentProblem`, checked again on the server): nothing is "contradicted" without a contradicting source; OUTDATED needs the asker's explanation. No sources = INSUFFICIENT EVIDENCE.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| — honesty               | Every page says **Not independently verified**, who assessed it and from how many sources, what the rules alone would say if different, and its limits: no automatic web search; the original post wasn't opened if it's on a walled platform; a screenshot hasn't been checked against the post; figures in charts or PDFs can't be read. **No AI** is used anywhere in Pulse Check.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4. Public page          | Claim headline (quoted), why they asked, the assessment, supporting / contradicting / context sources, still-unanswered questions, what the claim states, limits, investigation and correction dates, the community poll, the discussion, correction history, Look for yourself, report. Readable without an account; writes need the device cookie, a signed and aged token, rate limits and the database caps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5. Sharing              | **COPY LINK**, **COPY COMMENT** (the brief's text exactly, with the link, editable before copying, "Start the comment over"), **SHARE** (the phone's share sheet; Facebook's sharer where there is none), and Facebook / WhatsApp / X / Text / Email under "More ways". Nothing is ever posted for anyone. The link carries the sharer's referral code (`?c=`), so My Circle works unchanged. Open Graph and Twitter cards: "Is this true? “claim”", the status "so far", People's Pulse branding, a generated image.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6. Participation        | Three question types: **Fact check** (What does the evidence support? — holds up / partly / wrong / Unsure), **Opinion** (the asker's own question and answers, "Unsure" added), **Experience** (does this match what you've seen? — with Unsure). Votes are People's Pulse's own. The page keeps **Evidence**, **Public opinion** and the **discussion** in separately labelled sections; "Votes … never decide whether the claim is true", and no vote count touches the assessment (tested). Discussion posts are typed: personal experiences, questions, opinions, suggested sources — each in its own list, each saying it is not evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 7. Discovery and growth | `/check` shelves, each saying how it is ordered: Trending (votes + 2 × posts in a day, at least 3), Recent, Most discussed, Recently updated evidence; a province filter on where the **claim** is about, never where anyone is. Pulse Check is linked from the People's Pulse hub. Aggregate metrics: visits by kind of referring site (facebook, x, messaging, search, direct…), shares by channel (copy-comment, copy-link, native…), plus new checks and votes in the existing Usage panel as the "Pulse Check" kind. No referrer URL, device or check is recorded with a count.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 8. Trust and safety     | Four confirmations before publishing (claim as said; about a public body, figure or statement, not a private person; no personal details, health information or private messages; this is my reading, not verification). A warning when the claim seems to name a person. V1's text checks (emails, phones, addresses, postal codes, slurs, threats) on every field, plus a check for other people's medical details (diagnoses, overdose, HIV…) in reasons and posts — and in a claim only when it names a person, so a public health statistic can still be checked. Duplicates: similar earlier checks are shown before investigating ("Someone may have checked this already"); a figure that differs is not a duplicate. Reports on the check (V1's: three pause it) and on posts (three hide one); `/admin/pulse` shows, hides or removes posts and adds public moderator notes. Corrections: the publisher's browser adds sources, changes the assessment (same rules) or says what changed; each is appended to a public, dated history; nothing published is rewritten silently. Manipulated screenshots: never shown, never evidence, and the limits say so. |
| 9. Phones               | Built at 390 px first; one-thumb steps, 44 px+ targets, no sideways scroll (asserted on every screen in the e2e).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## What is stored

See the header of `supabase/migrations/20261120000000_passport_pulse_check.sql`.
No name, email, account, raw IP, user agent or referrer address. Device and
network appear only as keyed one-way hashes, as in V1.

## Verification

- Unit: `npx vitest run src/lib/pulse` — `check.test.ts` (claim reading,
  evidence excerpts, seals, assessment rules, limits, text safety, comment,
  slugs, duplicates, referrer kinds, image sniffing) and `checkService.test.ts`
  (publish, forged sources refused, verdict rules, confirmations, private
  file, opinion polls, votes don't move the assessment, duplicates,
  corrections and their history, discussion, limits, reports, shelves).
- Real Postgres + PostgREST through the anon key (V1's stack recipe, then
  apply `20261120000000_passport_pulse_check.sql`, twice):
  `src/lib/pulse/checkStore.stack.test.ts` — 6/6, including the tables being
  closed to the anon key and the file function refusing a wrong key.
- Phones end to end: `e2e/pulse-check.spec.ts` (6 scenarios) against a build
  on that stack. **Needs internet**: the evidence is three real news articles
  read by the server. The form refuses anything sent within 2.5 s of opening
  it, so the spec pauses like a person before publishing.
- Screenshots (390 px, from the e2e run): `screenshots/check-*.png`.

## Rollback

App side: the code. Database side (SQL editor, kept out of the migration):

```
drop function if exists public.passport_pulse_check_usage(text, int),
  public.passport_pulse_check_count(text, text, text),
  public.passport_pulse_post_set_status(text, text, text),
  public.passport_pulse_posts_reported(text),
  public.passport_pulse_post_report(text, text, text, text, int),
  public.passport_pulse_posts(text, text, text),
  public.passport_pulse_post_add(text, text, text, text, text, text, text, text, int, int),
  public.passport_pulse_check_list(text, int),
  public.passport_pulse_check_file(text, text),
  public.passport_pulse_check_update(text, text, jsonb, int, text, boolean),
  public.passport_pulse_check_is_creator(text, text, text),
  public.passport_pulse_check_get(text, text),
  public.passport_pulse_check_create(text, text, jsonb, timestamptz, text, text, int, text, jsonb, text, text, text);
drop table if exists public.passport_pulse_check_events, public.passport_pulse_post_reports,
  public.passport_pulse_posts, public.passport_pulse_check_files, public.passport_pulse_checks;
```

Check polls remain as ordinary Pulses of kind `check`; remove them from
`/admin/pulse` if wanted.

## Known limitations

- **No automatic search.** There is no search API key here and none was
  added; "Where to look" opens the person's own search of a publisher's
  site. An automated search (and AI reading of results) is the most valuable
  next step and needs an owner decision on the service and its cost.
- No text is read from screenshots (no OCR); the asker types the claim.
- Only https HTML pages can be evidence; PDFs and figures in charts or images
  are not read.
- Corrections need the publishing browser (there is no account); a lost
  cookie means only a moderator can add notes.
- The rules for the assessment check that a verdict has a source of its kind;
  they cannot check that the asker placed a source honestly. That is what
  "Not independently verified", reports and moderation are for.
- One vote per browser, not per person (V1).
- Referral source is the browser's referrer, which many apps strip; those
  visits count as "direct".
