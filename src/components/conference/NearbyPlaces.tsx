import {
  curatedNear,
  type CuratedKind,
  type CuratedPlace,
  walkLabel,
} from "@/domain/collections/places";
import { Section } from "./ui";

const GROUPS: readonly { kind: CuratedKind; title: string }[] = [
  { kind: "meeting", title: "Meet the group" },
  { kind: "restaurant", title: "Eat" },
  { kind: "bar", title: "Drink" },
  { kind: "activity", title: "An hour off" },
];

/**
 * **Real places a walk from the venue, from Passport's own short list.**
 *
 * Shared with Hockey Night (`collections/vancouver.ts`), so it does not wait
 * on Atlas. Distances are straight lines from `from`, said every time, and the
 * map link opens the exact point the address was checked against.
 */
export function NearbyPlaces({
  places,
  from,
}: {
  places: readonly CuratedPlace[];
  from: CuratedPlace;
}) {
  return (
    <div data-testid="nearby-places">
      {GROUPS.map(({ kind, title }) => {
        const near = curatedNear(places, from.at, {
          kinds: [kind],
          withinKm: 2.5,
        });
        if (!near.length) return null;
        return (
          <Section key={kind} title={title}>
            <ul className="flex flex-col gap-2">
              {near.map(({ place, km, walkMinutes }) => (
                <li
                  key={place.id}
                  className="rounded-2xl border border-black/10 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[17px] font-bold">{place.name}</p>
                      <p className="mt-0.5 text-[14px] text-black/60">
                        {place.blurb}
                      </p>
                      <p className="mt-1 text-[13px] text-black/45">
                        {place.address}, {place.neighbourhood} ·{" "}
                        {walkLabel({ km, walkMinutes })}
                      </p>
                    </div>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${place.at[0]}&mlon=${place.at[1]}#map=18/${place.at[0]}/${place.at[1]}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${place.name} on a map`}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-black/15 px-3 text-[14px] font-semibold"
                    >
                      Map
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}
