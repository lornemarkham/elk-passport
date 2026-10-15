import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

/**
 * **Passport had no bar.**
 *
 * Walked the deployed product: `/boards` and `/account` each rendered zero
 * links — a person could arrive at their own saved places and have no way
 * back to anything. The homepage had no header, no sign-in and two links on
 * the whole screen. October has had a bar for months.
 *
 * These pin what that bar owes a person: it says where you are, it gets you
 * home, it carries where you were into auth, and it promises nothing the
 * product cannot currently do.
 */

let pathname = "/discovery";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { PassportNav } = await import("./PassportNav");

const at = (path: string, displayName: string | null = null) => {
  pathname = path;
  return render(<PassportNav displayName={displayName} />);
};

describe("where you are", () => {
  it("marks the section you are in, and only that one", () => {
    at("/discovery");
    expect(screen.getByTestId("passport-nav-discover")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("passport-nav-places")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("counts being deeper inside a section as being in it", () => {
    at("/boards/abc-123");
    expect(screen.getByTestId("passport-nav-saved")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks nothing on the homepage, which is not a section", () => {
    at("/");
    for (const id of ["discover", "places", "saved"]) {
      expect(screen.getByTestId(`passport-nav-${id}`)).not.toHaveAttribute(
        "aria-current",
      );
    }
  });
});

describe("getting out", () => {
  it("always offers a way home", () => {
    at("/boards");
    // The wordmark is the way home. It reads GO HAVE A DAY now — the name of
    // the product rather than the name of the software; see `Wordmark`.
    expect(screen.getByTestId("ghad-wordmark")).toHaveAttribute("href", "/");
  });

  it("carries where you were into sign-in", () => {
    at("/boards");
    expect(screen.getByTestId("passport-sign-in")).toHaveAttribute(
      "href",
      "/auth?next=%2Fboards",
    );
  });

  it("carries it into the account page too, once you are somebody", () => {
    at("/discovery", "Lorne");
    expect(screen.getByTestId("passport-account")).toHaveAttribute(
      "href",
      "/account?next=%2Fdiscovery",
    );
  });

  it("shows a name instead of an invitation once signed in", () => {
    at("/discovery", "Lorne");
    expect(screen.getByTestId("passport-account")).toHaveTextContent("Lorne");
    expect(screen.queryByTestId("passport-sign-in")).toBeNull();
  });
});

describe("what it refuses to promise", () => {
  it("offers only sections that exist and are finished", () => {
    at("/discovery");
    const labels = screen
      .getAllByRole("link")
      .map((a) => a.textContent?.trim());
    expect(labels).toEqual([
      "Go have a day",
      "Discover",
      "Places",
      "Saved",
      "Labs",
      "Sign in",
    ]);
    // Experiences is on the bar too, but as a button: it opens a row, it
    // does not go anywhere itself.
    expect(screen.getByTestId("passport-nav-experiences")).toHaveTextContent(
      "Experiences",
    );
  });

  it("advertises nothing the doctrine fences off", () => {
    // Inspiration, the planner and LIVE are future work (§13, §14). A nav is
    // the loudest possible place to promise something that does not exist —
    // which is exactly what the greyed-out Map and AI tabs did for months.
    at("/discovery");
    const text = screen.getByRole("navigation").textContent ?? "";
    for (const promise of ["Inspiration", "Plan", "AI", "Map", "Live"]) {
      expect(text).not.toContain(promise);
    }
  });

  it("does not claim October as a Passport section", () => {
    // An Experience is not a tab beside Discover, Places and Saved — what an
    // Experience *is* stays open (§10). October is reachable from here, but
    // only from inside the Experiences row, which is closed until asked.
    at("/discovery");
    expect(
      screen.getByRole("navigation", { name: "Go Have A Day" }).textContent,
    ).not.toContain("October");
    expect(screen.queryByTestId("passport-experiences")).toBeNull();
  });
});

/**
 * **The experiences are real products, and they are findable.** Owner
 * decision, 2026-10-15: Passport is the platform, Go Have a Day is the
 * flagship, and Conference, Hockey Night and October are specialised
 * experiences powered by it — grouped under one word on the bar so they can
 * be found without competing with Discovery.
 */
describe("experiences", () => {
  const openRow = () => {
    fireEvent.click(screen.getByTestId("passport-nav-experiences"));
    return screen.getByTestId("passport-experiences");
  };

  it("is closed until asked, and says so", () => {
    at("/discovery");
    const button = screen.getByTestId("passport-nav-experiences");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("passport-experiences")).toBeNull();
  });

  it("opens to the three existing routes, in the stated order", () => {
    at("/discovery");
    openRow();
    const button = screen.getByTestId("passport-nav-experiences");
    expect(button).toHaveAttribute("aria-expanded", "true");
    const row = screen.getByRole("navigation", { name: "Experiences" });
    expect(button).toHaveAttribute("aria-controls", row.id);
    const links = screen
      .getAllByRole("link", { name: /Conference|Hockey Night|October/ })
      .map((a) => [a.textContent?.trim(), a.getAttribute("href")]);
    expect(links).toEqual([
      ["Conference", "/conferences"],
      ["Hockey Night", "/hockey"],
      ["October", "/october"],
    ]);
  });

  it("closes again on a second press, and on Escape", () => {
    at("/discovery");
    openRow();
    fireEvent.click(screen.getByTestId("passport-nav-experiences"));
    expect(screen.queryByTestId("passport-experiences")).toBeNull();
    openRow();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("passport-experiences")).toBeNull();
  });

  it("closes on a press anywhere outside the bar", () => {
    at("/discovery");
    openRow();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId("passport-experiences")).toBeNull();
  });

  it("stays open for a press inside the bar", () => {
    at("/discovery");
    const row = openRow();
    fireEvent.pointerDown(row);
    expect(screen.getByTestId("passport-experiences")).toBeInTheDocument();
  });

  it("marks Experiences as where you are when you are inside one", () => {
    at("/conferences/abc-123");
    expect(screen.getByTestId("passport-nav-experiences")).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const id of ["discover", "places", "saved"]) {
      expect(screen.getByTestId(`passport-nav-${id}`)).not.toHaveAttribute(
        "aria-current",
      );
    }
    openRow();
    expect(
      screen.getByTestId("passport-experience-conference"),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByTestId("passport-experience-hockey"),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks nothing on Discovery", () => {
    at("/discovery");
    expect(screen.getByTestId("passport-nav-experiences")).not.toHaveAttribute(
      "aria-current",
    );
  });
});
