import type { Film } from "@/lib/movies/catalogue";
import { Panel, type Cover } from "./Sleeve";

/**
 * **The back of a rental copy.**
 *
 * ## What this is, and what it deliberately is not
 *
 * The target is the studio's own period back cover — the stills, the blurb,
 * the credit block, the distributor's trade dress. **None of that exists in
 * this project** (see `Sleeve` for the artwork audit), and the copy on a real
 * sleeve is the studio's writing about a real film. Inventing a synopsis, a
 * pull quote or a credit block would be putting words in a distributor's
 * mouth, so none of it is here and none of it is faked.
 *
 * What is here instead is true of *our* store: the back of a **rental** copy,
 * where the shop's own furniture covered most of the box anyway. A date-due
 * card. A rewind stamp. A catalogue sticker. All of it period, all of it ours
 * to invent, none of it a claim about the film.
 *
 * And then October, which is the point: October does not redesign the box, it
 * **intrudes on it**. A card taped over where the blurb was, with one phrase
 * scratched through by the same hand that did the header.
 *
 * When authentic back-cover art is supplied, this whole component gives way to
 * it and the intrusion stays on top — that is why the intrusion is a separate
 * layer rather than part of the layout.
 */
export function BackCover({
  film,
  cover,
  width,
  onTrailer,
  onPutBack,
}: {
  film: Film;
  cover: Cover;
  width: number;
  onTrailer: () => void;
  onPutBack: () => void;
}) {
  const u = (f: number) => width * f;
  const trailer = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${film.title} ${film.year} trailer`,
  )}`;
  const stamps = ["OCT 14", "OCT 22", "OCT 29", "NOV 03"];

  /**
   * **When the real packaging exists, it is the back.**
   *
   * Everything below this line — the date card, the rewind stamp, October's
   * taped note — is the stand-in for a back cover this project does not have.
   * It is not an improvement on a real one and it does not get to sit on top
   * of one. A tape with a scan wears the scan, and Passport attaches nothing
   * to it: how this artifact carries function is a design question that comes
   * after it is convincing, not before.
   */
  if (cover.art) {
    return (
      <span className="absolute inset-0">
        <Panel src={cover.art.back} bias={cover.art.backBias} />
      </span>
    );
  }

  return (
    <span
      className="absolute inset-0 flex flex-col"
      style={{
        background:
          "linear-gradient(174deg,#232019 0%,#1a1712 46%,#100e0b 100%)",
        color: "#cfc4ad",
        fontFamily: "var(--font-jakarta), system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* The only thing the box itself still says clearly. */}
      <span
        style={{
          background: cover.plate ?? cover.field,
          padding: `${u(0.03)}px ${u(0.055)}px`,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: u(0.04),
          boxShadow: `inset 0 ${-u(0.006)}px 0 rgba(0,0,0,0.55)`,
        }}
      >
        <span
          style={{
            fontSize: u(0.068),
            fontWeight: 800,
            letterSpacing: "-0.015em",
            textTransform: "uppercase",
            lineHeight: 1,
            color: "#0f0c09",
            transform: "scaleX(0.94)",
            transformOrigin: "left",
          }}
        >
          {film.title}
        </span>
        <span
          style={{
            fontSize: u(0.038),
            fontWeight: 800,
            color: "#0f0c09",
            opacity: 0.66,
          }}
        >
          {film.year}
        </span>
      </span>

      <span style={{ position: "relative", flex: 1 }}>
        {/* Where the studio's back-cover art would be. Left as the box's own
            colour rather than filled with something invented — this is the
            missing asset, showing honestly as an unprinted panel. */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background: cover.field,
            opacity: 0.13,
            mixBlendMode: "screen",
          }}
        />
        {/* The shop's date card, glued on crooked years ago. */}
        <span
          style={{
            position: "absolute",
            left: "7%",
            right: "34%",
            top: "6%",
            background: "rgba(196,182,152,0.82)",
            color: "#241d14",
            transform: "rotate(0.8deg)",
            padding: `${u(0.022)}px ${u(0.03)}px ${u(0.03)}px`,
            boxShadow: `0 ${u(0.006)}px ${u(0.016)}px rgba(0,0,0,0.5)`,
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: u(0.026),
              letterSpacing: "0.3em",
              opacity: 0.6,
              marginBottom: u(0.018),
            }}
          >
            DATE DUE
          </span>
          <span
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: `${u(0.012)}px ${u(0.05)}px`,
            }}
          >
            {stamps.map((d, i) => (
              <span
                key={d}
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: u(0.032),
                  letterSpacing: "0.04em",
                  opacity: 0.32 + i * 0.13,
                  transform: `rotate(${(i % 2 ? 1 : -1) * 1.4}deg)`,
                }}
              >
                {d}
              </span>
            ))}
          </span>
        </span>

        {/* Every rental copy in the country said this. */}
        <span
          style={{
            position: "absolute",
            right: "6%",
            top: "5%",
            width: "26%",
            textAlign: "center",
            fontSize: u(0.03),
            lineHeight: 1.25,
            letterSpacing: "0.12em",
            color: "rgba(176,74,58,0.62)",
            border: `${u(0.005)}px solid rgba(176,74,58,0.5)`,
            padding: `${u(0.016)}px ${u(0.01)}px`,
            transform: "rotate(-6deg)",
            textTransform: "uppercase",
          }}
        >
          Please
          <br />
          be kind
          <br />
          rewind
        </span>

        {/* October's card, taped over where the blurb used to be. */}
        <span
          style={{
            position: "absolute",
            left: "7%",
            right: "7%",
            bottom: "4%",
            background: "rgba(226,214,188,0.93)",
            color: "#17120c",
            transform: "rotate(-0.7deg)",
            padding: `${u(0.035)}px ${u(0.045)}px`,
            boxShadow: `0 ${u(0.01)}px ${u(0.026)}px rgba(0,0,0,0.6)`,
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: "-4%",
              top: `${-u(0.022)}px`,
              width: "26%",
              height: u(0.05),
              background: "rgba(214,199,162,0.55)",
              transform: "rotate(-5deg)",
            }}
          />
          <span style={{ position: "relative", display: "block" }}>
            <span
              style={{
                fontFamily: "var(--font-fraunces), Georgia, serif",
                fontSize: u(0.05),
                lineHeight: 1.4,
                display: "block",
              }}
            >
              {film.line}
            </span>
            {/* Struck through by the same hand that did the header. */}
            <svg
              aria-hidden
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                left: "-2%",
                bottom: `-${u(0.012)}px`,
                width: "62%",
                height: u(0.05),
                overflow: "visible",
              }}
            >
              <path
                d="M1 6 L28 3.4 L57 6.8 L62 4.2"
                fill="none"
                stroke="#241a11"
                strokeOpacity="0.62"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </span>
      </span>

      {/* What a person at the shelf can do with it, stamped on rather than
          floated beside it. */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: u(0.04),
          padding: `${u(0.028)}px ${u(0.055)}px`,
          background: "rgba(0,0,0,0.34)",
        }}
      >
        <a
          href={trailer}
          target="_blank"
          rel="noreferrer"
          data-testid={`trailer-${film.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onTrailer();
          }}
          style={{
            fontSize: u(0.038),
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(196,182,152,0.9)",
            border: `${u(0.005)}px solid rgba(196,182,152,0.45)`,
            padding: `${u(0.014)}px ${u(0.026)}px`,
            transform: "rotate(-0.9deg)",
          }}
        >
          Trailer
        </a>
        <button
          type="button"
          data-testid={`putback-${film.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onPutBack();
          }}
          style={{
            fontSize: u(0.034),
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: "transparent",
            border: 0,
            padding: 0,
            cursor: "pointer",
            color: "inherit",
            opacity: 0.5,
          }}
        >
          ◀ Shelf
        </button>
      </span>

      {/* The catalogue sticker, and the only numbers anybody checked. */}
      <span
        style={{
          borderTop: `${u(0.004)}px solid rgba(207,196,173,0.16)`,
          padding: `${u(0.026)}px ${u(0.055)}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: u(0.04),
          fontSize: u(0.03),
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          opacity: 0.55,
        }}
      >
        <span>
          {film.runtimeMinutes} min
          {film.certification
            ? ` · ${film.certification.code} (${film.certification.system})`
            : ""}
        </span>
        <span
          style={{
            width: u(0.22),
            height: u(0.07),
            background:
              "repeating-linear-gradient(90deg,#cfc4ad 0 7%,transparent 7% 12%,#cfc4ad 12% 16%,transparent 16% 25%)",
            opacity: 0.75,
          }}
        />
      </span>
    </span>
  );
}
