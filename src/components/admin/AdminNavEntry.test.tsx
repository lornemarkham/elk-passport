import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

type Listener = (event: string, session: unknown) => void;
let listener: Listener | undefined;

vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({
    auth: {
      onAuthStateChange: (cb: Listener) => {
        listener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  }),
}));

import { AdminNavEntry } from "./AdminNavEntry";

afterEach(() => {
  vi.unstubAllGlobals();
  listener = undefined;
});

const stubFetch = (admin: boolean) => {
  const fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ admin }),
  }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

describe("AdminNavEntry", () => {
  it("asks nothing of the server for a visitor with no session", () => {
    const fetch = stubFetch(false);
    render(<AdminNavEntry />);
    act(() => listener?.("INITIAL_SESSION", null));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks once for somebody signed in, and shows the link to an administrator", async () => {
    const fetch = stubFetch(true);
    render(<AdminNavEntry />);
    act(() => listener?.("INITIAL_SESSION", { user: { id: "u" } }));
    act(() => listener?.("TOKEN_REFRESHED", { user: { id: "u" } }));
    await waitFor(() =>
      expect(screen.getByText("Curator Workbench")).toBeTruthy(),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("hides the link on sign-out without asking", async () => {
    const fetch = stubFetch(true);
    render(<AdminNavEntry />);
    act(() => listener?.("SIGNED_IN", { user: { id: "u" } }));
    await waitFor(() =>
      expect(screen.getByText("Curator Workbench")).toBeTruthy(),
    );
    act(() => listener?.("SIGNED_OUT", null));
    expect(screen.queryByText("Curator Workbench")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
