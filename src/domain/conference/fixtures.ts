import type { DetailsInput } from "./details";

/**
 * **Sycle Vancouver 2026, as configuration.**
 *
 * The proof that Sycle is a record and not a code path: it is exactly the
 * input an organiser would type into `/conferences/new`, and the tests run
 * it through the same schema.
 *
 * Only what the brief states is here — the name, Vancouver, and October 24,
 * 2026. The last day, the colour and the welcome are not known, so they are
 * not written down; the organiser sets them. Only `discover` is switched on,
 * because it is the only module that is built.
 */
export const SYCLE_VANCOUVER_2026: DetailsInput = {
  name: "Sycle Vancouver 2026",
  kind: "conference",
  place: { label: "Vancouver", townId: "vancouver" },
  timeZone: "America/Vancouver",
  startsOn: "2026-10-24",
  modules: ["discover"],
};
