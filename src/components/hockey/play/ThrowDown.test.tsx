import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Participant } from "@/experience-lab/core/types";
import { gameOf } from "@/domain/hockey/challenges";
import { ThrowDown } from "./ThrowDown";

/**
 * **The Bet sheet's behaviour**, without a database (the real one is
 * `docs/product/hockey/verification/bet-button.spec.ts`): the keyboard stays
 * up across the page's polls, a second tap is not a second bet, a refusal is
 * said inside the sheet and the sheet stays open, and only a press that
 * began on the backdrop closes it.
 */
const me: Participant = {
  id: "me",
  name: "Casey",
  emoji: "🏒",
  hue: 200,
  present: true,
};
const bryan: Participant = {
  id: "bryan",
  name: "bryan.k.smith",
  emoji: "🎺",
  hue: 40,
  present: true,
};
const game = gameOf("Canucks", "Wild");
const ALL = ["final-score", "first-team", "overtime", "total-goals"];

function sheet(over: Partial<Parameters<typeof ThrowDown>[0]> = {}) {
  const props = {
    draft: { kind: "bet" as const },
    me,
    people: [me, bryan],
    fans: {},
    game,
    promptIds: ALL,
    beforeStart: true,
    onSend: vi.fn(async () => ({ ok: true as const })),
    onClose: vi.fn(),
    ...over,
  };
  return { props, ui: <ThrowDown {...props} /> };
}

const fill = () => {
  fireEvent.click(screen.getByRole("button", { name: "First goal" }));
  fireEvent.click(screen.getByRole("button", { name: /VAN/ }));
  fireEvent.change(screen.getByLabelText(/Trash talk/), {
    target: { value: "booo" },
  });
};
const throwIt = () =>
  screen.getByRole("button", { name: /Throw it at|Sending/ });

describe("ThrowDown", () => {
  it("sends who, which question, which side and the trash talk — once", async () => {
    let finish!: (r: { ok: true }) => void;
    const { props, ui } = sheet({
      onSend: vi.fn(() => new Promise<{ ok: true }>((r) => (finish = r))),
    });
    render(ui);
    expect(throwIt()).toBeDisabled();
    expect(screen.getByText("Pick your side to throw it.")).toBeTruthy();
    fill();
    expect(throwIt()).toBeEnabled();

    fireEvent.click(throwIt());
    fireEvent.click(throwIt());
    fireEvent.click(throwIt());
    expect(props.onSend).toHaveBeenCalledTimes(1);
    expect(props.onSend).toHaveBeenCalledWith({
      kind: "bet",
      targetId: "bryan",
      market: "first-goal",
      side: "home",
      taunt: "booo",
    });
    expect(throwIt().textContent).toBe("Sending…");
    expect(throwIt()).toBeDisabled();

    await act(async () => finish({ ok: true }));
    expect(props.onClose).toHaveBeenCalledWith(true);
    // Gone is gone: nothing can fire it again.
    fireEvent.click(throwIt());
    expect(props.onSend).toHaveBeenCalledTimes(1);
  });

  it("says why it was refused, inside the sheet, and lets it be tried again", async () => {
    const onSend = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "Bets close at puck drop." })
      .mockResolvedValueOnce({ ok: true });
    const { props, ui } = sheet({ onSend });
    render(ui);
    fill();
    await act(async () => fireEvent.click(throwIt()));
    expect(screen.getByRole("alert").textContent).toBe(
      "Bets close at puck drop.",
    );
    expect(props.onClose).not.toHaveBeenCalled();
    expect(throwIt()).toBeEnabled();
    await act(async () => fireEvent.click(throwIt()));
    expect(onSend).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(props.onClose).toHaveBeenCalledWith(true);
  });

  it("keeps the keyboard up when the page re-renders with a new onClose", () => {
    const first = sheet();
    const { rerender } = render(first.ui);
    const taunt = screen.getByLabelText(/Trash talk/);
    taunt.focus();
    expect(document.activeElement).toBe(taunt);
    // Every poll hands the sheet a fresh onClose.
    rerender(<ThrowDown {...first.props} onClose={vi.fn()} />);
    rerender(<ThrowDown {...first.props} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(taunt);
  });

  it("closes from the backdrop only when the press began there", () => {
    const { props, ui } = sheet();
    const { container } = render(ui);
    const backdrop = container.firstElementChild as HTMLElement;
    const dialog = screen.getByRole("dialog");

    // Began on the sheet, ended over the backdrop (the keyboard moved it).
    fireEvent.pointerDown(dialog);
    fireEvent.click(backdrop);
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("escape closes it, and uses the page's latest onClose", () => {
    const first = sheet();
    const { rerender } = render(first.ui);
    const latest = vi.fn();
    rerender(<ThrowDown {...first.props} onClose={latest} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first.props.onClose).not.toHaveBeenCalled();
  });
});
