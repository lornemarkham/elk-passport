"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  asPercent,
  Box,
  CAMERA,
  caseBox,
  cavityLevel,
  cubbyAt,
  HELD,
  liftTo,
  PLATE,
  READ,
  VHS_ASPECT,
  VHS_DEPTH_RATIO,
} from "./shelfGeometry";
import { Sleeve, Spine } from "./Sleeve";
import { BackCover } from "./BackCover";
import { CarvedHeader } from "./CarvedHeader";
import { Atmosphere, type AtmosphereHandle } from "./Atmosphere";
import { Presence, type PresenceVariant } from "./Presence";
import {
  OFFERED_ID,
  REFUSED_ID,
  WALL_TAPES,
  type Placement,
} from "./wallTapes";
import type { CueKind, CueSink } from "./cues";
import { kickFor, type Kick } from "./shelfShock";
import { handled, UNTOUCHED, type Touch } from "./touch";
import {
  poseAlong,
  simulateRejection,
  turnAlong,
  type Rejection,
} from "./rejection";
import { armSound, playImpact, playSlide } from "./sound";

/**
 * **A section of an old video store you can browse, handle and put back.**
 *
 * ## One world
 *
 * The plate is 854 × 480. A full-bleed `object-fit: cover` video would crop
 * itself by rules the overlay cannot see, so the video is **not**
 * cover-fitted: one stage element is sized to the plate and scaled to cover
 * the viewport, and the footage, the carving in the header, every tape and the
 * lights all live inside it in the plate's own coordinates. They crop, drift
 * and light identically because they are the same box.
 *
 * ## Picking one up is projection, not a modal
 *
 * Four stops, and the whole thing takes about 600 ms, because reaching for a
 * tape on a shelf takes about 600 ms. The case **slides out of its cavity**
 * and turns as it comes, which puts its spine in view — real geometry, a
 * 30 mm slab with a front, a back and two edges. Then it **travels through Z**
 * into your hands, where it is small enough that you are plainly still
 * standing in the store. Nothing is scaled up, nothing morphs into a card, and
 * the room never dims or steps aside for it.
 *
 * ## The case is the interface
 *
 * There is no panel. Click the tape you are holding and it turns over, and
 * comes closer as it turns, because that is what a person does with the back
 * of a box. What a rental box printed on the back is what is printed on the
 * back.
 *
 * ## Why the box is re-expressed when it arrives
 *
 * A browser rasterises a layer at the scale its transform had when it drew it,
 * and does not redraw a 3D-transformed layer because the transform settled
 * somewhere bigger. So once the case is still, the same element is re-stated:
 * the box becomes the size the projection had already put it at, and the
 * flight transform comes off. The arithmetic is exact, so nothing moves — and
 * the sleeve is finally drawn at the size it is being looked at. Each swap
 * gets a frame with no transition running, or the browser helpfully animates
 * the case through a pose it was never in.
 */

/**
 * **The camera is allowed to look around, a little.**
 *
 * The scene is rendered slightly larger than the window so there is room off
 * each edge to look into, and the pointer aims the head — slowly, eased, and
 * never further than `DRIFT_LIMIT` plate pixels from centre. It moves the
 * **stage**, the one element everything physical lives inside, so the footage
 * cannot slide independently of the woodwork.
 *
 * While a tape is in hand the head stops: the pointer cannot mean *look around
 * the room* and *inspect this object* at the same time. It settles to square
 * and picks the pointer back up when the tape goes home.
 */
const OVERSCAN = 1.06;
const DRIFT_LIMIT = 14;
const DRIFT_EASE = 0.035;

/** Degrees the case turns as it comes out, and keeps in the hand. */
const TURN_OUT = 16;
const TURN_HELD = 11;

/**
 * Reach, pull, travel, settle — about six hundred milliseconds of it.
 *
 * The pull does **not** go straight out of the cavity. A tape that only
 * translates in Z moves *away from the vanishing point* on screen, so a tape
 * above the camera axis rises, and then has to come back down again when the
 * travel takes over. Measured, that was a 7-pixel climb followed by an
 * 80-pixel descent: the dip and correction the shelf looked like it had.
 * So the pull is solved, not guessed: it comes `PULL_DEPTH` plate pixels out
 * of the cavity, and lands exactly where a straight line from the cubby to
 * your hand passes at the size that depth implies. The two stages are then
 * the same line, handed over while still accelerating.
 */
const PULL_MS = 150;
/** Plate pixels out of the cavity on the pull — three case-depths clear. */
const PULL_DEPTH = 90;
const LIFT_MS = 440;
/**
 * **Putting it back is one move, not two.**
 *
 * The old return went hand → just-outside-the-cavity → cavity, in two
 * transitions that each decelerated to a stop, and it swapped coordinate
 * systems in the middle. One transition along the same line the pickup used
 * removes the seam entirely: the case travels away, comes into line with the
 * shelf as it goes, and the last of the ease is the slide into the cavity.
 */
const RETURN_MS = 560;
const FLIP_MS = 520;

type Motion =
  "rest" | "hover" | "emerging" | "held" | "returning" | "seized" | "offered";

/** The refusal runs on its own clock; nothing else on the wall responds. */
type Phase = "idle" | "seizing" | "settling";
type Handling = "none" | "emerging" | "lifting" | "arrived";

/**
 * A tape on its way home, tracked separately from the one in your hand so the
 * two can be in the air at once: clicking a second tape starts this one
 * leaving while that one is already coming out.
 *
 * `settling` is false for exactly one frame — where the case stops being a
 * laid-out box in front of you and becomes a transform again, with nothing
 * interpolating, before it is allowed to move.
 */
interface Leaving {
  readonly id: string;
  readonly settling: boolean;
  /** It goes home the way you were holding it, and turns back over en route. */
  readonly flipped: boolean;
}

interface VhsWallProps {
  /**
   * Forces October's refusal on the designated tape, every time, instead of
   * leaving it to chance. Driven by `?intervene=1` so the beat can be screened
   * and reviewed deterministically.
   */
  readonly alwaysIntervene?: boolean;
  /**
   * `?anomaly=1` arms the presence in the right aisle. It needs a photograph
   * that this project has not been given — see `Presence` — so with the flag
   * on and no asset, nothing happens, which is the correct failure.
   */
  readonly anomalies?: boolean;
  /**
   * `?presence=1`: the whole sequence, on a short predictable delay after the
   * first click or key, every refresh. For judging it, not for shipping it.
   */
  readonly forcePresence?: PresenceVariant | null;
  /**
   * Every moment this scene would make a noise. Nothing listens yet; see
   * `cues.ts` for why the seam exists and what it has to carry.
   */
  readonly onCue?: CueSink;
}

const HIT = WALL_TAPES.find((t) => t.id === REFUSED_ID)!;

/**
 * **October's refusal, solved once at module load.**
 *
 * It depends on nothing but the shape of the cavity the tape comes out of, so
 * it is the same struggle every time — which is the point. See `rejection.ts`
 * for the forces; the numbers below only schedule what happens *around* it.
 */
const SEIZURE: Rejection = simulateRejection();

/** Nothing at all, for long enough that the room has clearly gone quiet. */
const STILL_MS = 900;
/** How far out of its cavity the offered tape comes, along the same line. */
const OFFER_S = 0.2;
const OFFER_MS = 2200;

export function VhsWall({
  alwaysIntervene = false,
  anomalies = false,
  forcePresence = null,
  onCue,
}: VhsWallProps) {
  const sink = useRef(onCue);
  useEffect(() => {
    sink.current = onCue;
  }, [onCue]);
  const cue = useCallback(
    (kind: CueKind, x: number, y: number, force = 1) =>
      sink.current?.({ kind, x, y, force }),
    [],
  );
  const plate = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [inHand, setInHand] = useState<string | null>(null);
  const [handling, setHandling] = useState<Handling>("none");
  /** True for the frames where the box and the transform trade places. */
  const [swapping, setSwapping] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  /** What each tape carries from having been handled. See `touch.ts`. */
  const [touch, setTouch] = useState<Record<string, Touch>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [offered, setOffered] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lights = useRef<AtmosphereHandle | null>(null);
  /** Rises once when something hits the shelf; every tape feels its own share. */
  const [shock, setShock] = useState(0);

  const camera = useRef({
    scale: 1,
    drift: 0,
    target: 0,
    reach: 0,
    /**
     * The unit being struck. Not a decaying nudge and not screen shake: an
     * impulse into a stiff spring, so it snaps one way, comes back past
     * square once, and is still — which is what a heavy thing hitting
     * shelving does to the shelving.
     */
    jolt: 0,
    joltV: 0,
    free: true,
  });

  const paint = useCallback(() => {
    const el = stage.current;
    if (!el) return;
    const c = camera.current;
    // The drift is applied *after* the scale, so it is measured in plate
    // pixels like everything else in this file.
    el.style.transform = `translate(-50%, -50%) scale(${c.scale}) translateX(${c.drift + c.jolt}px)`;
  }, []);

  /**
   * Aim the head. `fraction` runs −1 (hard left) to +1 (hard right), which is
   * the single seam the camera has: the pointer drives it here, and a phone's
   * `deviceorientation` gamma would drive the same call.
   */
  const aim = useCallback((fraction: number) => {
    const c = camera.current;
    if (!c.free) return;
    c.target = -Math.max(-1, Math.min(1, fraction)) * c.reach;
  }, []);

  useEffect(() => {
    const fit = () => {
      const c = camera.current;
      c.scale =
        Math.max(
          window.innerWidth / PLATE.width,
          window.innerHeight / PLATE.height,
        ) * OVERSCAN;
      const slack = (PLATE.width - window.innerWidth / c.scale) / 2;
      c.reach = Math.max(0, Math.min(slack * 0.75, DRIFT_LIMIT));
      c.target = Math.max(-c.reach, Math.min(c.reach, c.target));
      paint();
    };
    fit();
    window.addEventListener("resize", fit);
    const running = timers.current;
    return () => {
      window.removeEventListener("resize", fit);
      for (const t of running) clearTimeout(t);
    };
  }, [paint]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: PointerEvent) =>
      aim((e.clientX / window.innerWidth) * 2 - 1);
    window.addEventListener("pointermove", onMove);

    let frame = 0;
    const tick = () => {
      const c = camera.current;
      const gap = c.target - c.drift;
      let moved = false;
      if (Math.abs(gap) > 0.008) {
        c.drift += gap * DRIFT_EASE;
        moved = true;
      }
      if (Math.abs(c.jolt) > 0.008 || Math.abs(c.joltV) > 0.05) {
        c.joltV += (-900 * c.jolt - 33 * c.joltV) * 0.016;
        c.jolt += c.joltV * 0.016;
        moved = true;
      } else if (c.jolt !== 0 || c.joltV !== 0) {
        c.jolt = 0;
        c.joltV = 0;
        moved = true;
      }
      if (moved) paint();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [aim, paint]);

  /** The plate is the room, so it is never allowed to be a still. */
  useEffect(() => {
    const resume = () => {
      const video = plate.current;
      if (video && video.paused && !document.hidden)
        void video.play().catch(() => {});
    };
    resume();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, []);

  /**
   * No browser will make a sound before the person has done something, so the
   * audio rig is built on the first click or key and is a silent no-op until
   * then. Nothing in the scene depends on it: every beat reads muted.
   */
  useEffect(() => {
    const arm = () => armSound();
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  /**
   * **October's refusal.** No modal, no toast, no sentence.
   *
   * The tape starts out exactly as a tape does, which is what makes the next
   * part land: two tenths of a second in, something puts it back — hard, in
   * ninety milliseconds, past where it was sitting — and the room takes the
   * hit with it. Then nothing at all for a second. Then, further along the
   * shelf, a different tape eases itself out, slowly enough that you are
   * certain you are being answered.
   */
  const refuse = useCallback(
    (at: { x: number; y: number }) => {
      setHovered(null);
      setPhase("seizing");
      cue("pull", at.x, at.y, 0.6);
      playSlide(at.x, 0.7);
      // Knocked about. The wall keeps the consequence, within its bounds.
      setTouch((prior) => ({
        ...prior,
        [REFUSED_ID]: handled(REFUSED_ID, prior[REFUSED_ID]),
      }));

      after(SEIZURE.cues.hauled * 1000, () => {
        cue("tension", at.x, at.y, 0.5);
        playSlide(at.x, 0.45);
      });
      after(SEIZURE.cues.snap * 1000, () => cue("seize", at.x, at.y, 0.9));
      after(SEIZURE.impactAt * 1000, () => {
        camera.current.joltV = -300 * SEIZURE.impactForce;
        lights.current?.stagger();
        setShock((n) => n + 1);
        playImpact(at.x, SEIZURE.impactForce);
        cue("shove", at.x, at.y, SEIZURE.impactForce);
        cue("resonance", at.x, at.y, SEIZURE.impactForce * 0.8);
        cue("rattle", at.x, at.y, SEIZURE.impactForce * 0.8);
      });
      after(SEIZURE.duration * 1000, () => setPhase("settling"));
      after(SEIZURE.duration * 1000 + STILL_MS, () => {
        setOffered(true);
        setPhase("idle");
        cue("offer", at.x, at.y, 0.3);
      });
    },
    [after, cue],
  );

  /**
   * **Letting go.** One move: the case travels back down the line it came up,
   * comes into line with the shelf on the way, and the tail of the ease is it
   * sliding into the cavity. It also arrives changed — a fraction off where it
   * was, because it has been handled now (`touch.ts`).
   *
   * ## Why this is written so carefully
   *
   * A case in your hand is a **laid-out box**; a case in flight is a
   * **transform**. Those two kinds of change do not behave the same way: the
   * box takes effect at once, and the transform transitions. Write both in one
   * go and the browser starts the transition from the pose the case used to
   * have *applied to the box it now has* — which is how the old return began
   * by teleporting into the cavity at 57% scale and then growing back out of
   * it. The boing.
   *
   * So the swap is given a commit of its own with nothing interpolating, and
   * the layout is read back before anything is allowed to move. That read is
   * not decoration: it forces the style recalculation that gives the return a
   * correct value to start from. Batching, a timer or a frame will not do it —
   * all three let the browser coalesce the two states and see only the second.
   */
  const release = useCallback(
    (id: string, wasFlipped: boolean, fromHand: boolean) => {
      cue("stow", 0.5, 0.5, 0.45);
      flushSync(() => {
        setTouch((prior) => ({ ...prior, [id]: handled(id, prior[id]) }));
        setInHand(null);
        setFlipped(false);
        setHandling("none");
        camera.current.free = true;
        setLeaving({ id, settling: false, flipped: wasFlipped });
        setSwapping(fromHand);
      });
      if (fromHand) {
        // Read, so the browser computes the still pose before it is asked to
        // leave it. Do not remove this because it looks like it does nothing.
        document
          .querySelector(`[data-testid="case-${id}"]`)
          ?.getBoundingClientRect();
      }
      setLeaving({ id, settling: true, flipped: wasFlipped });
      setSwapping(false);
      after(RETURN_MS + 60, () =>
        setLeaving((l) => (l && l.id === id ? null : l)),
      );
    },
    [after, cue],
  );

  const putBack = useCallback(() => {
    if (!inHand) return;
    release(inHand, flipped, handling === "arrived");
  }, [inHand, flipped, handling, release]);

  function grab(tape: Placement) {
    if (phase !== "idle" || tape.id === inHand || leaving?.id === tape.id)
      return;
    // **Switching.** The one you were holding starts for the shelf in the same
    // tick the new one starts coming out, so the exchange is one movement
    // rather than a close followed by an open.
    if (inHand) release(inHand, flipped, handling === "arrived");
    if (alwaysIntervene && tape.id === REFUSED_ID) {
      const c = cubbyAt(tape.row, tape.col);
      refuse({
        x: (c.x + c.width / 2) / PLATE.width,
        y: (c.top + c.floor) / 2 / PLATE.height,
      });
      return;
    }
    setHovered(null);
    setInHand(tape.id);
    setFlipped(false);
    setHandling("emerging");
    setSwapping(false);
    // The head stops looking around the moment there is something in it.
    camera.current.free = false;
    camera.current.target = 0;
    cue("pull", 0.5, 0.5, 0.6);
    after(PULL_MS, () => setHandling("lifting"));
    after(PULL_MS + LIFT_MS, () =>
      setHandling((h) => {
        if (h !== "lifting") return h;
        setSwapping(true);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setSwapping(false)),
        );
        cue("settle", 0.46, 0.5, 0.5);
        return "arrived";
      }),
    );
  }

  useEffect(() => {
    if (!inHand) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") putBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inHand, putBack]);

  /** 0–1 while the header is being cut; the room shades a little as it goes. */
  const [carving, setCarving] = useState(0);
  const onCarve = useCallback((progress: number) => setCarving(progress), []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* Putting it back by putting it down: anywhere that is not the tape. */}
      {inHand && (
        <button
          type="button"
          aria-label="Put it back"
          data-testid="backdrop"
          onClick={putBack}
          className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
        />
      )}

      <div
        ref={stage}
        className="absolute top-1/2 left-1/2"
        style={{
          width: PLATE.width,
          height: PLATE.height,
          transformOrigin: "center",
          perspective: CAMERA.perspective,
          perspectiveOrigin: `${CAMERA.originX * 100}% ${CAMERA.originY * 100}%`,
          pointerEvents: inHand ? "none" : undefined,
        }}
      >
        <video
          ref={plate}
          className="absolute inset-0 h-full w-full"
          src="/october/video-store/master-shelf-loop.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
        />

        <CarvedHeader onProgress={onCarve} />

        {WALL_TAPES.map((tape) => {
          const cubby = cubbyAt(tape.row, tape.col);
          const box = caseBox(cubby, tape.nudge);
          const mine = inHand === tape.id;
          const going = leaving?.id === tape.id;
          const refused = tape.id === REFUSED_ID;

          const motion: Motion = mine
            ? handling === "emerging"
              ? "emerging"
              : "held"
            : going
              ? // One still frame in flight coordinates, then the journey.
                leaving!.settling
                ? "returning"
                : "held"
              : refused && phase === "seizing"
                ? "seized"
                : offered && tape.id === OFFERED_ID
                  ? "offered"
                  : hovered === tape.id
                    ? "hover"
                    : "rest";

          return (
            <Tape
              key={tape.id}
              tape={tape}
              box={box}
              light={cubby.light}
              motion={motion}
              arrived={mine && handling === "arrived"}
              still={(mine || going) && swapping}
              flipped={mine ? flipped : going ? leaving!.flipped : false}
              shock={shock}
              kick={kickFor(tape, HIT)}
              seizure={SEIZURE}
              elevated={mine || going}
              grabbable={!mine && !going && phase === "idle"}
              touch={touch[tape.id] ?? UNTOUCHED}
              onEnter={() => setHovered(tape.id)}
              onLeave={() => setHovered((h) => (h === tape.id ? null : h))}
              onGrab={() => grab(tape)}
              onTurn={() => {
                setFlipped((f) => !f);
                cue("flip", 0.46, 0.5, 0.4);
              }}
              onPutBack={putBack}
            />
          );
        })}

        {/* The lights, and the room's exposure, over everything physical —
            because a change in the light is a change to all of it at once.
            A shade while the header is being cut, and no more than that. */}
        {/* Somebody at the back of the store, if this build has been given
            the photograph. Inside the stage, so it is lit, swayed and cropped
            with the room rather than floated over it. */}
        <Presence
          enabled={anomalies}
          forced={forcePresence}
          onSeen={() => cue("anomaly", 0.65, 0.6, 0.3)}
        />

        <Atmosphere
          dim={carving > 0 && carving < 1 ? 0.09 : 0}
          handle={(h) => {
            lights.current = h;
          }}
        />
      </div>
    </div>
  );
}

function Tape({
  tape,
  box,
  light,
  motion,
  arrived,
  still,
  flipped,
  shock,
  kick,
  seizure,
  touch,
  elevated,
  grabbable,
  onEnter,
  onLeave,
  onGrab,
  onTurn,
  onPutBack,
}: {
  tape: Placement;
  box: Box;
  light: number;
  motion: Motion;
  /** Standing in the hand, expressed as a laid-out box instead of a flight. */
  arrived: boolean;
  /** A pose swap is happening this frame. Nothing should interpolate. */
  still: boolean;
  flipped: boolean;
  /** Increments each time something hits the shelf. */
  shock: number;
  /** This tape's share of it. */
  kick: Kick;
  /** October's solved refusal, for the one tape it happens to. */
  seizure: Rejection;
  /** What this tape carries from having been handled. */
  touch: Touch;
  elevated: boolean;
  grabbable: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onGrab: () => void;
  onTurn: () => void;
  onPutBack: () => void;
}) {
  const inHand = motion === "held";
  const rest = -7 - tape.seat;
  const slab = useRef<HTMLDivElement>(null);

  /**
   * Taking the hit. The kick lands immediately and hard; letting go of it
   * takes two or three times as long, and a different two or three times for
   * every tape, so the wall settles raggedly instead of in unison.
   */
  const [rocked, setRocked] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (kick.angle === 0) return;
    // Struck, then the swing back past square, then nothing. Every tape does
    // this on its own clock, so the wall settles raggedly.
    const hit = setTimeout(() => setRocked(1), 0);
    const back = setTimeout(() => setRocked(-1), kick.ms * 0.42);
    const done = setTimeout(() => setRocked(0), kick.ms);
    return () => {
      clearTimeout(hit);
      clearTimeout(back);
      clearTimeout(done);
    };
  }, [shock, kick.angle, kick.ms]);

  /**
   * The case is laid out at the **reading** size and scaled down for the front
   * pose, so the artwork rasterises at the larger of the two distances and is
   * sharp at both. The front pose is the one the flight lands on, and the two
   * agree exactly: `liftTo` puts the case's centre on `HELD` at a scale of
   * `HELD.height / box.height`, so its projected rectangle is `HELD.height`
   * tall, which is what `READ.height × FRONT_SCALE` comes to.
   */
  const readBox: Box = {
    width: READ.height * VHS_ASPECT,
    height: READ.height,
    left: READ.x - (READ.height * VHS_ASPECT) / 2,
    top: READ.y - READ.height / 2,
  };
  const shell = arrived ? readBox : box;
  const frontScale = HELD.height / READ.height;
  const lift = liftTo(box, HELD, HELD.height);
  /** The same solve for the closer pose the back cover is read at. */
  const liftBack = liftTo(box, READ, READ.height);

  /**
   * The pull, solved rather than eyeballed. Coming forward under a perspective
   * moves a case *away from the vanishing point*, so a tape above the camera
   * axis rises — and then has to come back down when the travel takes over.
   * Instead: work out how much bigger the case is at `PULL_DEPTH`, take the
   * same fraction of the way to the hand, and aim there. The centre then
   * travels one straight line from the shelf to your hand.
   */
  const pullGrow = CAMERA.perspective / (CAMERA.perspective - PULL_DEPTH);
  const pullHeight = box.height * pullGrow;
  const along = (pullHeight - box.height) / (HELD.height - box.height);
  /** Where the offered tape stands: the same line, a fifth of the way out. */
  const offer = poseAlong(box, rest - touch.dz, OFFER_S);

  /**
   * **October taking it.**
   *
   * Every other movement on this wall is a CSS transition between two poses,
   * which is right for things that go from one place to another. A struggle is
   * not that, so this one is handed to the browser as an animation built from
   * the solve in `rejection.ts` — one keyframe every eight milliseconds of
   * simulated time, interpolated linearly, because the shape is already in the
   * numbers and an easing curve on top of it would only be a lie about the
   * forces.
   *
   * It is a real `Animation`, so it composites, it can be paused and scrubbed,
   * and it is the same trajectory whether or not the page is being painted.
   */
  useEffect(() => {
    const el = slab.current;
    if (!el || motion !== "seized") return;
    const frames = seizure.moments.map((m) => {
      const p = poseAlong(box, rest - touch.dz, m.s);
      const straighten = Math.min(1, m.s * 4);
      return {
        offset: Math.min(1, m.t / seizure.duration),
        transform:
          `translate3d(${p.x + touch.dx + m.strain}px, 0px, ${p.z - m.bite}px)` +
          ` rotate(${tape.lean * (1 - straighten) + touch.da + m.twist}deg)` +
          ` rotateY(${turnAlong(along, m.s, TURN_OUT, TURN_HELD)}deg)`,
      };
    });
    const run = el.animate(frames, {
      duration: seizure.duration * 1000,
      easing: "linear",
      fill: "forwards",
    });
    return () => run.cancel();
    // The solve depends on the cavity, not on anything that changes while it
    // is running; re-running it mid-struggle would be the one thing that
    // could make it teleport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, seizure]);

  const startX = box.left + box.width / 2;
  const startY = box.top + box.height / 2;
  const pull = liftTo(
    box,
    {
      x: startX + (HELD.x - startX) * along,
      y: startY + (HELD.y - startY) * along,
    },
    pullHeight,
  );

  /**
   * The pose the case goes home to, which is not quite the pose it came from.
   * Everything a handled tape carries lives here rather than in its layout
   * box, so the shelf remembers without the cavity — or the thing you click —
   * ever moving.
   */
  const shaken = rocked === 1 ? 1 : rocked === -1 ? -0.38 : 0;
  const seated = `translate3d(${touch.dx}px, 0px, ${rest - touch.dz - kick.depth * Math.max(0, shaken)}px) rotate(${tape.lean + touch.da + kick.angle * shaken}deg)`;

  const transform = arrived
    ? flipped
      ? `rotateY(${TURN_HELD + 180}deg)`
      : `translate(${HELD.x - READ.x}px, ${HELD.y - READ.y}px) scale(${frontScale}) rotateY(${TURN_HELD}deg)`
    : inHand
      ? // In the air. On the way out this is where the pull hands over to; on
        // the way home it is the pose the arrived box is re-stated as, held
        // for one still frame — including the flip, so a tape you turned over
        // travels back turned over and rights itself en route.
        `translate3d(${(flipped ? liftBack : lift).x}px, ${(flipped ? liftBack : lift).y}px, ${(flipped ? liftBack : lift).z}px) rotateY(${TURN_HELD + (flipped ? 180 : 0)}deg)`
      : motion === "emerging"
        ? `translate3d(${pull.x}px, ${pull.y}px, ${pull.z}px) rotate(${tape.lean * 0.3}deg) rotateY(${TURN_OUT}deg)`
        : motion === "seized"
          ? // Owned by the solve while it lasts; this is only what it stands
            // at before the first frame and after the last.
            seated
          : motion === "offered"
            ? // Out along the same line every tape travels, far enough that
              // peripheral vision cannot miss it. An offer, not a throw.
              `translate3d(${offer.x + touch.dx}px, ${offer.y}px, ${offer.z}px) rotate(${tape.lean * 0.4 + touch.da}deg) rotateY(${turnAlong(along, OFFER_S, TURN_OUT, TURN_HELD)}deg)`
            : motion === "hover"
              ? `translate3d(${touch.dx}px, 0px, ${rest + 8 - touch.dz}px) rotate(${tape.lean + touch.da}deg)`
              : seated;

  const ease = arrived
    ? `${FLIP_MS}ms cubic-bezier(.3,.72,.28,1)`
    : inHand
      ? // Picks up where the pull handed over, and lands without bouncing.
        `${LIFT_MS}ms cubic-bezier(.12,.52,.24,1)`
      : motion === "emerging"
        ? // Still accelerating at the handover, so there is no seam.
          `${PULL_MS}ms cubic-bezier(.34,0,.72,.5)`
        : motion === "returning"
          ? // One curve, hand to cavity. It never stops moving until it
            // is in, and the last of the ease is the slide.
            `${RETURN_MS}ms cubic-bezier(.36,0,.2,1)`
          : motion === "offered"
            ? // The offer is the slow one. That is the whole point of it.
              `${OFFER_MS}ms cubic-bezier(.36,.06,.24,1)`
            : `${PULL_MS}ms cubic-bezier(.3,.6,.3,1)`;

  const z = inHand
    ? PULL_DEPTH
    : motion === "emerging" || motion === "returning"
      ? PULL_DEPTH
      : motion === "offered"
        ? PULL_DEPTH
        : motion === "seized"
          ? PULL_DEPTH
          : rest;
  const out = z > rest;
  const proud = Math.min(Math.max(z - rest, 0), 34);

  /** Each cavity's own measured light. In the hand it comes all the way up. */
  const level = inHand ? 1 : cavityLevel(light) + proud / 220;
  const depth = shell.width * VHS_DEPTH_RATIO;
  const lit = (face: number) => ({
    filter: level === 1 ? undefined : `brightness(${level * face})`,
    transition: `filter ${ease}`,
  });

  return (
    <div
      className="absolute"
      style={{
        ...asPercent(shell),
        transformStyle: "preserve-3d",
        zIndex: elevated ? 2 : undefined,
      }}
    >
      <span
        aria-hidden
        className="absolute"
        style={{
          left: "-30%",
          right: "-30%",
          bottom: -1,
          height: 4,
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.9), rgba(0,0,0,0) 72%)",
          opacity: inHand ? 0 : 0.5 + proud / 60,
          transform: `translateY(${proud * 0.14}px) scaleX(${1 + proud / 70})`,
          transition: `opacity ${ease}, transform ${ease}`,
        }}
      />

      {/* The slab: a front, a back and two edges, thirty millimetres apart.
          Turning it over is turning it over. */}
      <div
        ref={slab}
        className="absolute inset-0"
        data-testid={`case-${tape.id}`}
        data-motion={motion}
        data-arrived={arrived ? "true" : "false"}
        data-still={still ? "true" : "false"}
        onClick={inHand ? onTurn : undefined}
        style={{
          transform,
          // **Centre, always.** A bottom-centre origin makes `scale()` shrink
          // the case toward its foot, which moved the arrived pose 121 screen
          // pixels below where the flight had just left it — the jump at the
          // end of the pickup. Scaling and the flight's projection now agree
          // because they are about the same point.
          transformOrigin: "50% 50%",
          transformStyle: "preserve-3d",
          pointerEvents: inHand ? "auto" : "none",
          cursor: inHand ? "pointer" : undefined,
          transition:
            still || motion === "seized"
              ? "none"
              : `transform ${ease}, box-shadow ${ease}`,
          boxShadow: inHand
            ? "0 6px 22px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)"
            : "0 0 0 rgba(0,0,0,0)",
        }}
      >
        <span
          className="absolute inset-0"
          style={{
            transform: `translateZ(${depth / 2}px)`,
            backfaceVisibility: "hidden",
            ...lit(1),
          }}
        >
          <Sleeve cover={tape.cover} width={shell.width} film={tape.film} />
        </span>

        <span
          className="absolute inset-0"
          style={{
            transform: `translateZ(${-depth / 2}px) rotateY(180deg)`,
            backfaceVisibility: "hidden",
            ...lit(0.94),
          }}
        >
          <BackCover
            film={tape.film}
            cover={tape.cover}
            width={shell.width}
            onTrailer={() => {}}
            onPutBack={onPutBack}
          />
        </span>

        {(["left", "right"] as const).map((face) => (
          <span
            key={face}
            aria-hidden
            className="absolute top-0 bottom-0"
            style={{
              width: depth,
              [face]: 0,
              transformOrigin: `${face} center`,
              transform: `translateZ(${depth / 2}px) rotateY(${face === "right" ? -90 : 90}deg)`,
              ...lit(0.62),
            }}
          >
            <Spine
              cover={tape.cover}
              width={depth}
              height={shell.height}
              title={tape.film.title}
            />
          </span>
        ))}

        {/* The cavity is darker at its head than at the board, and the sleeve
            is glossy, and the tube is overhead and to the right. */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            transform: `translateZ(${depth / 2 + 0.01}px)`,
            backfaceVisibility: "hidden",
            // The shelf above throws a shadow across the head of a seated
            // tape. It is a shadow, not an exposure change: enough to seat
            // the object in its hole, nowhere near enough to hide what is
            // printed on it.
            background: inHand
              ? "linear-gradient(203deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.13) 8%, rgba(255,255,255,0) 30%)"
              : "linear-gradient(to bottom, rgba(0,0,0,0.17) 0%, rgba(0,0,0,0.05) 56%, rgba(0,0,0,0) 100%), linear-gradient(203deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 7%, rgba(255,255,255,0.04) 19%, rgba(255,255,255,0) 34%)",
            transition: `background ${ease}`,
          }}
        />
      </div>

      {/* Reaching for it. The button is the cavity, not the case: a tape at a
          negative translateZ is behind its own parent's plane and the browser
          will not aim a click at it, and a tape proud of the shelf would sit
          in front of the target and swallow the click instead. */}
      {grabbable && (
        <button
          type="button"
          onClick={onGrab}
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          data-testid={`tape-${tape.id}`}
          data-pulled={out ? "true" : "false"}
          aria-label={`${tape.film.title}, ${tape.film.year}`}
          className="absolute inset-0 cursor-pointer border-0 bg-transparent p-0"
          // The room stops taking clicks while something is in your hand, so
          // that a click on nothing puts it back — but the cavities keep
          // taking them, because reaching for a different tape is a move you
          // are allowed to make without putting this one down first.
          style={{ pointerEvents: "auto" }}
        />
      )}
    </div>
  );
}
