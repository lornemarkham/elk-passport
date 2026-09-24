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
 */
describe("Card", () => {
  it("navigates to the thing it was given", () => {
    render(
      <Card href="/passport/org-1" title="Black Mountain Haunted House" />,
    );
    expect(screen.getByTestId("october-card")).toHaveAttribute(
      "href",
      "/passport/org-1",
    );
  });

  it("does not navigate at all when there is nowhere truthful to go", () => {
    render(<Card title="Something Atlas cannot open" />);
    const card = screen.getByTestId("october-card");
    expect(card.tagName).toBe("DIV");
    expect(card).not.toHaveAttribute("href");
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
