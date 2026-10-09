import { describe, expect, it } from "vitest";
import {
  actionsFor,
  composedFactSections,
  factSections,
  groupByLabel,
  headingWorthPrinting,
  looksLikeProse,
  officialSite,
  splitFactsByShape,
  splitGroupsByShape,
  tidyValue,
  urlIn,
  whenSummary,
  whereLine,
} from "./detailComposition";
import type {
  SubjectFactView,
  SubjectPageView,
} from "@/lib/passport/subjectPage";

/**
 * A detail page may say less than Atlas knows. It may never say more.
 *
 * Every section here is capability-detected: it exists because the evidence
 * for it does. Nothing branches on kind, title, publisher or id.
 */

const view = (over: Partial<SubjectPageView>): SubjectPageView =>
  ({
    subject: {
      id: "s1",
      kind: "Experience",
      name: "A thing",
      description: "",
      facts: [],
      claims: [],
      days: [],
    },
    offerings: [],
    parts: [],
    sources: [],
    ...over,
  }) as SubjectPageView;

describe("urls a publisher printed", () => {
  it("finds one inside a sentence and drops the sentence's punctuation", () => {
    expect(
      urlIn("Get your tickets now ONLY at: https://fos.example/buy."),
    ).toBe("https://fos.example/buy");
    expect(urlIn("No link here")).toBeUndefined();
  });

  it("prefers the publisher's root over its deeper pages", () => {
    const v = view({
      sources: [
        {
          id: "a",
          url: "https://x.example/buy",
          sourceType: "official-website",
        },
        { id: "b", url: "https://x.example/", sourceType: "official-website" },
      ],
    } as Partial<SubjectPageView>);
    expect(officialSite(v)).toBe("https://x.example/");
  });

  it("never treats a tourism listing as the official site", () => {
    const v = view({
      sources: [
        {
          id: "a",
          url: "https://tourism.example/e/1",
          sourceType: "tourism-authority",
        },
      ],
    } as Partial<SubjectPageView>);
    expect(officialSite(v)).toBeUndefined();
  });
});

describe("actions", () => {
  it("offers nothing when the publisher published nothing", () => {
    expect(actionsFor(view({}))).toEqual([]);
  });

  it("carries a quoted link under the publisher's own label", () => {
    const v = view({
      subject: {
        ...view({}).subject,
        facts: [
          { label: "Tickets", value: "Only at: https://fos.example/buy" },
        ],
      },
    } as Partial<SubjectPageView>);
    const tickets = actionsFor(v).find((a) => a.kind === "tickets");
    expect(tickets?.label).toBe("Tickets");
    expect(tickets?.href).toBe("https://fos.example/buy");
  });

  it("builds directions only from a stated place, never from nothing", () => {
    expect(actionsFor(view({})).some((a) => a.kind === "directions")).toBe(
      false,
    );
    const v = view({
      subject: { ...view({}).subject, address: "9380 Hwy 97, Vernon" },
    } as Partial<SubjectPageView>);
    const directions = actionsFor(v).find((a) => a.kind === "directions");
    expect(directions?.href).toContain(
      encodeURIComponent("9380 Hwy 97, Vernon"),
    );
  });

  it("prefers a resolved venue over the subject's own address line", () => {
    const v = view({
      subject: { ...view({}).subject, address: "Head office, Kelowna" },
      venue: { ...view({}).subject, id: "v", name: "Hillcrest Farm Market" },
    } as Partial<SubjectPageView>);
    expect(whereLine(v)).toContain("Hillcrest Farm Market");
    expect(whereLine(v)).not.toContain("Head office");
  });
});

describe("fact sections", () => {
  const facts = [
    { label: "A", value: "one", category: "Before you go" },
    { label: "B", value: "two", category: "Before you go" },
    { label: "C", value: "three", category: "On the night" },
  ];

  it("uses the publisher's own headings when the source had them", () => {
    const v = view({
      subject: { ...view({}).subject, facts },
    } as Partial<SubjectPageView>);
    const sections = factSections(v);
    expect(sections.map((s) => s.title)).toEqual([
      "Before you go",
      "On the night",
    ]);
    expect(sections[0]!.facts).toHaveLength(2);
  });

  it("invents no headings when the source marked none", () => {
    const v = view({
      subject: {
        ...view({}).subject,
        facts: [{ label: "A", value: "one" }],
      },
    } as Partial<SubjectPageView>);
    const sections = factSections(v);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.title).toBeUndefined();
  });

  it("drops a fact that was nothing but a link already shown as a button", () => {
    const v = view({
      subject: {
        ...view({}).subject,
        facts: [{ label: "Tickets", value: "https://x.example/buy" }],
      },
    } as Partial<SubjectPageView>);
    expect(factSections(v, actionsFor(v))).toEqual([]);
  });

  it("keeps a fact whose sentence says more than its link", () => {
    const v = view({
      subject: {
        ...view({}).subject,
        facts: [
          {
            label: "Tickets",
            value:
              "Door sales until 9:30 on Fridays and Saturdays, otherwise https://x.example/buy",
          },
        ],
      },
    } as Partial<SubjectPageView>);
    expect(factSections(v, actionsFor(v))[0]!.facts).toHaveLength(1);
  });
});

describe("when", () => {
  it("answers from the parts when the whole holds no dates of its own", () => {
    const v = view({
      parts: [
        { ...view({}).subject, id: "p1", days: ["2026-10-16", "2026-10-31"] },
      ],
    } as Partial<SubjectPageView>);
    expect(whenSummary(v).days).toEqual(["2026-10-16", "2026-10-31"]);
  });

  it("does not count the ends of a continuous run as two dates", () => {
    const v = view({
      subject: {
        ...view({}).subject,
        days: ["2026-09-25", "2026-11-01"],
        claims: [
          { id: "c", shape: "fixed-window", days: [], supportingPassage: "" },
        ],
      },
    } as Partial<SubjectPageView>);
    expect(whenSummary(v).isRange).toBe(true);
  });

  it("does count a list of discrete nights", () => {
    const v = view({
      subject: {
        ...view({}).subject,
        days: ["2026-10-16", "2026-10-17"],
        claims: [
          { id: "c", shape: "discrete-dates", days: [], supportingPassage: "" },
        ],
      },
    } as Partial<SubjectPageView>);
    expect(whenSummary(v).isRange).toBe(false);
  });
});

describe("the shape of a value, not the name of its label", () => {
  it("reads a paragraph as prose and a row as a row", () => {
    // Both of these are real, and both are labelled by their publisher in a
    // way that says nothing about which is which.
    expect(
      looksLikeProse(
        "Roasters will be submitting varieties of coffee into the OK COFFEE FEST AWARDS. These coffees will be blind tasted by a panel of judges and the winning roasters will be able to slap that accolade on their packaging.",
      ),
    ).toBe(true);
    expect(looksLikeProse("$20.00")).toBe(false);
    expect(looksLikeProse("Laurel Packing House in Kelowna BC")).toBe(false);
  });

  it("does not mistake a long table or a list of nights for writing", () => {
    expect(
      looksLikeProse(
        "$15.00 | 2 & under: Free | Group Rates Available | Season passes available at the gate for $40.00 each night of the run",
      ),
    ).toBe(false);
    expect(
      looksLikeProse(
        "Sat • October 3, 2026 • 12:00 PM\nSun • October 4, 2026 • 12:00 PM\nFri • October 9, 2026 • 12:00 PM\nSat • October 10, 2026 • 12:00 PM",
      ),
    ).toBe(false);
  });

  it("splits a section into what is read and what is scanned", () => {
    const facts = [
      { label: "Per person", value: "$5.00" },
      {
        label: "Summary",
        value:
          "We are thrilled to welcome Honeybear, the Band to our stage on Saturday for a night of vintage soul, blues and roots music played the way it was first recorded.",
      },
    ];
    const { prose, details } = splitFactsByShape(facts as never);
    expect(prose.map((f) => f.label)).toEqual(["Summary"]);
    expect(details.map((f) => f.label)).toEqual(["Per person"]);
  });
});

describe("a heading has to organise something", () => {
  it("drops a heading that only repeats the subject's own name", () => {
    expect(
      headingWorthPrinting(
        "Haunted Halloween Trail at Sagebrush Ranch",
        "Haunted Halloween Trail at Sagebrush Ranch",
      ),
    ).toBeUndefined();
  });

  it("drops a heading that is the sentence the fact under it already says", () => {
    // Caravan Farm Theatre puts one sentence over one fact, so the page
    // printed it twice at two weights.
    expect(
      headingWorthPrinting(
        "Shows nightly at 5 pm & 7 pm. No shows Mondays & Tuesdays.",
        "The Fall of the House of Usher",
        [
          {
            label: "Shows",
            value: "Shows nightly at 5 pm & 7 pm. No shows Mondays & Tuesdays.",
          },
        ] as never,
      ),
    ).toBeUndefined();
  });

  it("drops a heading that is the label of the row under it", () => {
    expect(
      headingWorthPrinting("Date", "The Fall of the House of Usher", [
        { label: "Date", value: "Sep 23 - Oct 4, 2026" },
      ] as never),
    ).toBeUndefined();
  });

  it("keeps a heading that organises facts it does not restate", () => {
    expect(
      headingWorthPrinting(
        "Eight nights only",
        "The Black Mountain Haunted House",
        [
          { label: "Pick your night", value: "Fri, Oct 16 6pm to 10pm" },
        ] as never,
      ),
    ).toBe("Eight nights only");
  });

  it("keeps a heading the publisher actually wrote", () => {
    expect(
      headingWorthPrinting(
        "Eight nights only",
        "The Black Mountain Haunted House",
      ),
    ).toBe("Eight nights only");
    expect(headingWorthPrinting(undefined, "Anything")).toBeUndefined();
  });
});

describe("what an October page prints, and what it says it held back", () => {
  const sockeye = view({
    subject: {
      id: "sockeye",
      kind: "Event",
      name: "2026 Salute to the Sockeye Festival",
      subtype: "Special Events",
      description:
        "A festival celebrating the dominant spawn of the Sockeye Salmon.",
      startTime: "2026-10-09T17:00:00.000Z",
      endTime: "2026-10-25T23:30:00.000Z",
      timePrecision: "minute",
      facts: [
        { label: "Start", value: "October 9 @ 10:00 am", category: "Details" },
        { label: "End", value: "October 25 @ 4:30 pm", category: "Details" },
        {
          label: "Event Category",
          value: "Special Events",
          category: "Details",
        },
        {
          label: "What happens",
          value:
            "Interpretive guided tours run every day of the festival, and First Nations ceremonies open and close it. Volunteers walk the trails with visitors and explain what they are looking at.",
          category: "Details",
        },
      ],
      claims: [],
      days: [],
    },
  } as never);

  const built = composedFactSections(sockeye, []);

  it("holds back a date the interval above already states, even with no year on it", () => {
    // `October 9 @ 10:00 am` says nothing the rendered interval does not, and
    // its year is only knowable from the interval itself.
    const held = built.hidden.map((f) => f.label);
    expect(held).toContain("Start");
    expect(held).toContain("End");
  });

  it("keeps a sentence that merely contains the kind word", () => {
    // "Rave" is inside this, and it is the only thing anybody wrote about the
    // night. An eyebrow matches by equality or not at all.
    const shrek = view({
      subject: {
        id: "shrek",
        kind: "Event",
        name: "Shrek Rave Swamp-O-Ween",
        subtype: "Rave",
        description:
          "A fun event where attendees can unleash their inner ogre.",
        facts: [
          {
            label: "Summary",
            value:
              "SHREK RAVE RETURNS! Unleash your inner ogre this fall! IT'S DUMB, JUST COME HAVE FUN. WHO CARES. COOL IS DEAD.",
          },
        ],
        claims: [],
        days: [],
      },
    } as never);
    const { sections, hidden } = composedFactSections(shrek, []);
    expect(hidden).toEqual([]);
    expect(sections[0]!.details.map((f) => f.label)).toEqual(["Summary"]);
  });

  it("holds back a fact that restates the kind printed above the title", () => {
    expect(built.hidden.map((f) => f.label)).toContain("Event Category");
  });

  it("keeps everything else, and says which rule held each one back", () => {
    const printed = built.sections.flatMap((s) => [
      ...s.prose.map((f) => f.label),
      ...s.details.map((f) => f.label),
    ]);
    expect(printed).toEqual(["What happens"]);
    expect(built.sections[0]!.prose.map((f) => f.label)).toEqual([
      "What happens",
    ]);
    for (const fact of built.hidden) expect(fact.rule).toBeTruthy();
  });
});

/**
 * **A label repeated down a list is one heading.**
 *
 * Grizzli Winery's Fall Fest holds four facts labelled *Music & Activity
 * Schedule* and four labelled *What to Expect* — a publisher writing a
 * programme repeats the heading beside each line. Printed back one-for-one,
 * production showed eight headings for eight single lines.
 */
describe("grouping rows that share a label", () => {
  const fact = (label: string, value: string) =>
    ({ label, value }) as SubjectFactView;

  it("says a repeated label once, with every value under it", () => {
    const groups = groupByLabel([
      fact("Music & Activity Schedule", "2:00 PM – Market opens"),
      fact("Music & Activity Schedule", "2:15–2:45 PM – Laila Moriarity live"),
      fact("Music & Activity Schedule", "3:15–5:15 PM – Poppa Dawg live"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBe("Music & Activity Schedule");
    expect(groups[0]!.values).toHaveLength(3);
  });

  it("leaves a label that happens once exactly as it was", () => {
    const groups = groupByLabel([
      fact("Registration Deadline", "Friday, October 2"),
      fact("Adult Category Entry Fee", "$25"),
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      "Registration Deadline",
      "Adult Category Entry Fee",
    ]);
    expect(groups.every((g) => g.values.length === 1)).toBe(true);
  });

  it("keeps two separated runs of one label apart", () => {
    // Order is Atlas's, and Atlas's order is the order the page was read in.
    // Merging across a gap would rearrange the source rather than present it.
    const groups = groupByLabel([
      fact("Note", "first"),
      fact("Price", "$10"),
      fact("Note", "second"),
    ]);
    expect(groups).toHaveLength(3);
  });

  it("preserves the order the publisher wrote", () => {
    const groups = groupByLabel([
      fact("What to Expect", "Local Vendor Market"),
      fact("What to Expect", "Live Music"),
    ]);
    expect(groups[0]!.values).toEqual(["Local Vendor Market", "Live Music"]);
  });
});

/**
 * **A value that says the same fragment twice says it once.**
 *
 * Presentation only — nothing is written back to Atlas, which keeps exactly
 * what the publisher's structured data contained.
 */
describe("tidying a value that repeats itself", () => {
  it("collapses an address that stutters", () => {
    expect(
      tidyValue("2550 Boucherie Rd, 2550 Boucherie Rd, Kelowna, BC V1Z 2E6"),
    ).toBe("2550 Boucherie Rd, Kelowna, BC V1Z 2E6");
  });

  it("ignores case and spacing when deciding it is the same fragment", () => {
    expect(tidyValue("Kelowna,  kelowna, BC")).toBe("Kelowna, BC");
  });

  it("leaves a repeat that is not adjacent alone", () => {
    // `Main St, Penticton, Main St` is two things said about one place, and a
    // rule that collapsed it would be guessing which to keep.
    expect(tidyValue("Main St, Penticton, Main St")).toBe(
      "Main St, Penticton, Main St",
    );
  });

  it("does not touch a value with nothing repeated", () => {
    const v = "421 Cawston Avenue, Kelowna, BC, V1Y 6Z1";
    expect(tidyValue(v)).toBe(v);
  });

  it("does not touch a value with no commas at all", () => {
    expect(tidyValue("Doors at 7")).toBe("Doors at 7");
  });
});

/**
 * **A run of one label must not be torn across the two blocks.**
 *
 * Grizzli's four *What to Expect* lines include one long enough to read as
 * prose. Splitting prose from rows before grouping sent that one to the
 * paragraph block and the other three to the row list — so the label printed
 * twice, in the wrong order, on a page already criticised for repeating it.
 */
describe("grouping before splitting by shape", () => {
  const fact = (label: string, value: string) =>
    ({ label, value }) as SubjectFactView;

  const expectations = [
    fact(
      "What to Expect",
      "Local Vendor Market – Shop unique handmade goods and fall favourites.",
    ),
    fact(
      "What to Expect",
      "Family Fun – Colouring and crafts, face painting, lawn games, apple bobbing, s’mores, a Thankful Tree, and a fall photo corner for the whole family to enjoy together.",
    ),
  ];

  it("keeps one label in one place", () => {
    const { prose, details } = splitGroupsByShape(groupByLabel(expectations));
    const labels = [...prose, ...details].map((g) => g.label);
    expect(labels).toEqual(["What to Expect"]);
  });

  it("sends the whole group where its longest member belongs", () => {
    // A paragraph squeezed into a two-column row list is the worse mistake.
    const { prose, details } = splitGroupsByShape(groupByLabel(expectations));
    expect(prose).toHaveLength(1);
    expect(prose[0]!.values).toHaveLength(2);
    expect(details).toHaveLength(0);
  });

  it("keeps the publisher's order inside the group", () => {
    const { prose } = splitGroupsByShape(groupByLabel(expectations));
    expect(prose[0]!.values[0]).toContain("Local Vendor Market");
    expect(prose[0]!.values[1]).toContain("Family Fun");
  });

  it("still sends short labelled rows to the row list", () => {
    const { prose, details } = splitGroupsByShape(
      groupByLabel([
        fact("Adult Category Entry Fee", "$25"),
        fact("Youth Category Entry Fee", "FREE"),
      ]),
    );
    expect(prose).toHaveLength(0);
    expect(details.map((g) => g.label)).toEqual([
      "Adult Category Entry Fee",
      "Youth Category Entry Fee",
    ]);
  });
});
