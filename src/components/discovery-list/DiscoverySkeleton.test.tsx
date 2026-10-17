import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiscoverySkeleton } from "./DiscoverySkeleton";
import { DiscoveryFailure } from "./DiscoveryFailure";

vi.mock("next/navigation", () => ({ usePathname: () => "/discovery" }));

/**
 * **The loading state is the page, not a picture of a different page.**
 *
 * It used to say "What could you do?" on a cream ground with no bar, and the
 * page that replaced it said something else on white. Both heading and ground
 * now come from the same components the real page renders, and these hold
 * the loading state to that.
 */
describe("Discovery while Atlas is being read", () => {
  it("asks the page's own question, once, with the date it will have", () => {
    render(<DiscoverySkeleton today="Thursday, October 15" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "What kind of day are you looking for?",
    );
    expect(screen.getByTestId("discovery-context")).toHaveTextContent(
      "Thursday, October 15",
    );
  });

  it("sits on the page's white ground, not the old cream one", () => {
    render(<DiscoverySkeleton />);
    const main = screen.getByTestId("discovery-loading");
    expect(main).toHaveClass("bg-white");
    expect(main.className).not.toMatch(/ecdfc4/);
    expect(main).toHaveAttribute("aria-busy", "true");
  });

  it("says what is happening, offers nothing that does not work yet, and leaves no real test ids for a test to mistake it for the page", () => {
    render(<DiscoverySkeleton />);
    expect(screen.getByRole("status")).toHaveTextContent(/finding what/i);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ask-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feel-like-doing")).not.toBeInTheDocument();
  });
});

describe("Discovery when Atlas cannot be reached", () => {
  it("keeps the bar, says Atlas, keeps the account out of it, and offers the retry", () => {
    const retry = vi.fn();
    render(<DiscoveryFailure onRetry={retry} />);
    expect(screen.getByTestId("passport-nav-discover")).toBeInTheDocument();
    expect(screen.getByTestId("discovery-error")).toHaveTextContent(
      /couldn.t reach Atlas/i,
    );
    expect(screen.getByTestId("discovery-error")).toHaveTextContent(
      /nothing you saved is lost/i,
    );
    screen.getByRole("button", { name: /try again/i }).click();
    expect(retry).toHaveBeenCalledOnce();
  });
});
