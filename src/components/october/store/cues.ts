/**
 * **Where sound will go.**
 *
 * No audio is implemented and none is faked — bad placeholder sound would do
 * more damage here than silence. What exists is the timing: every moment the
 * scene would make a noise fires a cue, so a sound pass can be written against
 * real instants rather than guessing at them afterwards.
 *
 * The intended language, recorded here because it constrains the shape of this
 * seam: a cue carries **where** it happened in the plate, not just what it
 * was. A peripheral anomaly deep in the right aisle fires `anomaly` at roughly
 * x = 0.82; a wind that begins far away in the right channel, travels toward
 * the listener and passes behind them is a spatial treatment of that one cue.
 * Eyes say *something was over there*; ears say *something just went behind
 * me*; nothing happens afterwards. That is the bar — attention and space, not
 * volume.
 */
export type CueKind =
  /** A single stroke being scored into the header. */
  | "scratch"
  /** A case sliding out of its cavity. Plastic on board. */
  | "pull"
  /** It arrives in the hand. */
  | "settle"
  /** Turned over. */
  | "flip"
  /** Slid back into its cavity. */
  | "stow"
  /** Two forces on one tape. Something creaking that should not be. */
  | "tension"
  /** The moment it stops being a contest. */
  | "seize"
  /** Hard plastic into old wood. */
  | "shove"
  /** Neighbours taking the energy. */
  | "rattle"
  /** The shelf itself. */
  | "resonance"
  /** The Lost Boys easing itself forward. */
  | "offer"
  /**
   * The beat after the shove where a line could go — *"That one's mine."*
   * Ordinary voice, no reverb, no whisper. Not implemented, and the sequence
   * is built to work without it.
   */
  | "voice"
  /** Something in the right aisle, for about a fifth of a second. */
  | "anomaly";

export interface Cue {
  readonly kind: CueKind;
  /** Where in the plate it happened, 0–1 across and down. */
  readonly x: number;
  readonly y: number;
  /** 0–1. How hard. */
  readonly force: number;
}

export type CueSink = (cue: Cue) => void;
