/**
 * **What October shows while it is genuinely waiting.**
 *
 * A seam of warm light, the kind that comes from under a closed door, slowly
 * brightening and dimming. It is the room's own vocabulary — the Secret Room
 * has exactly this line under its door — rather than a spinner borrowed from
 * somewhere else.
 *
 * ## The rule this is built against
 *
 * **An intentional pause stays empty. A technical wait does not.**
 *
 * October's silences are the product: the eleven seconds it spends looking at
 * your photograph, the sixteen you spend failing to find the way out. Those
 * are written, and nothing may be drawn over them. This is for the other kind
 * of waiting — a route fetching, a plate decoding — where an empty screen is
 * not a held breath, it is a person wondering whether the tab has died.
 *
 * ## No text
 *
 * Deliberately wordless. \"Loading…\" would answer a question October has not
 * been asked, and any copy here would be the first thing in the whole
 * experience written by the software rather than by October.
 */
export function Waiting({ className = "" }: { readonly className?: string }) {
  return (
    <div
      className={`pointer-events-none flex min-h-[60vh] items-center justify-center ${className}`}
      // A live region would announce a pulse of light, which is nothing. The
      // accessible name is on the seam itself.
      aria-hidden
    >
      <style>{`
        @keyframes october-seam {
          0%, 100% { opacity: .16; transform: scaleX(.82); }
          50%      { opacity: .62; transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .october-seam { animation: none !important; opacity: .4 !important; }
        }
      `}</style>
      <span
        className="october-seam block h-px w-44 rounded-full bg-[#ffcf8a]"
        style={{
          filter: "blur(1.5px)",
          boxShadow: "0 0 26px 5px rgba(255,190,110,0.35)",
          animation: "october-seam 2600ms ease-in-out infinite",
        }}
      />
    </div>
  );
}
