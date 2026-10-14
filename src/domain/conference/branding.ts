/**
 * **The organiser's colour, made safe to paint with.**
 *
 * The accent is validated as `#rrggbb` before it is stored; this re-checks,
 * because it ends up inside a `style` attribute, and picks black or white
 * text for it so an organiser choosing pale yellow does not make their own
 * buttons unreadable.
 */
const HEX = /^#[0-9a-f]{6}$/i;
export const DEFAULT_ACCENT = "#1f6feb";

export const safeAccent = (accent: string | undefined): string =>
  accent && HEX.test(accent) ? accent.toLowerCase() : DEFAULT_ACCENT;

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Text colour for something filled with `accent`. */
export function inkOn(accent: string): "#000000" | "#ffffff" {
  const l = luminance(safeAccent(accent));
  // Contrast against white vs. against black; pick the larger.
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "#ffffff" : "#000000";
}
