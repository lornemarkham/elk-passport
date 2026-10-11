"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

/**
 * **GO HAVE A DAY — the accent, and only the accent.**
 *
 * The ground is white and the text is near-black on every surface. The accent
 * appears on what is live or chosen — a selected control, a focus ring, the
 * rule under the wordmark — and nowhere else. **Photography is the colour.**
 * A section tinted orange would be the tourism brochure this is not.
 *
 * Both themes are chosen for contrast on white: burnt orange `#C65A2E` and
 * forest green `#28734A` both clear 4.5:1 against `#FFFFFF`, so accent text is
 * readable rather than decorative, and white text on the accent clears it too.
 */
export const THEMES = {
  orange: { name: "Burnt orange", accent: "#C65A2E", ink: "#ffffff" },
  green: { name: "Forest green", accent: "#28734A", ink: "#ffffff" },
} as const;

export type ThemeKey = keyof typeof THEMES;

/** Burnt orange unless somebody has said otherwise. */
export const DEFAULT_THEME: ThemeKey = "orange";

const KEY = "ghad.theme";

const ThemeContext = createContext<{
  theme: ThemeKey;
  setTheme: (next: ThemeKey) => void;
}>({ theme: DEFAULT_THEME, setTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

/**
 * **`localStorage` is an external store, so it is read as one.**
 *
 * There is no `localStorage` on the server, and a value that differs between
 * the server's render and the browser's is exactly what `useSyncExternalStore`
 * exists for: `getServerSnapshot` hands React the default for the markup, the
 * browser subscribes, and the stored choice arrives without a hydration
 * mismatch and without a `setState` in an effect. Passport already reads the
 * reader's position this way; this is the same shape.
 *
 * Every read and write is wrapped: a private window, blocked site data, or a
 * browser that refuses storage must not break Discovery over a colour.
 */
const listeners = new Set<() => void>();

/** The applied choice, mirrored in memory so storage is read once per change. */
let current: ThemeKey | null = null;

const read = (): ThemeKey => {
  if (current) return current;
  try {
    const stored = window.localStorage.getItem(KEY);
    current =
      stored === "orange" || stored === "green" ? stored : DEFAULT_THEME;
  } catch {
    // Storage refused. The default is a perfectly good answer.
    current = DEFAULT_THEME;
  }
  return current;
};

/**
 * Drop the in-memory mirror so the next read goes back to storage.
 *
 * Exists for tests, which mount the provider many times in one process where a
 * browser would have mounted it once per page load. Named after
 * `forgetAtlasReads`, which solves the same problem one layer down.
 */
export function forgetTheme(): void {
  current = null;
}

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

function applyTheme(next: ThemeKey) {
  current = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // Not persisted, still applied for this visit.
  }
  for (const notify of [...listeners]) notify();
}

export function ThemeProvider({
  children,
  className = "contents",
}: {
  readonly children: React.ReactNode;
  /**
   * `display: contents` by default, so the wrapper carries the variables and
   * takes part in no layout at all.
   *
   * It had a plain `<div>`, which became a block inside `body`'s flex column
   * and stopped the white `<main>` filling the page — at 1440 the product sat
   * in a column with Passport's cream topo texture either side of it. Custom
   * properties inherit through `display: contents` exactly as they do through
   * anything else, so nothing is lost by getting out of the way.
   */
  readonly className?: string;
}) {
  const theme = useSyncExternalStore(subscribe, read, () => DEFAULT_THEME);
  const setTheme = applyTheme;

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div
        className={className}
        data-ghad-theme={theme}
        style={
          {
            "--ghad-accent": THEMES[theme].accent,
            "--ghad-accent-ink": THEMES[theme].ink,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

/** Two swatches. Not a settings panel — it is a colour, not a preference. */
export function ThemePicker({
  className = "",
}: {
  readonly className?: string;
}) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
        <button
          key={key}
          type="button"
          data-testid={`theme-${key}`}
          aria-pressed={theme === key}
          aria-label={THEMES[key].name}
          title={THEMES[key].name}
          onClick={() => setTheme(key)}
          style={{ backgroundColor: THEMES[key].accent }}
          className={
            "h-4 w-4 rounded-full transition-all " +
            (theme === key
              ? "ring-2 ring-black/70 ring-offset-2"
              : "opacity-45 hover:opacity-100")
          }
        />
      ))}
    </div>
  );
}
