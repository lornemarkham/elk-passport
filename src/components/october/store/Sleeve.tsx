/**
 * **The printed face of a VHS case.**
 *
 * ## The artwork gap, stated plainly
 *
 * The target is the real period packaging — the 1988 Warner Home Video sleeves
 * and their contemporaries. This project has **no film artwork of any kind**:
 * `public/` holds one video and nothing else, there is no image pipeline, no
 * poster API credential, and the `imageUrl` field that exists in the codebase
 * belongs to Atlas *places*. Those sleeves are copyrighted studio packaging,
 * and pulling collector scans off the web is exactly what a prototype must not
 * do. So the artwork is **not** here, and cannot honestly be made to appear.
 *
 * What is here instead is the seam for it: set `art` on a cover to the path of
 * a supplied sleeve image and it takes over the whole face, full bleed, and
 * the drawn fallback steps aside. Drop scans into
 * `public/october/video-store/sleeves/` and point each cover at one — nothing
 * else in the scene has to change.
 *
 * Until then, each sleeve is **original** artwork laid out to period
 * convention: a colour field, one drawn mark, the title set heavy, and a
 * printed strip carrying the details a real box carried. Nothing is
 * reproduced, and nothing is claimed that the catalogue does not hold.
 *
 * Everything is sized as a fraction of the case, so one component serves a
 * tape asleep in a cubby and the same tape held up in front of you.
 */

export type Motif =
  | "moon"
  | "eye"
  | "door"
  | "house"
  | "ring"
  | "web"
  | "bolt"
  | "blade"
  | "blob"
  | "stripes"
  | "flare";

export interface Cover {
  /**
   * A supplied scan of the real packaging, wrapped onto the object: the front
   * panel, the spine and the back panel, cut fold to fold from one wrap so
   * they are continuous around the case. When this is set it takes over
   * completely; everything below it is the temporary fallback.
   */
  readonly art?: {
    readonly front: string;
    readonly spine: string;
    readonly back: string;
    /**
     * A sleeve panel is wider than the face it covers, because the printing
     * folds around the edges of the box — for this wrap, 0.596 against the
     * case's 0.545, so about nine per cent has to go somewhere. `object-fit`
     * takes it off, and these say which edge loses it. The front gives up its
     * left, which is hair and shadow, so the tagline and the classification
     * survive; the back gives up its right, which is bleed, so the credit
     * column does.
     */
    readonly frontBias?: string;
    readonly backBias?: string;
  };
  /** The sleeve's ground. */
  readonly field: string;
  /** The mark and, usually, the type. */
  readonly accent: string;
  /** Optional band colour for the back-cover header. */
  readonly ink?: string;
  /** Aged card the title is printed on, or `null` to print onto the art. */
  readonly plate: string | null;
  readonly motif: Motif;
  /** The title as the sleeve breaks it. Rental sleeves break titles. */
  readonly lines: readonly string[];
  /** Some sleeves carry their title at the head. */
  readonly titleHigh?: boolean;
}

/**
 * Everything below is a fraction of `width`, so one component draws the same
 * sleeve at twenty-four plate pixels asleep in a cubby and at a hundred and
 * sixty-three held in front of you. That is what keeps it sharp at both ends:
 * the case is *laid out* at the size it is being looked at, rather than being
 * a small drawing enlarged (see `VhsWall`).
 */
const SHELF_WIDTH = 24;

/**
 * The spine, which is all you would see of most of a shelf. Printed down the
 * edge the way every rental box printed it.
 */
export function Spine({
  cover,
  width,
  height,
  title,
}: {
  cover: Cover;
  width: number;
  height: number;
  title: string;
}) {
  if (cover.art) {
    return (
      <span aria-hidden className="absolute inset-0">
        <Panel src={cover.art.spine} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: cover.field,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          transform: "rotate(90deg)",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-jakarta), system-ui, sans-serif",
          fontSize: width * 0.34,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
          color: cover.accent,
          maxWidth: height,
          overflow: "hidden",
        }}
      >
        {title}
      </span>
    </span>
  );
}

export function Sleeve({
  cover,
  width,
  film,
}: {
  cover: Cover;
  width: number;
  film: { certification: { code: string }; runtimeMinutes: number };
}) {
  if (cover.art) {
    return (
      <span aria-hidden className="absolute inset-0">
        <Panel src={cover.art.front} bias={cover.art.frontBias} />
        <Plastic width={width} />
      </span>
    );
  }
  return <DrawnSleeve cover={cover} width={width} film={film} />;
}

function DrawnSleeve({
  cover,
  width,
  film,
}: {
  cover: Cover;
  width: number;
  film: { certification: { code: string }; runtimeMinutes: number };
}) {
  // Everything fixed below is authored in shelf pixels — what it would be on
  // a case asleep in its cubby — and multiplied up by however much bigger this
  // particular case is being drawn. A hairline stays a hairline.
  const S = width / SHELF_WIDTH;
  const w = width;
  // Heavy condensed caps run about 0.55 em per character. Fit the longest
  // line to the sleeve rather than picking one size and hoping.
  const longest = Math.max(...cover.lines.map((line) => line.length));
  const size = Math.min(w * 0.35, (w * 0.84) / (longest * 0.55));

  return (
    <span aria-hidden className="absolute inset-0">
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ background: cover.field }}
      />

      <Mark cover={cover} unit={S} />

      <span
        aria-hidden
        className="absolute inset-x-0 flex flex-col items-center"
        style={{
          [cover.titleHigh ? "top" : "bottom"]: cover.titleHigh ? "7%" : "11%",
          gap: size * 0.1,
          padding: cover.plate ? `${size * 0.36}px 6%` : "0 6%",
          margin: "0 6%",
          background: cover.plate ?? "transparent",
          boxShadow: cover.plate
            ? `inset 0 0 0 ${0.3 * S}px rgba(0,0,0,0.4), 0 ${0.3 * S}px ${0.6 * S}px rgba(0,0,0,0.5)`
            : undefined,
        }}
      >
        {cover.lines.map((line) => (
          <span
            key={line}
            style={{
              fontFamily: "var(--font-jakarta), system-ui, sans-serif",
              fontSize: size,
              lineHeight: 0.94,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              color: cover.plate ? "#17130e" : cover.accent,
              textShadow: cover.plate
                ? undefined
                : `0 ${0.25 * S}px ${0.5 * S}px rgba(0,0,0,0.85)`,
              whiteSpace: "nowrap",
              transform: "scaleX(0.92)",
            }}
          >
            {line}
          </span>
        ))}
      </span>

      {/* What every box of the period carried along the bottom: the format,
          the running time, the board's code. Real data, printed small. */}
      <span
        aria-hidden
        className="absolute right-0 bottom-0 left-0 flex items-center justify-between"
        style={{
          height: `${5.5}%`,
          padding: `0 ${0.09 * width}px`,
          background: "rgba(6,5,5,0.72)",
          borderTop: `${0.25 * S}px solid rgba(255,255,255,0.14)`,
          color: "rgba(233,226,212,0.72)",
          fontFamily: "var(--font-jakarta), system-ui, sans-serif",
          fontSize: width * 0.036,
          letterSpacing: "0.06em",
          fontWeight: 700,
        }}
      >
        <span>VHS</span>
        <span>{film.runtimeMinutes} MIN</span>
        <span>{film.certification.code}</span>
      </span>

      <Plastic width={width} />
    </span>
  );
}

/**
 * One printed panel of the wrap, filling the face it belongs to. The scan is
 * a few per cent wider than the face because the printing folds around the
 * box, so the excess goes where a real sleeve puts it — around the edges.
 */
export function Panel({ src, bias }: { src: string; bias?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      className="absolute inset-0 h-full w-full"
      style={{ objectFit: "cover", objectPosition: bias ?? "50% 50%" }}
    />
  );
}

/**
 * The clear overlay a sleeve lives behind, and the one hard line a real case
 * has. Scaled with the box, so a hairline stays a hairline.
 */
function Plastic({ width }: { width: number }) {
  const S = width / SHELF_WIDTH;
  return (
    <span
      aria-hidden
      className="absolute inset-0"
      style={{
        boxShadow: `inset 0 0 0 ${0.4 * S}px rgba(0,0,0,0.85), inset 0 ${0.6 * S}px 0 rgba(255,255,255,0.14), inset ${-0.5 * S}px 0 0 rgba(0,0,0,0.45)`,
      }}
    />
  );
}

/**
 * One shape per sleeve, built out of gradients and clip paths. They are read
 * at a glance and at a tiny size, so each is a silhouette and nothing more.
 */
function Mark({ cover, unit: S }: { cover: Cover; unit: number }) {
  const { accent, motif } = cover;
  const base: React.CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
  };

  switch (motif) {
    case "moon":
      return (
        <>
          <span
            aria-hidden
            style={{
              ...base,
              left: "22%",
              top: "14%",
              width: "56%",
              aspectRatio: "1",
              borderRadius: "50%",
              background: accent,
              opacity: 0.92,
            }}
          />
          <span
            aria-hidden
            style={{
              ...base,
              left: "8%",
              top: "8%",
              width: "56%",
              aspectRatio: "1",
              borderRadius: "50%",
              background: cover.field,
            }}
          />
        </>
      );
    case "eye":
      return (
        <>
          <span
            aria-hidden
            style={{
              ...base,
              left: "16%",
              top: "22%",
              width: "68%",
              height: "26%",
              borderRadius: "50%",
              background: accent,
            }}
          />
          <span
            aria-hidden
            style={{
              ...base,
              left: "40%",
              top: "27%",
              width: "20%",
              height: "16%",
              borderRadius: "50%",
              background: "rgba(6,4,4,0.92)",
            }}
          />
        </>
      );
    case "door":
      return (
        <span
          aria-hidden
          style={{
            ...base,
            left: "36%",
            top: "6%",
            width: "28%",
            height: "56%",
            background: `linear-gradient(to bottom, ${accent}, rgba(0,0,0,0))`,
            filter: `blur(${0.4 * S}px)`,
          }}
        />
      );
    case "house":
      return (
        <>
          <span
            aria-hidden
            style={{
              ...base,
              left: "24%",
              top: "16%",
              width: "52%",
              height: "22%",
              background: accent,
              clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
            }}
          />
          <span
            aria-hidden
            style={{
              ...base,
              left: "32%",
              top: "37%",
              width: "36%",
              height: "22%",
              background: accent,
              opacity: 0.85,
            }}
          />
        </>
      );
    case "ring":
      return (
        <span
          aria-hidden
          style={{
            ...base,
            left: "27%",
            top: "17%",
            width: "46%",
            aspectRatio: "1",
            borderRadius: "50%",
            border: `${S}px solid ${accent}`,
            boxShadow: `0 0 ${2 * S}px ${accent}`,
          }}
        />
      );
    case "web":
      return (
        <span
          aria-hidden
          style={{
            ...base,
            left: "18%",
            top: "10%",
            width: "64%",
            aspectRatio: "1",
            borderRadius: "50%",
            background: `repeating-conic-gradient(${accent} 0deg 2deg, rgba(0,0,0,0) 2deg 45deg)`,
            opacity: 0.65,
          }}
        />
      );
    case "bolt":
      return (
        <span
          aria-hidden
          style={{
            ...base,
            left: "34%",
            top: "10%",
            width: "32%",
            height: "48%",
            background: accent,
            clipPath:
              "polygon(58% 0%, 18% 52%, 44% 52%, 30% 100%, 82% 40%, 52% 40%)",
          }}
        />
      );
    case "blade":
      return (
        <span
          aria-hidden
          style={{
            ...base,
            left: "40%",
            top: "8%",
            width: "20%",
            height: "54%",
            background: `linear-gradient(to bottom, ${accent} 0%, rgba(255,255,255,0.5) 55%, rgba(0,0,0,0) 100%)`,
            clipPath: "polygon(48% 0%, 100% 18%, 62% 100%, 22% 84%)",
          }}
        />
      );
    case "blob":
      return (
        <span
          aria-hidden
          style={{
            ...base,
            left: "26%",
            top: "12%",
            width: "48%",
            height: "48%",
            borderRadius: "50% 50% 44% 44% / 62% 62% 38% 38%",
            background: `radial-gradient(ellipse at 40% 34%, ${accent}, rgba(255,255,255,0.1) 78%)`,
            filter: `blur(${0.3 * S}px)`,
          }}
        />
      );
    case "stripes":
      return (
        <span
          aria-hidden
          style={{
            ...base,
            inset: 0,
            background: `repeating-linear-gradient(94deg, ${accent} 0 ${1.6 * S}px, rgba(0,0,0,0) ${1.6 * S}px ${4.2 * S}px)`,
            opacity: 0.55,
          }}
        />
      );
    case "flare":
      return (
        <span
          aria-hidden
          style={{
            ...base,
            left: "30%",
            top: "12%",
            width: "40%",
            height: "40%",
            background: `radial-gradient(circle, ${accent} 0%, rgba(0,0,0,0) 62%)`,
          }}
        />
      );
  }
}
