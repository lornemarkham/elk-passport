import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { forgetEverythingKept } from "@/components/october/save/keeping";
import type { Beat } from "@/domain/october/draconids";
import { QuickStage } from "./QuickStage";

/**
 * **A quick experience has to stay a quick experience.**
 *
 * The failure mode is becoming a prettier detail page: paragraphs, a forecast
 * panel, and the save buried at the bottom of a scroll. These pin the shape —
 * one beat at a time, the detail page always reachable, and the weather told
 * truthfully rather than flatteringly.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/quick/draconids",
}));

const BEATS: readonly Beat[] = [
  { id: "open", line: "Something is going on above you.", art: "sky" },
  { id: "dragon", line: "They come out of the dragon.", art: "radiant" },
  {
    id: "evening",
    line: "And you don't have to stay up for it.",
    fact: {
      label: "Radiant",
      value: "Highest in the sky in the evening hours.",
    },
    art: "evening",
  },
  { id: "yours", line: "So — what does your night look like?", art: "yours" },
];

const thing = {
  entityId: "ddf146c6",
  entityKind: "Event" as const,
  name: "Draconid meteor shower 2026",
  startsAt: null,
};

const base = {
  beats: BEATS,
  thing,
  signedIn: true,
  initiallySaved: false,
  detailHref: "/passport/ddf146c6",
};

beforeEach(() => {
  forgetEverythingKept();
  vi.stubGlobal("fetch", () =>
    Promise.resolve(new Response(JSON.stringify({}), { status: 200 })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  forgetEverythingKept();
});

const advance = () => {
  const stage = screen.getByTestId("quick-stage");
  vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 400,
    height: 800,
    right: 400,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  fireEvent.click(stage, { clientX: 350, clientY: 400 });
};

describe("one beat at a time", () => {
  it("shows the first beat and nothing else", () => {
    render(<QuickStage {...base} yourNight={{}} />);
    expect(screen.getByTestId("beat-line")).toHaveTextContent(BEATS[0]!.line);
    expect(screen.queryByText(BEATS[1]!.line)).not.toBeInTheDocument();
  });

  it("advances on a tap", () => {
    render(<QuickStage {...base} yourNight={{}} />);
    advance();
    expect(screen.getByTestId("beat-line")).toHaveTextContent(BEATS[1]!.line);
  });

  it("says how long it is, so the length is honest", () => {
    render(<QuickStage {...base} yourNight={{}} />);
    expect(screen.getAllByTestId("beat-mark")).toHaveLength(BEATS.length);
  });

  it("shows Atlas's fact as evidence under the framing", () => {
    render(<QuickStage {...base} yourNight={{}} />);
    advance();
    advance();
    expect(screen.getByTestId("beat-fact")).toHaveTextContent(
      "Highest in the sky in the evening hours.",
    );
  });

  it("never runs past the last beat", () => {
    render(<QuickStage {...base} yourNight={{}} />);
    for (let i = 0; i < 10; i++) advance();
    expect(screen.getByTestId("beat-line")).toHaveTextContent(
      "So — what does your night look like?",
    );
  });
});

describe("the end offers both doors", () => {
  const toEnd = () => {
    for (let i = 0; i < BEATS.length; i++) advance();
  };

  it("offers the save and the full details, never one without the other", () => {
    render(<QuickStage {...base} yourNight={{ place: "Vernon" }} />);
    toEnd();
    expect(screen.getByTestId("keep-on-card")).toBeInTheDocument();
    expect(screen.getByTestId("quick-to-details")).toHaveAttribute(
      "href",
      "/passport/ddf146c6",
    );
  });

  it("invites a sign-in rather than faking a save", () => {
    render(
      <QuickStage {...base} signedIn={false} yourNight={{ place: "Vernon" }} />,
    );
    toEnd();
    expect(screen.queryByTestId("keep-on-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("keep-signed-out")).toBeInTheDocument();
  });
});

describe("your night tells the truth", () => {
  const toEnd = () => {
    for (let i = 0; i < BEATS.length; i++) advance();
  };

  it("says when a night is poor rather than flattering it", () => {
    render(
      <QuickStage
        {...base}
        yourNight={{
          place: "Vernon",
          darkAt: "6:22 PM",
          sky: { line: "Rain forecast after dark. Not a sky night." },
          source: "Environment Canada",
        }}
      />,
    );
    toEnd();
    expect(screen.getByTestId("your-sky")).toHaveTextContent("Not a sky night");
  });

  it("knows when it gets dark even with no forecast at all", () => {
    render(
      <QuickStage
        {...base}
        yourNight={{ place: "Vernon", darkAt: "6:22 PM" }}
      />,
    );
    toEnd();
    expect(screen.getByTestId("your-dark")).toHaveTextContent(
      "Dark by 6:22 PM",
    );
    expect(screen.queryByTestId("your-sky")).not.toBeInTheDocument();
    expect(
      screen.getByText(/No forecast reaches that night yet/),
    ).toBeInTheDocument();
  });

  it("asks for an area rather than guessing one", () => {
    render(<QuickStage {...base} yourNight={{}} />);
    toEnd();
    expect(screen.getByText(/Tell October where you are/)).toBeInTheDocument();
  });

  it("warns loudly when the conditions are simulated", () => {
    render(
      <QuickStage
        {...base}
        yourNight={{
          place: "Vernon",
          sky: { line: "Clear after dark." },
          source: "SIMULATED — not real weather",
          simulated: true,
        }}
      />,
    );
    toEnd();
    expect(
      screen.getByText("SIMULATED — not real weather"),
    ).toBeInTheDocument();
  });
});
