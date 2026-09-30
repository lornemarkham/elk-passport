import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Card } from "@/components/october/shell/atoms";
import { KeepOnCard } from "./KeepOnCard";
import { forgetEverythingKept, type Keepable } from "./keeping";

/**
 * **Deciding from the card, and never being told a lie about it.**
 *
 * The whole value of saving from a card is that somebody did not have to open
 * the thing first. The whole risk is that a control inside a link either
 * navigates instead of saving, or says "kept" over a request that failed —
 * and the person finds out in three weeks, looking at an empty October.
 *
 * `fetch` is intercepted so these stay offline; the route it calls is the real
 * one (`/api/october/things/{id}`), which is the same row `/october/mine`
 * reads. There is no second save system to test.
 */
const thing: Keepable = {
  entityId: "exp-field-of-screams-okeefe-ranch",
  entityKind: "Experience",
  name: "Field of Screams",
  startsAt: "2026-09-25T19:00:00.000Z",
};

let calls: { url: string; method: string; body: unknown }[] = [];

function answerWith(status: number, delayMs = 0) {
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: typeof input === "string" ? input : input.toString(),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const respond = () =>
      new Response(status === 204 ? null : JSON.stringify({}), { status });
    return delayMs === 0
      ? Promise.resolve(respond())
      : new Promise<Response>((resolve) =>
          setTimeout(() => resolve(respond()), delayMs),
        );
  });
}

beforeEach(() => {
  calls = [];
  forgetEverythingKept();
  answerWith(201);
});

afterEach(() => {
  vi.unstubAllGlobals();
  forgetEverythingKept();
});

const control = () => screen.getByTestId("keep-on-card");

describe("a card for something not yet kept", () => {
  it("offers a way to keep it", () => {
    render(<KeepOnCard thing={thing} signedIn returnTo="/october/discover" />);

    expect(control()).toHaveAttribute("data-saved", "false");
    expect(control()).toHaveAttribute("aria-pressed", "false");
    // Named for anyone not looking at a heart.
    expect(control().getAttribute("aria-label")).toMatch(
      /keep field of screams/i,
    );
    expect(screen.queryByTestId("keep-kept-label")).toBeNull();
  });

  it("keeps it through My October's own route, not a second system", async () => {
    render(<KeepOnCard thing={thing} signedIn returnTo="/october/discover" />);
    fireEvent.click(control());

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.url).toBe(
      "/api/october/things/exp-field-of-screams-okeefe-ranch",
    );
    expect(calls[0]!.method).toBe("PUT");
    // The snapshot `passport_october_things` stores, and nothing else. No
    // owner in the body: the session decides whose October this is.
    expect(calls[0]!.body).toEqual({
      entityKind: "Experience",
      name: "Field of Screams",
      startsAt: "2026-09-25T19:00:00.000Z",
    });
  });

  it("says so only once the row exists", async () => {
    answerWith(201, 30);
    render(<KeepOnCard thing={thing} signedIn returnTo="/october/discover" />);
    fireEvent.click(control());

    // Mid-flight: honest about working, silent about the outcome.
    expect(control()).toBeDisabled();
    expect(screen.queryByTestId("keep-kept-label")).toBeNull();

    await waitFor(() =>
      expect(screen.getByTestId("keep-kept-label")).toBeTruthy(),
    );
    expect(control()).toHaveAttribute("data-saved", "true");
    expect(screen.getByTestId("keep-kept-label").textContent).toMatch(
      /in my october/i,
    );
  });
});

describe("a card for something already kept", () => {
  it("renders kept on its first painted frame", () => {
    // The server answered this before the page rendered, so there is no
    // moment where it says "not kept" and then corrects itself.
    render(
      <KeepOnCard
        thing={thing}
        initiallySaved
        signedIn
        returnTo="/october/discover"
      />,
    );

    expect(control()).toHaveAttribute("data-saved", "true");
    expect(screen.getByTestId("keep-kept-label")).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("removes it through the same route when pressed again", async () => {
    answerWith(204);
    render(
      <KeepOnCard
        thing={thing}
        initiallySaved
        signedIn
        returnTo="/october/discover"
      />,
    );
    fireEvent.click(control());

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.method).toBe("DELETE");
    await waitFor(() =>
      expect(control()).toHaveAttribute("data-saved", "false"),
    );
  });
});

describe("when keeping it fails", () => {
  it("never claims success", async () => {
    answerWith(500);
    render(<KeepOnCard thing={thing} signedIn returnTo="/october/discover" />);
    fireEvent.click(control());

    await waitFor(() => expect(screen.getByTestId("keep-failed")).toBeTruthy());
    expect(control()).toHaveAttribute("data-saved", "false");
    expect(screen.queryByTestId("keep-kept-label")).toBeNull();
  });

  it("leaves the card usable", async () => {
    answerWith(500);
    render(<KeepOnCard thing={thing} signedIn returnTo="/october/discover" />);
    fireEvent.click(control());
    await waitFor(() => expect(screen.getByTestId("keep-failed")).toBeTruthy());

    expect(control()).not.toBeDisabled();
    answerWith(201);
    fireEvent.click(control());
    await waitFor(() =>
      expect(screen.getByTestId("keep-kept-label")).toBeTruthy(),
    );
  });

  it("does not claim success when the session has ended", async () => {
    answerWith(401);
    render(<KeepOnCard thing={thing} signedIn returnTo="/october/discover" />);
    fireEvent.click(control());

    await waitFor(() => expect(screen.getByTestId("keep-failed")).toBeTruthy());
    expect(control()).toHaveAttribute("data-saved", "false");
  });
});

describe("pressing it more than once", () => {
  it("cannot start a second write while the first is in flight", async () => {
    answerWith(201, 40);
    render(<KeepOnCard thing={thing} signedIn returnTo="/october/discover" />);

    fireEvent.click(control());
    fireEvent.click(control());
    fireEvent.click(control());

    await waitFor(() =>
      expect(screen.getByTestId("keep-kept-label")).toBeTruthy(),
    );
    // One press, one row. The database's `(user_id, entity_id)` key and
    // `wantThing`'s read-before-insert make this true at rest; this is the
    // control not flickering while they hold it down.
    expect(calls).toHaveLength(1);
  });

  it("does not write again when it is already kept and nothing changed", () => {
    render(
      <KeepOnCard
        thing={thing}
        initiallySaved
        signedIn
        returnTo="/october/discover"
      />,
    );
    expect(calls).toHaveLength(0);
  });
});

describe("two controls for the same thing", () => {
  it("agree, because there is one saved state and not two", async () => {
    render(
      <>
        <div data-testid="a">
          <KeepOnCard thing={thing} signedIn returnTo="/october" />
        </div>
        <div data-testid="b">
          <KeepOnCard thing={thing} signedIn returnTo="/october/discover" />
        </div>
      </>,
    );

    const [first] = screen.getAllByTestId("keep-on-card");
    fireEvent.click(first!);

    await waitFor(() => {
      for (const button of screen.getAllByTestId("keep-on-card")) {
        expect(button).toHaveAttribute("data-saved", "true");
      }
    });
    expect(calls).toHaveLength(1);
  });
});

describe("a visitor", () => {
  it("is invited to sign in rather than shown a control that does nothing", () => {
    render(
      <KeepOnCard
        thing={thing}
        signedIn={false}
        returnTo="/october/discover"
      />,
    );

    const invite = screen.getByTestId("keep-signed-out");
    expect(invite).toHaveAttribute("href", "/auth?next=%2Foctober%2Fdiscover");
    // Never a kept state for somebody with nowhere to keep it.
    expect(screen.queryByTestId("keep-on-card")).toBeNull();
    expect(screen.queryByTestId("keep-kept-label")).toBeNull();
  });

  it("brings them back to the surface they were browsing", () => {
    render(<KeepOnCard thing={thing} signedIn={false} returnTo="/october" />);
    expect(screen.getByTestId("keep-signed-out")).toHaveAttribute(
      "href",
      "/auth?next=%2Foctober",
    );
  });
});

describe("inside a card that is itself a link", () => {
  it("keeping does not open the thing", async () => {
    const navigations: string[] = [];
    render(
      <Card
        href="/passport/exp-field-of-screams-okeefe-ranch"
        title="Field of Screams"
        keep={
          <KeepOnCard thing={thing} signedIn returnTo="/october/discover" />
        }
      />,
    );

    // Any click that reached the card's link would bubble to here with its
    // default intact. The control must consume it.
    const card = screen.getByTestId("october-card");
    card.addEventListener("click", (event) => {
      if (!event.defaultPrevented) {
        const link = (event.target as HTMLElement).closest("a");
        if (link) navigations.push(link.getAttribute("href") ?? "");
      }
    });

    fireEvent.click(control());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(navigations).toEqual([]);
  });

  it("leaves the rest of the card navigating as it always did", () => {
    render(
      <Card
        href="/passport/exp-field-of-screams-okeefe-ranch"
        title="Field of Screams"
        keep={
          <KeepOnCard thing={thing} signedIn returnTo="/october/discover" />
        }
      />,
    );

    const links = screen
      .getByTestId("october-card")
      .querySelectorAll("a[data-testid='october-card-link']");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      "href",
      "/passport/exp-field-of-screams-okeefe-ranch",
    );
  });

  it("does not cover the title or the dates", () => {
    render(
      <Card
        href="/passport/x"
        title="Field of Screams"
        eyebrow="Fri, Oct 31"
        line="Four new mazes across a working heritage ranch after dark."
        keep={
          <KeepOnCard thing={thing} signedIn returnTo="/october/discover" />
        }
      />,
    );

    // Everything the card is for is still there beside the mark. The title
    // appears twice on purpose — once as the heading, once as the overlay
    // link's accessible name — so the visible one is found by its class.
    const card = screen.getByTestId("october-card");
    expect(card.querySelector(".font-heading")!.textContent).toBe(
      "Field of Screams",
    );
    expect(screen.getByText("Fri, Oct 31")).toBeTruthy();
    expect(screen.getByText(/four new mazes/i)).toBeTruthy();
  });
});
