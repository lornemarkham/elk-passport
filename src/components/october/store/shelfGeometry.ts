/**
 * **Where the shelves actually are in `master-shelf-loop.mp4`.**
 *
 * Measured from the plate rather than guessed. Frame 0 was decoded to
 * greyscale; the vertical structure came from intensity profiles taken inside
 * two separate cubbies (one per cabinet), and the horizontal structure from
 * column profiles taken inside every row.
 *
 * ```
 * video            854 × 480, 8 s, 30 fps, h264
 * shadow lines     89 · 137 · 184 · 231 · 277 · 326 · 376 · 425
 * board lips       134 · 182 · 227 · 272 · 317 · 365 · 412
 * fins (all rows)  53 · 123 · 186 · 253 ‖ 256 · 325 · 391 · 458 · 527
 * ```
 *
 * **The unit is dead frontal**, which is the fact the whole overlay rests on.
 * The fins were detected independently in all seven rows and land within a few
 * pixels of the same x every time, so one column table serves the entire wall
 * — there is no keystone to correct and no rotation to fake. The aisle recedes
 * to the right; the shelf face does not.
 *
 * Everything below is normalised to the 854 × 480 frame, so the overlay is
 * expressed in the plate's own coordinates and survives any viewport.
 */

export const PLATE = { width: 854, height: 480 } as const;

/**
 * The camera, in plate pixels. `perspective` is small enough that a tape
 * nudged forward in its cavity barely changes size — which is correct, and is
 * exactly why a shelved tape's movement has to be sold by light and shadow.
 * It is also what makes picking one up work: the same projection that ignores
 * seven pixels turns seven hundred into an object filling your hands.
 */
export const CAMERA = {
  perspective: 900,
  originX: 0.42,
  originY: 0.62,
} as const;

/** Where the camera axis passes through the plate. */
export const AXIS = {
  x: PLATE.width * CAMERA.originX,
  y: PLATE.height * CAMERA.originY,
} as const;

/**
 * Each row's opening: the shadow line under the board above, and the front lip
 * of the board a case stands on.
 *
 * Derived by one rule from the measured lines — `top = shadow + 1`,
 * `floor = nextShadow − 3` — rather than seven hand-picked pairs. Row 5, the
 * row the first proof used, comes out at 279 → 323, which is what it was
 * measured at directly.
 *
 * Above about y = 150 the camera is looking at the boards' undersides and
 * below it at their tops, which is why the lip-to-shadow gap grows down the
 * wall. It does not matter to a case: its foot lands on the front lip either
 * way, and the board occludes whatever is behind that.
 */
export interface Row {
  readonly top: number;
  readonly floor: number;
}

export const ROWS: readonly Row[] = [
  { top: 91, floor: 134 },
  { top: 139, floor: 181 },
  { top: 186, floor: 228 },
  { top: 233, floor: 274 },
  { top: 279, floor: 323 },
  { top: 328, floor: 373 },
  { top: 378, floor: 422 },
];

/**
 * The seven cavities across: three in the left cabinet, four in the right.
 * Widths vary 57–64 px because the generated woodwork is irregular, not
 * because of perspective, so each carries its own measured box.
 */
export interface Column {
  readonly x: number;
  readonly width: number;
}

export const COLUMNS: readonly Column[] = [
  { x: 64, width: 57 },
  { x: 126, width: 58 },
  { x: 189, width: 63 },
  { x: 263, width: 60 },
  { x: 328, width: 61 },
  { x: 394, width: 62 },
  { x: 461, width: 64 },
];

/**
 * **What light each cavity actually gets**, as the mean luminance of the
 * bottom quarter of its opening, out of 255. Measured cubby by cubby.
 *
 * ```
 *        col0  col1  col2  col3  col4  col5  col6
 * row0     33    44    63    95   116    58    29
 * row6     26    40    43    42    42    41    32
 * ```
 *
 * The wall is not evenly lit and pretending it is would be the tell. The
 * cavities under the near fluorescent tube are four times brighter than the
 * corners, so a tape's shading is read from its own cavity rather than from
 * one global ramp.
 */
export const CAVITY_LIGHT: readonly (readonly number[])[] = [
  [33, 44, 63, 95, 116, 58, 29],
  [47, 52, 65, 90, 101, 62, 35],
  [42, 53, 63, 74, 83, 57, 40],
  [39, 49, 55, 65, 70, 56, 39],
  [40, 50, 56, 59, 58, 54, 41],
  [31, 39, 45, 45, 49, 43, 34],
  [26, 40, 43, 42, 42, 41, 32],
];

export interface Cubby extends Row, Column {
  readonly row: number;
  readonly col: number;
  /** Measured luminance at the foot of this cavity, 0–255. */
  readonly light: number;
}

export function cubbyAt(row: number, col: number): Cubby {
  const r = ROWS[row];
  const c = COLUMNS[col];
  if (!r || !c) throw new Error(`No cubby at row ${row}, column ${col}`);
  return { row, col, ...r, ...c, light: CAVITY_LIGHT[row]![col]! };
}

/**
 * A VHS case is 191 × 104 × 30 mm. Face out, standing on the shelf floor, it
 * fills the opening's height and takes a little over a third of a cavity's
 * width — which is why the wall looks so empty with one tape in a cubby, and
 * why that reads as a store somebody has already been through.
 */
export const VHS_ASPECT = 104 / 191;
export const VHS_DEPTH_RATIO = 30 / 104;

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export function caseBox(cubby: Cubby, nudge = 0): Box {
  const height = cubby.floor - cubby.top;
  const width = height * VHS_ASPECT;
  return {
    left: cubby.x + (cubby.width - width) / 2 + nudge,
    top: cubby.top,
    width,
    height,
  };
}

/**
 * **Picking a tape up.**
 *
 * Bringing an object toward your face along the view axis is, in projection,
 * nothing but a uniform enlargement about the vanishing point — so this is
 * real perspective doing the work, not a card being scaled by a modal.
 *
 * Given where a case is on the wall and how tall it should end up on screen,
 * this returns the 3D translation that puts it there: a depth `z`, and the
 * lateral move that lands its projected centre at `to`. The browser does the
 * projection; nothing here fakes a size.
 */
export function liftTo(
  box: Box,
  to: { x: number; y: number },
  targetHeight: number,
): { x: number; y: number; z: number; scale: number } {
  const scale = targetHeight / box.height;
  const z = CAMERA.perspective * (1 - 1 / scale);
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  return {
    x: AXIS.x + (to.x - AXIS.x) / scale - cx,
    y: AXIS.y + (to.y - AXIS.y) / scale - cy,
    z,
    scale,
  };
}

/**
 * **The wooden header above the shelving.**
 *
 * Measured like everything else: the lit fascia runs y = 64–88, mean colour
 * rgb(72, 57, 45), and below y = 89 it drops to black — the shadow line that
 * is the top of the first row of cavities. The right-hand cabinet's span is
 * used rather than the whole unit, because the left of the cabinet crops out
 * of frame below 4:3 and a carving you cannot read is not a carving.
 */
export const HEADER = { left: 268, right: 516, top: 64, bottom: 88 } as const;

/**
 * **Where a picked-up tape is held.**
 *
 * Two poses, because a person holds a box at two distances. `HELD` is the
 * front of the case at arm's length — small enough that you are still plainly
 * standing in the store. `READ` is where it goes when you turn it over,
 * because that is what a person does with the back of a box: they bring it
 * closer.
 *
 * The case is always *laid out* at the reading size and scaled down for the
 * front pose, so the artwork is rasterised at the larger of the two and stays
 * sharp in both.
 */
export const HELD = { x: 392, y: 252, height: 190 } as const;
export const READ = { x: 404, y: 246, height: 330 } as const;

/**
 * **How much of the room's light reaches a sleeve seated in a given cavity.**
 *
 * This used to be derived from `CAVITY_LIGHT` — the luminance of an *empty*
 * cubby's back panel. That was wrong in kind, and it is worth writing down
 * why: the back of an empty hole is the darkest surface in the scene, lit by
 * nothing except what creeps past the shelf above it. A tape is not that
 * surface. A tape stands at the **front** of the cavity with its face turned
 * out into the room, and what it catches is the room — the same light the
 * cabinet's own top shelf and the aisle racks catch.
 *
 * Lighting the cover as though it were the back of the hole multiplied printed
 * artwork down to well under half its value before a wash went over it, which
 * is why a scan that looks correctly exposed in the hand was unrecognisable on
 * the shelf. That was not distance and it was not the room; it was a mistake.
 *
 * So the cavity now only *shades* — a near-to-far variation of about fifteen
 * per cent across the wall, in the direction the measurements say it should
 * go. A seated tape is dimmer than a held one because it is further away and
 * deeper in, not because it has been turned down.
 */
export function cavityLevel(light: number): number {
  return Math.min(0.94, Math.max(0.74, 0.71 + (light / 255) * 0.42));
}

/** As a percentage of the plate, for CSS inside a box of the plate's aspect. */
export const asPercent = (box: Box) => ({
  left: `${(box.left / PLATE.width) * 100}%`,
  top: `${(box.top / PLATE.height) * 100}%`,
  width: `${(box.width / PLATE.width) * 100}%`,
  height: `${(box.height / PLATE.height) * 100}%`,
});
