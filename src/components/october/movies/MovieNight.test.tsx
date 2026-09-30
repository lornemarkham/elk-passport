import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { isOctoberKind, type OctoberKind } from "@/lib/october/types";

/**
 * **Picking a film has to actually keep it.**
 *
 * Movie Night has said *"It's in your October. Tell me what you thought when
 * it's over."* since 2026-09-22, and for eight days it was not: `wantToDo` was
 * called with `entityKind: "Movie"`, the API's own kind guard refused it with
 * a 400, and the only sign was a toast underneath the sentence claiming the
 * opposite.
 *
 * Nothing caught it because the two halves were tested apart — Movie Night's
 * call was never checked against the guard that had to admit it. So this test
 * takes what the screen sends and puts it through the real `isOctoberKind`.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/october/movies",
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m), success: () => {} },
}));

interface Kept {
  entityId: string;
  entityKind: OctoberKind;
  name: string;
  startsAt?: string | null;
}
const wantToDo = vi.fn<(t: Kept) => Promise<unknown>>(async () => ({}));
vi.mock("@/lib/october/october-repo", () => ({
  wantToDo: (t: Kept) => wantToDo(t),
}));

const { MovieNight } = await import("./MovieNight");

/**
 * Who's watching → how much → pick the first of the three.
 *
 * Awaited between steps: the panels sit inside an `AnimatePresence` with
 * `mode="wait"`, so the next one does not exist until the last has left.
 */
async function pickAFilm({ signedIn = true } = {}) {
  render(<MovieNight signedIn={signedIn} reactions={[]} />);
  fireEvent.click(await screen.findByTestId("audience-adults"));
  fireEvent.click(
    (await screen.findByTestId("fears")).querySelector("button")!,
  );
  fireEvent.click(
    (await screen.findByTestId("shortlist")).querySelector("button")!,
  );
}

beforeEach(() => {
  wantToDo.mockClear();
  toastError.mockClear();
});

describe("keeping a film", () => {
  it("sends it to the same October everything else goes into", async () => {
    await pickAFilm();
    await waitFor(() => expect(wantToDo).toHaveBeenCalledTimes(1));

    const kept = wantToDo.mock.calls[0]![0];
    expect(kept.entityKind).toBe("Movie");
    expect(kept.entityId).toBeTruthy();
    // The name is the snapshot My October shows back, so it carries the year.
    expect(kept.name).toMatch(/\(\d{4}\)$/);
  });

  it("sends a kind the API will actually accept", async () => {
    // The whole bug, in one line: the real guard, on the real payload.
    await pickAFilm();
    await waitFor(() => expect(wantToDo).toHaveBeenCalledTimes(1));
    expect(isOctoberKind(wantToDo.mock.calls[0]![0].entityKind)).toBe(true);
  });

  it("confirms it is in My October once it really is", async () => {
    await pickAFilm();
    expect(await screen.findByTestId("keep-kept")).toBeTruthy();
    expect(screen.getByTestId("keep-kept").textContent).toMatch(
      /it's in your october/i,
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it("says out loud when it could not be kept, and claims nothing", async () => {
    wantToDo.mockRejectedValueOnce(new Error("Couldn't keep that."));
    await pickAFilm();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]![0]).toMatch(/couldn't add/i);

    // The panel behind the toast used to read "It's in your October" on this
    // path too — a toast and a sentence disagreeing about the same fact.
    expect(await screen.findByTestId("keep-failed")).toBeTruthy();
    expect(screen.queryByTestId("keep-kept")).toBeNull();
    expect(screen.queryByText(/it's in your october/i)).toBeNull();
  });

  it("keeps nothing for a visitor, and does not pretend otherwise", async () => {
    await pickAFilm({ signedIn: false });

    expect(wantToDo).not.toHaveBeenCalled();
    expect(await screen.findByTestId("keep-signed-out")).toBeTruthy();
    expect(
      screen.getByText(/sign in and it would be waiting in your october/i),
    ).toBeTruthy();
    // A visitor is never told a thing was kept, because nothing was.
    expect(screen.queryByTestId("keep-kept")).toBeNull();
  });
});
