import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
      "Sign in",
    ]);
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
    // An Experience is not a tab on Passport — that question is open (§10),
    // and October keeps its own door on Discovery rather than a slot here.
    at("/discovery");
    expect(screen.getByRole("navigation").textContent).not.toContain("October");
  });
});
