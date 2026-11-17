/**
 * **Is Go Have a Day waiting on a navigation right now?**
 *
 * One tiny external store, so the thin bar at the top of the page and every
 * control that starts a navigation agree on the answer. Two kinds of wait
 * feed it:
 *
 * - **A link or a form the person used** — `startLink()`, ended when the
 *   address changes. Started from the click itself, so the
 *   feedback is immediate rather than after the server has answered.
 * - **A transition a control is holding** — `hold()`, released by the
 *   control when its `useTransition` settles. A town change is one: the
 *   control knows exactly when its new results have arrived.
 *
 * Nothing here animates or decides how anything looks. It only says "yes".
 */
type Snapshot = { readonly link: boolean; readonly holds: number };

let state: Snapshot = { link: false, holds: 0 };
let linkTimer: ReturnType<typeof setTimeout> | undefined;
let watch: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

const set = (next: Snapshot) => {
  state = next;
  listeners.forEach((l) => l());
};

/**
 * How long a link may stay "loading" with no change of address. A real
 * navigation always changes it — even a 404 does — so reaching this means
 * the click was intercepted by something that never navigated, and a bar
 * left running for ever would be a lie of its own. Long enough to outlast
 * Atlas's slowest measured cold read (19 s), so a genuinely slow page is
 * never hidden.
 */
export const LINK_GIVE_UP_MS = 30_000;

const address = () =>
  typeof window === "undefined"
    ? ""
    : `${window.location.pathname}${window.location.search}`;

/**
 * A link's wait ends when the address changes — which the router does when
 * the new page commits. Watched by reading it, ten times a second and only
 * while waiting, rather than through the router's hooks: this store must work
 * on any page, under any test's mock of `next/navigation`.
 */
export function startLink(): void {
  clearTimeout(linkTimer);
  clearInterval(watch);
  linkTimer = setTimeout(endLink, LINK_GIVE_UP_MS);
  const from = address();
  watch = setInterval(() => {
    if (address() !== from) endLink();
  }, 100);
  if (!state.link) set({ ...state, link: true });
}

export function endLink(): void {
  clearTimeout(linkTimer);
  clearInterval(watch);
  if (state.link) set({ ...state, link: false });
}

/** A wait the caller ends by calling what this returns, once. */
export function hold(): () => void {
  set({ ...state, holds: state.holds + 1 });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    set({ ...state, holds: Math.max(0, state.holds - 1) });
  };
}

export const getProgress = (): Snapshot => state;
const IDLE: Snapshot = { link: false, holds: 0 };
export const getServerProgress = (): Snapshot => IDLE;

export function subscribeProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const isBusy = (s: Snapshot): boolean => s.link || s.holds > 0;

/**
 * **Would following this link leave the page the person is looking at?**
 *
 * The bar promises "something is on its way", so it starts only for a click
 * that will actually navigate inside the site: same origin, a different path
 * or query (a `#jump` is a scroll, not a load), the main button with no
 * modifier (those open a new tab), and no `target`/`download`.
 */
export function navigatesAway(
  href: string,
  here: { readonly href: string; readonly origin: string },
): boolean {
  let to: URL;
  let from: URL;
  try {
    to = new URL(href, here.href);
    from = new URL(here.href);
  } catch {
    return false;
  }
  if (to.origin !== here.origin) return false;
  if (to.protocol !== "http:" && to.protocol !== "https:") return false;
  return to.pathname !== from.pathname || to.search !== from.search;
}

/** Tests only. */
export function resetProgressForTest(): void {
  clearTimeout(linkTimer);
  clearInterval(watch);
  state = IDLE;
  listeners.forEach((l) => l());
}
