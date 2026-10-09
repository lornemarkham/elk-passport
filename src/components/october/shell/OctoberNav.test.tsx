import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * **The shell has to be the trustworthy part.**
 *
 * October is allowed to become cinematic; this bar is not. These pin the
 * behaviour a person relies on to know where they are — the three
 * destinations exist, exactly one is marked current, and being deeper inside
 * a destination still counts as being in it. They deliberately say nothing
 * about how it looks.
 */

let pathname = "/october";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

const { OctoberNav } = await import("./OctoberNav");

const at = (path: string) => {
  pathname = path;
  return render(<OctoberNav displayName={null} />);
};

describe("OctoberNav", () => {
  it("offers the three destinations October has, and no more", () => {
    at("/october");
    const links = screen
      .getByRole("navigation", { name: "October" })
      .querySelectorAll("a[data-testid^='october-nav-']");
    expect([...links].map((l) => l.textContent)).toEqual([
      "October",
      "Discover",
      "My October",
    ]);
  });

  it("marks where you are, and marks only one place", () => {
    at("/october/discover");
    const current = screen
      .getByRole("navigation", { name: "October" })
      .querySelectorAll("[aria-current='page']");
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toBe("Discover");
  });

  it("counts a page deeper inside a destination as being in it", () => {
    at("/october/mine/anything");
    expect(screen.getByTestId("october-nav-my-october")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not claim the control room while you are in a sub-destination", () => {
    // `/october` is a prefix of every October route; only itself is Home.
    at("/october/discover");
    expect(screen.getByTestId("october-nav-october")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("offers a way in when nobody is signed in", () => {
    at("/october");
    // Percent-encoded now that the destination is the reader's own path
    // rather than the constant `/october` this used to assert.
    expect(screen.getByTestId("october-sign-in")).toHaveAttribute(
      "href",
      "/auth?next=%2Foctober",
    );
  });

  it("shows who you are when somebody is", () => {
    pathname = "/october";
    render(<OctoberNav displayName="Lorne" />);
    expect(screen.getByTestId("october-account")).toHaveTextContent("Lorne");
  });
});

/**
 * **A domain's front door is still a route.**
 *
 * `iamoctober.com/` is served by rewriting the root to `/october/discover`
 * and deliberately leaving the URL alone, so `usePathname()` reports `/` and
 * the bar used to highlight nothing at all — the one page most people will
 * ever see of October looked like it was nowhere.
 */
describe("OctoberNav on an experience domain", () => {
  const atDomainRoot = (rewrittenTo: string) => {
    pathname = "/";
    return render(<OctoberNav displayName={null} activePath={rewrittenTo} />);
  };

  const current = () =>
    screen
      .getByRole("navigation", { name: "October" })
      .querySelectorAll('[aria-current="page"]');

  it("marks Discover current at the domain root, where the URL says /", () => {
    atDomainRoot("/october/discover");
    expect(current()).toHaveLength(1);
    expect(current()[0]).toHaveAttribute("data-testid", "october-nav-discover");
  });

  it("still links to the real routes, not to the bare domain root", () => {
    atDomainRoot("/october/discover");
    expect(
      screen.getByTestId("october-nav-discover").getAttribute("href"),
    ).toBe("/october/discover");
    expect(screen.getByTestId("october-nav-october").getAttribute("href")).toBe(
      "/october",
    );
  });

  it("marks nothing current on Passport's own homepage", () => {
    // The same `/` the browser reports, with no rewrite behind it. October
    // must not claim a page that is not October's.
    pathname = "/";
    render(<OctoberNav displayName={null} />);
    expect(current()).toHaveLength(0);
  });

  it("leaves every other October route deciding from the browser path", () => {
    for (const [path, testid] of [
      ["/october", "october-nav-october"],
      ["/october/discover", "october-nav-discover"],
      ["/october/mine", "october-nav-my-october"],
      ["/october/mine/anything", "october-nav-my-october"],
    ] as const) {
      pathname = path;
      const { unmount } = render(<OctoberNav displayName={null} />);
      expect(current(), path).toHaveLength(1);
      expect(current()[0], path).toHaveAttribute("data-testid", testid);
      unmount();
    }
  });

  it("would rather highlight nothing than guess from a path it was not given", () => {
    // A future domain mapped somewhere outside October: the bar is still
    // October's, and none of its three destinations is where you are.
    pathname = "/";
    render(<OctoberNav displayName={null} activePath="/january/discover" />);
    expect(current()).toHaveLength(0);
  });
});

/**
 * **Leaving October must not lose October.**
 *
 * Both of the bar's two personal links used to throw away where you were:
 * signed out it sent you to `/auth?next=/october` from wherever you stood, and
 * signed in your own name linked a bare `/account` — a cream page titled
 * Passport whose only exit was Passport's Discovery. Six of the seventeen
 * cards on production had the matching defect in their own links.
 */
describe("the bar carries where you are", () => {
  it("sends a signed-out reader to auth and back to this very page", () => {
    pathname = "/october/mine";
    render(<OctoberNav displayName={null} />);
    expect(screen.getByTestId("october-sign-in")).toHaveAttribute(
      "href",
      "/auth?next=%2Foctober%2Fmine",
    );
  });

  it("tells the account page which experience the reader came from", () => {
    pathname = "/october/discover";
    render(<OctoberNav displayName="Lorne" />);
    expect(screen.getByTestId("october-account")).toHaveAttribute(
      "href",
      "/account?next=%2Foctober%2Fdiscover",
    );
  });

  it("uses the rewritten path on the mapped domain, where the URL says `/`", () => {
    // `iamoctober.com/` renders Discover without changing the URL, so the
    // browser path is `/` and only the header knows better. Without this the
    // account link would send the reader back to Passport's own homepage.
    pathname = "/";
    render(<OctoberNav displayName="Lorne" activePath="/october/discover" />);
    expect(screen.getByTestId("october-account")).toHaveAttribute(
      "href",
      "/account?next=%2Foctober%2Fdiscover",
    );
  });
});
