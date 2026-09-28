import { describe, expect, it } from "vitest";
import {
  actionsFor,
  composedFactSections,
  factSections,
  headingWorthPrinting,
  looksLikeProse,
  officialSite,
  splitFactsByShape,
  urlIn,
  whenSummary,
  whereLine,
} from "./detailComposition";
import type { SubjectPageView } from "@/lib/passport/subjectPage";

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
