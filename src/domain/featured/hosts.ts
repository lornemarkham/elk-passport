/**
 * **Featured hosts and experiences** — the owner's brief, 2026-11-08 (P7):
 * tasteful featured placements in Discovery, ELK Lark first, room for more,
 * sponsored placements clearly marked, and nothing invented.
 *
 * Gold Bank GB-2026-10-11-030 (Lorne: _"go have a day sends people to elk
 * lark :) to do fun real non digital activities with the best host Uncle
 * Lorne"_) says ELK Lark is a host **like any other**: no special hardcoded
 * treatment. So this is a list, and ELK Lark is an entry in it — the card,
 * the placement and the label are the same for every host.
 *
 * ## What an entry may say
 *
 * Only what is true without a calendar: who the host is and what kind of
 * thing they do. **No dates, prices, availability or bookings** — there is
 * no host or booking model behind this yet, and a featured card that
 * promised a Saturday nobody scheduled would be exactly the fabrication the
 * brief forbids. When a host's real experiences exist as Atlas records,
 * they are found and saved like anything else.
 *
 * ## Why it is labelled
 *
 * `relationship` is said on the card, always. `ours` is a host Go Have a Day
 * itself runs or belongs with; `sponsored` is a paid placement and says
 * _Sponsored_. A featured card that did not say why it is there would be an
 * ad pretending to be a recommendation.
 */
export interface FeaturedHost {
  readonly id: string;
  readonly name: string;
  /** Who hosts it, in a person's words. */
  readonly host: string;
  /** One line: what a day with them is like. No dates, no prices. */
  readonly line: string;
  /** The kinds of thing they do — words, not Atlas activities. */
  readonly doing: readonly string[];
  /** Why it is featured, said on the card. */
  readonly relationship: "ours" | "sponsored";
  /** Where the card leads. Absent means there is nowhere honest to send people yet. */
  readonly href?: string;
  /** Words for that link. */
  readonly cta?: string;
}

export const FEATURED_HOSTS: readonly FeaturedHost[] = [
  {
    id: "elk-lark",
    name: "ELK Lark",
    host: "Uncle Lorne",
    line: "Real days, off the screen: getting outside, building things, learning a skill with your hands — hosted by the best host going.",
    doing: ["Outdoor adventures", "Building & making", "Hands-on skills"],
    relationship: "ours",
    // GB-2026-10-11-029 records elklark.com as presenting retreats and
    // accommodation, and the brief says to position ELK Lark as adventures,
    // not a B&B — so the card does not send people there. Where it should
    // lead is an open question for the owner; until then it says who the
    // host is and leads nowhere it cannot stand behind.
    href: "/about",
    cta: "Meet the family",
  },
];

/** The label a featured card carries, so nobody mistakes why it is there. */
export const disclosure = (host: FeaturedHost) =>
  host.relationship === "sponsored"
    ? "Sponsored"
    : "Featured · from the Go Have a Day family";
