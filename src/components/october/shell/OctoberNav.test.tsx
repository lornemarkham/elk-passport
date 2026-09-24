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
    expect(screen.getByTestId("october-sign-in")).toHaveAttribute(
      "href",
      "/auth?next=/october",
    );
  });

  it("shows who you are when somebody is", () => {
    pathname = "/october";
    render(<OctoberNav displayName="Lorne" />);
    expect(screen.getByTestId("october-account")).toHaveTextContent("Lorne");
  });
});
