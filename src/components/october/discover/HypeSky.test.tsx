import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { forgetEverythingKept } from "@/components/october/save/keeping";
import type { Hype } from "@/domain/october/hype";
import { HypeSky } from "./HypeSky";

/**
 * **Hype stops being Hype the moment you choose it.**
 *
 * The transition is the point: generic recommendation language has no
 * business being shown to somebody who already decided, and the same store
 * every other save control uses is what makes the words and the mark agree.
 */
let calls: { url: string; method: string }[] = [];

beforeEach(() => {
  calls = [];
  forgetEverythingKept();
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: typeof input === "string" ? input : input.toString(),
      method: init?.method ?? "GET",
    });
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  forgetEverythingKept();
});

const hype: Hype = {
  subject: {
    id: "draco",
    title: "Draconid meteor shower 2026",
  } as Hype["subject"],
  because: "Clear sky forecast, and almost no moon.",
  now: "4 nights of it, starting tonight.",
  level: 4,
  kind: "astronomy",
  day: "2026-10-07",
};

const base = {
  hype,
  thing: {
    entityId: "draco",
    entityKind: "Event" as const,
    name: "Draconid meteor shower 2026",
    startsAt: null,
  },
  signedIn: true,
  initiallySaved: false,
  detailHref: "/passport/draco",
};

describe("before it is chosen", () => {
  it("says October noticed it, and why", () => {
    render(<HypeSky {...base} />);
    expect(screen.getByTestId("hype-eyebrow")).toHaveTextContent(
      "October is watching this one",
    );
    expect(screen.getByTestId("hype-because")).toHaveTextContent(
      "4 nights of it, starting tonight. Clear sky forecast, and almost no moon.",
    );
  });

  it("offers the detail page as well, never instead", () => {
    render(<HypeSky {...base} />);
    expect(screen.getByTestId("hype-details")).toHaveAttribute(
      "href",
      "/passport/draco",
    );
  });

  it("never shows a score or a percentage", () => {
    render(<HypeSky {...base} />);
    const said = screen.getByTestId("hype-sky").textContent ?? "";
    expect(said).not.toMatch(/\d+\s?%/);
    expect(said).not.toMatch(/score|rating|trending|popular|people/i);
  });
});

describe("after it is chosen", () => {
  it("stops pitching and states the plan", async () => {
    render(<HypeSky {...base} />);
    fireEvent.click(screen.getByTestId("hype-keep"));

    await waitFor(() =>
      expect(screen.getByTestId("hype-eyebrow")).toHaveTextContent(
        "In your October",
      ),
    );
    // The recommendation language is gone; the temporal fact remains.
    expect(screen.getByTestId("hype-because")).toHaveTextContent(
      "4 nights of it, starting tonight.",
    );
    expect(screen.getByTestId("hype-because")).not.toHaveTextContent(
      "Clear sky forecast",
    );
  });

  it("saves through the one route everything in October uses", async () => {
    render(<HypeSky {...base} />);
    fireEvent.click(screen.getByTestId("hype-keep"));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.url).toBe("/api/october/things/draco");
    expect(calls[0]!.method).toBe("PUT");
  });

  it("renders as already chosen when it already was", () => {
    render(<HypeSky {...base} initiallySaved />);
    expect(screen.getByTestId("hype-eyebrow")).toHaveTextContent(
      "In your October",
    );
    expect(calls).toHaveLength(0);
  });
});

describe("signed out", () => {
  it("invites a sign-in rather than faking a save", () => {
    render(<HypeSky {...base} signedIn={false} />);
    expect(screen.queryByTestId("hype-keep")).not.toBeInTheDocument();
    expect(screen.getByTestId("hype-signed-out")).toHaveAttribute(
      "href",
      `/auth?next=${encodeURIComponent("/october/discover")}`,
    );
  });
});
