import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isReport, RegionDiscovery } from "./RegionDiscovery";

// **Current producer output, captured 2026-08-30.** Everything that asserts how
// this component renders reads from these.
import beaverLakeProposed from "./__fixtures__/current/beaverLake-proposed.json";
import swalwellLakeConstructed from "./__fixtures__/current/swalwellLake-constructed.json";

// **Historical producer output, captured 2026-08-16**, before ADR 039 and ADR 040
// finished the report contract. These are evidence of what Atlas answered then.
// They are deliberately *not* used to drive rendering — see the historical
// contract block below, and `__fixtures__/README.md`.
import historicalBeaverLake from "./__fixtures__/historical/beaverLake.json";
import historicalSwalwellLake from "./__fixtures__/historical/swalwellLake.json";
import historicalVernonVipers from "./__fixtures__/historical/vernonVipers.json";

/**
 * **The regression: an investigation that is not about a lake.**
 *
 * Searching *Vernon Vipers* threw `Cannot read properties of undefined
 * (reading 'filter')` from `verdictOf`. The field it read —
 * `report.structuredRecords` — is populated on **every** path Atlas can take,
 * asserted directly in `NamedDiscoveryService.test.ts`. So the undefined never
 * came from Atlas.
 *
 * It came from this file. Two values arrive from outside the program — an HTTP
 * body and a JSON blob the tab has been holding since some earlier build — and
 * both were admitted with `as Report`, a claim TypeScript cannot check.
 *
 * ## Two eras, kept apart
 *
 * The report shape has changed repeatedly, and the fixtures record that rather
 * than hiding it. `current/` is what Atlas answers today; `historical/` is what
 * it answered on 2026-08-16, before `publisherAccounts` (ADR 039),
 * `knownNames` and `leads[].corroboration` (ADR 040) existed.
 *
 * **The old reports are not repaired to pass.** Their missing fields cannot be
 * reconstructed from anything they contain — the reasoning is in
 * `__fixtures__/README.md` — and a fixture carrying an invented publisher
 * outcome would be worth less than no fixture. So the historical era is tested
 * for the thing that is actually true about it: **today's contract check
 * rejects it, on purpose.**
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

/**
 * The exact shape that crashed: a report cached before `osmCandidates` was
 * renamed. Every field `verdictOf` touches *first* is present, which is why it
 * got far enough to throw on the one that was not.
 */
const STALE_SNAPSHOT = {
  name: "Vernon Vipers",
  outcome: "leads-found",
  possibleMatches: [],
  leads: [],
  consulted: [],
  strategies: [],
  osmCandidates: [],
  summary: "Atlas found 2 sources worth reading about “Vernon Vipers”.",
};

function mockFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Drop one key without mutating the fixture every other test shares. */
function without(report: object, key: string): Record<string, unknown> {
  const copy = { ...(report as Record<string, unknown>) };
  delete copy[key];
  return copy;
}

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isReport — the current contract", () => {
  it("accepts current producer output", () => {
    expect(isReport(beaverLakeProposed)).toBe(true);
    expect(isReport(swalwellLakeConstructed)).toBe(true);
  });

  it("rejects the stale snapshot that caused the crash", () => {
    // Not "repairs". A shape from a contract this component was not built
    // against is not a weaker report — it is not a report.
    expect(isReport(STALE_SNAPSHOT)).toBe(false);
  });

  it("rejects an error body, a null, and a bare string", () => {
    expect(isReport({ error: "Atlas is unreachable" })).toBe(false);
    expect(isReport(null)).toBe(false);
    expect(isReport("Vernon Vipers")).toBe(false);
  });

  it("rejects a report whose collections are present but the wrong type", () => {
    // The failure mode a truthiness check would miss: present, but not an
    // array, so `.filter` is still not there.
    expect(isReport({ ...beaverLakeProposed, structuredRecords: null })).toBe(
      false,
    );
    expect(isReport({ ...beaverLakeProposed, leads: "none" })).toBe(false);
  });

  it("requires publisherAccounts (ADR 039)", () => {
    expect(isReport(without(beaverLakeProposed, "publisherAccounts"))).toBe(
      false,
    );
  });

  it("requires knownNames", () => {
    expect(isReport(without(beaverLakeProposed, "knownNames"))).toBe(false);
  });

  it("requires identity, and the search the curator typed", () => {
    expect(isReport(without(beaverLakeProposed, "identity"))).toBe(false);
    expect(isReport(without(beaverLakeProposed, "originalSearch"))).toBe(false);
  });

  it("requires a corroboration Atlas recognises on every lead (ADR 040)", () => {
    // **Absent is rejected.** A snapshot from before ADR 040 would otherwise
    // fall through every branch of the verdict to *"I can't prove this yet"* —
    // the wrong sentence, produced without a symptom.
    const oneLeadMissing = {
      ...beaverLakeProposed,
      leads: beaverLakeProposed.leads.map((lead, index) =>
        index === 0 ? without(lead, "corroboration") : lead,
      ),
    };
    expect(isReport(oneLeadMissing)).toBe(false);

    // **A value outside the union is rejected too.** `corroboration` is four
    // named states; anything else is a publisher outcome this build cannot
    // reason about, not a weaker one.
    const outsideTheUnion = {
      ...beaverLakeProposed,
      leads: beaverLakeProposed.leads.map((lead) => ({
        ...lead,
        corroboration: "probably",
      })),
    };
    expect(isReport(outsideTheUnion)).toBe(false);
  });

  it("rejects a next move this build has no control for", () => {
    // `whatIWant` indexes `MOVE_ACTION` directly, so an unrecognised kind is
    // `undefined.id` one line later — the crash this check exists to prevent.
    expect(
      isReport({
        ...beaverLakeProposed,
        nextMove: { ...beaverLakeProposed.nextMove, kind: "phone-somebody" },
      }),
    ).toBe(false);
  });
});

/**
 * **The historical contract — rejection is the correct answer.**
 *
 * These five reports are real Atlas output from 2026-08-16. ADR 039 and ADR 040
 * were both accepted the following day, and each added a field the current
 * check requires. Nothing was back-filled into them, because nothing in them
 * establishes the missing values — `strategies[]` predates ADR 039's
 * `publisher`, so no rung's outcome can be attributed to a publisher, and
 * inventing one would be the fabricated evidence this codebase exists to refuse.
 *
 * **This block is not a list of broken fixtures. It is the contract's history,
 * pinned.**
 */
describe("isReport — the historical contract (2026-08-16, pre ADR 039/040)", () => {
  const historical = [
    ["Vernon Vipers", historicalVernonVipers],
    ["Beaver Lake", historicalBeaverLake],
    ["Swalwell Lake", historicalSwalwellLake],
  ] as const;

  it.each(historical)(
    "rejects the %s report captured before the contract was finished",
    (_subject, report) => {
      expect(isReport(report)).toBe(false);
    },
  );

  it.each(historical)(
    "rejects %s because the fields are genuinely absent, not malformed",
    (_subject, report) => {
      const asRecord = report as unknown as Record<string, unknown>;
      // Precisely which fields are missing, so this test fails loudly if a
      // future migration quietly adds one.
      expect("publisherAccounts" in asRecord).toBe(false);
      expect("knownNames" in asRecord).toBe(false);
      expect(
        (report.leads as { corroboration?: unknown }[]).every(
          (lead) => lead.corroboration === undefined,
        ),
      ).toBe(true);
      // Everything the older contract did promise is still intact — these are
      // whole reports of their era, not damaged ones.
      expect(Array.isArray(report.leads)).toBe(true);
      expect(Array.isArray(report.structuredRecords)).toBe(true);
      expect(typeof report.summary).toBe("string");
    },
  );

  it("does not render a historical report as though it were current", async () => {
    mockFetch(historicalBeaverLake);
    window.history.replaceState(null, "", "/?investigate=Beaver+Lake");
    render(<RegionDiscovery regionId="r-1" regionName="Okanagan" />);

    await waitFor(() => {
      expect(screen.getByText(/result not in this tab/i)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /investigate again/i }));

    // A status code is not a promise about shape, and the message names the
    // real cause rather than blaming the data.
    await waitFor(() => {
      expect(screen.getByText(/restart it with/i)).toBeTruthy();
    });
    // The verdict never ran, so no claim about the investigation was made.
    expect(screen.queryByText(/I think I found your place/i)).toBeNull();
  });

  it("still holds the three-publisher Beaver Lake convergence (ADR 036)", () => {
    // **The reason these files are kept.** OpenStreetMap, BC Geographical Names
    // and the Freshwater Atlas each independently identified the same lake. A
    // current run converges on two: the gazetteer's MapServer layer serves an
    // incomplete ~5,000-record extract that no longer contains `bcgnis/20899`,
    // though the record itself is live and official. That is an open
    // investigation about the source, not a correction to this evidence — so
    // this scenario is preserved here rather than regenerated away.
    const publishers = historicalBeaverLake.identity.proposal.evidence.map(
      (evidence) => evidence.publisher,
    );
    expect(publishers).toEqual([
      "BC Freshwater Atlas",
      "BC Geographical Names",
      "OpenStreetMap",
    ]);
    expect(
      historicalBeaverLake.structuredRecords.map((record) => record.externalId),
    ).toEqual(["relation/1697950", "bcgnis/20899", "fwa/705020305"]);
  });
});

describe("RegionDiscovery — recovering an investigation from a URL", () => {
  it("renders a current report without throwing", async () => {
    mockFetch(beaverLakeProposed);
    window.history.replaceState(null, "", "/?investigate=Beaver+Lake");
    render(<RegionDiscovery regionId="r-1" regionName="Okanagan" />);

    await waitFor(() => {
      expect(screen.getByText(/result not in this tab/i)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /investigate again/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Beaver Lake/i).length).toBeGreaterThan(0);
    });
  });

  it("does not render a stale cached investigation, and says why", async () => {
    // The precise reproduction: the tab holds a pre-rename report and the URL
    // asks for it. Before the fix this rendered and threw.
    sessionStorage.setItem(
      "atlas.discovery.r-1.vernon vipers",
      JSON.stringify({ report: STALE_SNAPSHOT, at: new Date().toISOString() }),
    );
    window.history.replaceState(null, "", "/?investigate=Vernon+Vipers");
    mockFetch(beaverLakeProposed);

    expect(() =>
      render(<RegionDiscovery regionId="r-1" regionName="Okanagan" />),
    ).not.toThrow();

    await waitFor(() => {
      expect(screen.getByText(/an answer from an older Atlas/i)).toBeTruthy();
    });
  });

  it("does not start an investigation merely because the page loaded", async () => {
    // **A URL is not an instruction to spend a request.** Landing on
    // `?investigate=X` with nothing in this tab's storage offers the action and
    // waits; the fetch happens when the curator asks for it.
    const fetchMock = mockFetch(beaverLakeProposed);
    window.history.replaceState(null, "", "/?investigate=Beaver+Lake");
    render(<RegionDiscovery regionId="r-1" regionName="Okanagan" />);

    await waitFor(() => {
      expect(screen.getByText(/result not in this tab/i)).toBeTruthy();
    });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /investigate again/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });
});

/**
 * **Rendering, against current producer output.**
 *
 * Every fixture below is what Atlas answers today. Assertions are about
 * semantics rather than styling: what the page *claims* about the state of the
 * investigation, and whether the claim is true.
 */
describe("RegionDiscovery — rendering, against current producer output", () => {
  function renderRestored(report: unknown, subject: string) {
    sessionStorage.setItem(
      `atlas.discovery.r-1.${subject.toLowerCase()}`,
      JSON.stringify({ report, at: new Date().toISOString() }),
    );
    window.history.replaceState(
      null,
      "",
      `/?investigate=${encodeURIComponent(subject)}`,
    );
    mockFetch(report);
    render(<RegionDiscovery regionId="r-1" regionName="Okanagan" />);
  }

  it("announces the identity proposal on both of its surfaces", async () => {
    renderRestored(beaverLakeProposed, "Beaver Lake");

    await waitFor(() => {
      // **Two occurrences, and both are the contract.** The verdict states the
      // conclusion (`I think I found your place.`); `IdentityProposalPanel`
      // labels the question with two real answers. `getByText` throws on more
      // than one match, so asserting the pair is what describes the page — and
      // it still fails if either surface disappears.
      expect(screen.getAllByText(/I think I found your place/i)).toHaveLength(
        2,
      );
    });
    expect(screen.getAllByText(/Swalwell Lake/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Yes, this is my Beaver Lake/)).toBeTruthy();
    expect(screen.getByText(/Continue investigating/)).toBeTruthy();
  });

  it("does not say “nothing found” when publishers have converged", async () => {
    renderRestored(beaverLakeProposed, "Beaver Lake");

    await waitFor(() => {
      expect(screen.getAllByText(/I think I found your place/i)).toHaveLength(
        2,
      );
    });
    expect(screen.queryByText(/Nothing found yet/i)).toBeNull();
    // Both names, because the alias is why this proposal exists at all.
    expect(screen.getAllByText(/Swalwell Lake/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Beaver Lake/).length).toBeGreaterThan(0);
  });

  it("recommends confirming the identity, not reading an invented URL", async () => {
    renderRestored(beaverLakeProposed, "Beaver Lake");

    await waitFor(() => {
      expect(screen.getByText("Confirm this is your Beaver Lake")).toBeTruthy();
    });
    // The exact regression this replaced.
    expect(screen.queryByText(/Read “Beaver Lake” on Wikipedia/)).toBeNull();
  });

  it("names the subject and the publisher on a constructed address", async () => {
    renderRestored(swalwellLakeConstructed, "Swalwell Lake");

    // **The button may not shorten to *"Try it"*.** A constructed URL is a
    // guess, and a curator reading only the button has to be able to tell what
    // is about to be fetched and who is supposed to have published it.
    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Try “Swalwell Lake” on Wikipedia/,
        }),
      ).toBeTruthy();
    });
    // "Read" would claim Atlas knows the page exists. It does not — this lead's
    // own corroboration says the publisher's index did not list it.
    expect(screen.queryByText(/^Read “Swalwell Lake”/)).toBeNull();
    expect(
      swalwellLakeConstructed.leads.find(
        (lead) => lead.url === swalwellLakeConstructed.nextMove.url,
      )?.corroboration,
    ).toBe("not-enumerated");
  });
});
