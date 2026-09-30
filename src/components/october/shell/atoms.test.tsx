import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./atoms";

/**
 * **A card for a specific Thing must never become "open the list".**
 *
 * This is the failure these pin. October cards used to read
 * `destinationFor(e) ?? "/october/discover"`, so an entity Passport had no
 * route for silently turned into a link to everything — which throws away the
 * only thing the person told us by tapping it, namely *which* one they meant.
 * A card that cannot be opened is an honest outcome. A card that lies about
 * where it goes is not.
 *
 * The link became an overlay when cards learned to hold a save control — a
 * `<button>` inside an `<a>` is invalid and would navigate when pressed. So
 * the target moved from the card element to a single child link. The rule is
 * the same and is asserted the same way: one link, pointing at the thing.
 */
describe("Card", () => {
  it("navigates to the thing it was given", () => {
    render(
      <Card href="/passport/org-1" title="Black Mountain Haunted House" />,
    );
    const card = screen.getByTestId("october-card");
    const links = card.querySelectorAll("a");
    // One target for the whole card, and it is the thing.
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/passport/org-1");
    // Named for a screen reader, which the overlay would otherwise leave bare.
    expect(links[0]!.textContent).toContain("Black Mountain Haunted House");
  });

  it("does not navigate at all when there is nowhere truthful to go", () => {
    render(<Card title="Something Atlas cannot open" />);
    const card = screen.getByTestId("october-card");
    expect(card.tagName).toBe("DIV");
    expect(card.querySelectorAll("a")).toHaveLength(0);
    expect(card).toHaveAttribute("data-unopenable", "true");
  });

  it("still shows everything it knows when it cannot be opened", () => {
    render(
      <Card
        title="Black Mountain Haunted House"
        eyebrow="haunted house"
        line="Operates every October."
      />,
    );
    expect(
      screen.getByText("Black Mountain Haunted House"),
    ).toBeInTheDocument();
    expect(screen.getByText("Operates every October.")).toBeInTheDocument();
  });
});
