import { fireEvent, render, screen } from "@testing-library/react";
import { motionValue } from "framer-motion";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryCard } from "./DiscoveryCard";
import type { FieldExperience } from "./types";

const EXPERIENCE: FieldExperience = {
  id: "campfire",
  name: "Campfire Night",
  tagline: "Gather round.",
  glow: "from-amber-200/14 to-transparent",
  life: "ember",
  layout: {
    top: 10,
    left: 10,
    size: 190,
    rotate: -3,
    depth: 0.85,
    duration: 23,
    delay: 0,
    driftX: 10,
    driftY: 8,
  },
};

function renderCard(
  overrides: Partial<Parameters<typeof DiscoveryCard>[0]> = {},
) {
  const onInspect = vi.fn();
  const onSave = vi.fn();
  const onReject = vi.fn();
  const onShelf = vi.fn();

  render(
    <DiscoveryCard
      experience={EXPERIENCE}
      layout={EXPERIENCE.layout}
      onInspect={onInspect}
      onSave={onSave}
      onReject={onReject}
      onShelf={onShelf}
      pointerXPercent={motionValue(-1000)}
      pointerYPercent={motionValue(-1000)}
      dragConstraintsRef={{ current: null }}
      {...overrides}
    />,
  );

  return { onInspect, onSave, onReject, onShelf };
}

describe("DiscoveryCard", () => {
  it("inspects, and does not save, reject, or shelf, when the card body is clicked", () => {
    const { onInspect, onSave, onReject, onShelf } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: /view details/i }));

    expect(onInspect).toHaveBeenCalledWith(EXPERIENCE);
    expect(onSave).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
    expect(onShelf).not.toHaveBeenCalled();
  });

  it("saves, without also triggering inspect, when the Save action is clicked", () => {
    const { onInspect, onSave } = renderCard();

    fireEvent.click(
      screen.getByRole("button", { name: /save campfire night/i }),
    );

    expect(onSave).toHaveBeenCalledWith(EXPERIENCE);
    expect(onInspect).not.toHaveBeenCalled();
  });

  it("rejects independently of save and shelf", () => {
    const { onReject, onSave, onShelf } = renderCard();

    fireEvent.click(
      screen.getByRole("button", { name: /not interested in campfire night/i }),
    );

    expect(onReject).toHaveBeenCalledWith(EXPERIENCE);
    expect(onSave).not.toHaveBeenCalled();
    expect(onShelf).not.toHaveBeenCalled();
  });

  it("shelves independently of save and reject", () => {
    const { onShelf, onSave, onReject } = renderCard();

    fireEvent.click(
      screen.getByRole("button", { name: /shelf campfire night for later/i }),
    );

    expect(onShelf).toHaveBeenCalledWith(EXPERIENCE);
    expect(onSave).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });

  it("exposes save, reject, and shelf as independently reachable buttons, not hover-gated", () => {
    renderCard();

    // Not toBeVisible(): Framer Motion's initial-state inline opacity never
    // resolves in jsdom (no real animation frames), so it isn't a
    // meaningful visibility signal here. What actually matters for
    // accessibility is that each control exists in the DOM as its own real
    // button rather than only appearing via a CSS :hover rule.
    expect(
      screen.getByRole("button", { name: /save campfire night/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /shelf campfire night for later/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /not interested in campfire night/i,
      }),
    ).toBeInTheDocument();
  });
});
