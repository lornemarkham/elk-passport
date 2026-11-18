import { describe, expect, it } from "vitest";
import {
  analyseClaim,
  assessmentProblem,
  evidenceExcerpts,
  fingerprint,
  idFromSlug,
  limitations,
  makeSlug,
  missingContext,
  publicTextProblem,
  similarity,
  sniffImage,
  suggestAssessment,
  suggestedComment,
  visitSource,
  walledPlatform,
  whereToCheck,
  type CheckSource,
} from "./check";
import { openSource, sealSource } from "./checkSeal";
import { sentences } from "./sourceCheck";

const KGH = "Kelowna General Hospital is operating at 147% capacity.";
const now = new Date("2026-11-18T18:00:00Z");

describe("reading a claim", () => {
  it("finds the figure, the organisation, the place and the key term", () => {
    const p = analyseClaim(KGH);
    expect(p.figures).toContain("147%");
    expect(p.organisations.join(" ")).toMatch(/Kelowna General Hospital/);
    expect(p.places).toContain("Kelowna");
    expect(p.terms).toContain("capacity");
    expect(p.namesPerson).toBe(false);
    expect(analyseClaim("Is this real? (g46k)").figures).toEqual([]);
  });

  it("asks what a careful reader would, without answering", () => {
    const p = analyseClaim(KGH);
    const q = missingContext(KGH, p, "screenshot", false);
    expect(q.join(" ")).toMatch(/When was this measured/);
    expect(q.join(" ")).toMatch(/Who measured or reported/);
    expect(q.join(" ")).toMatch(/percentage of what/i);
    expect(q.join(" ")).toMatch(/Capacity of what/);
    expect(q.join(" ")).toMatch(/screenshot/i);
    // Every one is a question.
    for (const line of q) expect(line).toMatch(/\?/);
  });

  it("notices dates and a reported source", () => {
    const text =
      "According to Interior Health, Vernon Jubilee had 60 patients in hallways on November 3, 2026.";
    const p = analyseClaim(text);
    expect(p.dates.join(" ")).toMatch(/November 3, 2026/);
    const q = missingContext(text, p, "text", false);
    expect(q.join(" ")).not.toMatch(/When was this measured/);
    expect(q.join(" ")).not.toMatch(/Who measured/);
  });

  it("flags a claim that seems to be about a person", () => {
    expect(
      analyseClaim("John Smith stole money from the food bank.").namesPerson,
    ).toBe(true);
    expect(analyseClaim(KGH).namesPerson).toBe(false);
  });

  it("points at where to look, as searches, never as evidence", () => {
    const leads = whereToCheck(KGH, analyseClaim(KGH), {
      kind: "province",
      province: "BC",
    });
    expect(leads.map((l) => l.name)).toContain("Interior Health");
    expect(leads.map((l) => l.name)).toContain(
      "Canadian Institute for Health Information",
    );
    for (const l of leads)
      expect(l.url).toMatch(/^https:\/\/(www|news)\.google\.com\/search\?q=/);
  });
});

describe("evidence", () => {
  const page = sentences(
    "Interior Health publishes daily occupancy. On November 14, Kelowna General Hospital was at 147 per cent of its funded capacity. Funded beds are the beds the hospital is paid to staff. The hospital opened 30 overflow beds. Parking is free on weekends for visitors.",
  );

  it("copies the sentences that state the figure, word for word", () => {
    const r = evidenceExcerpts(page, analyseClaim(KGH), KGH);
    expect(r.figureFound).toBe(true);
    expect(r.excerpts[0]).toBe(
      "On November 14, Kelowna General Hospital was at 147 per cent of its funded capacity.",
    );
    expect(r.excerpts.join(" ")).not.toMatch(/Parking/);
    for (const e of r.excerpts) expect(page).toContain(e);
  });

  it("says when the figure is not on the page", () => {
    const r = evidenceExcerpts(
      sentences(
        "Kelowna General Hospital is the largest hospital in the Interior region of the province.",
      ),
      analyseClaim(KGH),
      KGH,
    );
    expect(r.figureFound).toBe(false);
  });

  it("seals what the server read, so nobody can hand in words a page never said", () => {
    const s: CheckSource = {
      url: "https://www.interiorhealth.ca/x",
      title: "Occupancy",
      site: "Interior Health",
      published: "2026-11-14",
      readAt: now.toISOString(),
      excerpts: ["At 147 per cent."],
      figureFound: true,
    };
    const sealed = sealSource("k".repeat(32), s);
    expect(openSource("k".repeat(32), sealed)).toEqual(s);
    expect(openSource("other-key-000000000000000000", sealed)).toBeNull();
    const [body, sig] = sealed.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...s, excerpts: ["At 300 per cent."] }),
    ).toString("base64url");
    expect(openSource("k".repeat(32), `${forged}.${sig}`)).toBeNull();
    expect(openSource("k".repeat(32), `${body}.x`)).toBeNull();
    expect(openSource("k".repeat(32), 42)).toBeNull();
  });
});

describe("the assessment", () => {
  it("suggests from how sources were placed", () => {
    expect(suggestAssessment([], now)).toBe("insufficient");
    expect(
      suggestAssessment([{ stance: "context", published: null }], now),
    ).toBe("insufficient");
    expect(
      suggestAssessment([{ stance: "supports", published: "2026-11-01" }], now),
    ).toBe("supported");
    expect(
      suggestAssessment([{ stance: "contradicts", published: null }], now),
    ).toBe("contradicted");
    expect(
      suggestAssessment(
        [
          { stance: "supports", published: null },
          { stance: "contradicts", published: null },
        ],
        now,
      ),
    ).toBe("partly");
    expect(
      suggestAssessment([{ stance: "supports", published: "2023-01-10" }], now),
    ).toBe("outdated");
  });

  it("needs evidence of its own kind", () => {
    expect(assessmentProblem("insufficient", [], null)).toBeNull();
    expect(assessmentProblem("supported", [], null)).toMatch(
      /at least one source that supports/,
    );
    expect(
      assessmentProblem("contradicted", [{ stance: "supports" }], null),
    ).toMatch(/contradicts/);
    expect(
      assessmentProblem(
        "supported",
        [{ stance: "supports" }, { stance: "contradicts" }],
        null,
      ),
    ).toMatch(/Partially/);
    expect(
      assessmentProblem("contradicted", [{ stance: "contradicts" }], null),
    ).toBeNull();
    expect(
      assessmentProblem("outdated", [{ stance: "context" }], null),
    ).toMatch(/own words/);
    expect(
      assessmentProblem(
        "outdated",
        [{ stance: "context" }],
        "New figures since.",
      ),
    ).toBeNull();
  });

  it("always states its limits", () => {
    const l = limitations({
      claim: {
        text: KGH,
        form: "screenshot",
        seenOn: "facebook",
        url: "https://www.facebook.com/p/1",
        pageTitle: null,
      },
      sources: [],
      hasFile: true,
    });
    expect(l.join(" ")).toMatch(/no automatic web search/);
    expect(l.join(" ")).toMatch(/not independent verification/);
    expect(l.join(" ")).toMatch(/No source has been added/);
    expect(l.join(" ")).toMatch(/Facebook doesn't let us read posts/);
    expect(l.join(" ")).toMatch(/cropped or edited/);
  });
});

describe("what a visitor may write", () => {
  it("refuses personal details, attacks and other people's health details", () => {
    expect(publicTextProblem("Call me at 250-555-0199")).toMatch(
      /personal details/,
    );
    expect(publicTextProblem("My neighbour was diagnosed with cancer")).toMatch(
      /medical details/,
    );
    expect(
      publicTextProblem("I waited nine hours in emergency on Tuesday."),
    ).toBeNull();
    // A public health statistic is allowed in a claim when no person is named.
    expect(
      publicTextProblem("HIV cases in BC rose 20% in 2025", { health: false }),
    ).toBeNull();
  });
});

describe("sharing", () => {
  it("suggests the brief's comment, with the link", () => {
    const c = suggestedComment("https://x.test/check/a-k3m9xq2p");
    expect(c).toBe(
      "🤔 Is this true?\n\nI came across this claim and wanted to know what the evidence actually says.\n\n🔎 Check the sources and have your say on People's Pulse:\n\nhttps://x.test/check/a-k3m9xq2p",
    );
  });

  it("makes a readable permanent slug that ends in the id", () => {
    const slug = makeSlug(KGH, "k3m9xq2p");
    expect(slug).toBe(
      "kelowna-general-hospital-is-operating-at-147-capacity-k3m9xq2p",
    );
    expect(slug).toMatch(/^[a-z0-9-]{8,80}$/);
    expect(idFromSlug(slug)).toBe("k3m9xq2p");
    expect(idFromSlug("k3m9xq2p")).toBe("k3m9xq2p");
    expect(idFromSlug("nope")).toBeNull();
    expect(makeSlug("¿¿??", "k3m9xq2p")).toBe("k3m9xq2p");
    expect(makeSlug("a ".repeat(200), "k3m9xq2p").length).toBeLessThanOrEqual(
      80,
    );
  });

  it("spots the same claim asked twice, but not a different figure", () => {
    expect(
      similarity(
        KGH,
        "Is Kelowna General Hospital operating at 147% capacity?",
      ),
    ).toBeGreaterThan(0.6);
    expect(
      similarity(
        KGH,
        "Kelowna General Hospital is operating at 120% capacity.",
      ),
    ).toBe(0);
    expect(fingerprint("The  Cat sat")).toBe("cat sat the");
  });

  it("names the kind of place a visit came from, never the address", () => {
    expect(visitSource("https://l.facebook.com/l.php?u=x", "p.test")).toBe(
      "facebook",
    );
    expect(visitSource("https://m.facebook.com/", "p.test")).toBe("facebook");
    expect(visitSource("https://t.co/abc", "p.test")).toBe("x");
    expect(visitSource("https://www.google.com/", "p.test")).toBe("search");
    expect(visitSource("https://p.test/check", "p.test")).toBe("pulse");
    expect(visitSource("", "p.test")).toBe("direct");
    expect(visitSource("https://blog.example.org/", "p.test")).toBe("other");
  });

  it("knows which platforms can't be read without signing in", () => {
    expect(walledPlatform("https://www.facebook.com/share/p/123")).toBe(
      "Facebook",
    );
    expect(walledPlatform("https://www.castanet.net/news/x")).toBeNull();
  });
});

describe("uploads", () => {
  it("trusts an image's bytes, not its name", () => {
    expect(
      sniffImage(
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ),
    ).toBe("image/jpeg");
    expect(
      sniffImage(
        new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
        ]),
      ),
    ).toBe("image/png");
    expect(sniffImage(new Uint8Array(Buffer.from("RIFF....WEBPVP8 ")))).toBe(
      "image/webp",
    );
    expect(
      sniffImage(new Uint8Array(Buffer.from("<svg onload=alert(1)>"))),
    ).toBeNull();
    expect(
      sniffImage(new Uint8Array(Buffer.from("%PDF-1.7 aaaaaa"))),
    ).toBeNull();
  });
});

describe("reading a page's sentences", () => {
  it("drops menus and footers and keeps blocks apart", async () => {
    const { pageSentences } = await import("./sourceCheck");
    const html = `<html><body><nav>Home About Contact Main menu Jump to content</nav>
      <h1>Occupancy update</h1><p>On November 14, Kelowna General Hospital was at 147 per cent of its funded capacity.</p>
      <ul><li>Overflow beds were opened on two medical floors this week</li></ul>
      <footer>Copyright 2026 Interior Health. All rights reserved by everyone forever.</footer></body></html>`;
    const s = pageSentences(html);
    expect(s).toEqual([
      "On November 14, Kelowna General Hospital was at 147 per cent of its funded capacity.",
      "Overflow beds were opened on two medical floors this week",
    ]);
  });
});
