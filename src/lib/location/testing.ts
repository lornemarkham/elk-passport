import type { PassportLocation } from "./useLocation";

/**
 * **A visitor whose place is not known yet**, for tests of a page that is
 * about something else. `vi.mock("@/lib/location/useLocation", () =>
 * import("@/lib/location/testing"))` keeps the module-level shared place from
 * leaking between tests; a test about the place itself uses the real hook.
 */
export const useLocation = (): PassportLocation => ({
  ready: false,
  approximate: false,
  recent: [],
  hasDestination: false,
  choose: () => {},
  makeHome: () => {},
  forgetHome: () => {},
  followShared: () => {},
  locate: async () => ({ ok: false, why: "failed" }),
});
