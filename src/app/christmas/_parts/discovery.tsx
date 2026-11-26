import { Finder } from "@/components/christmas/Finder";
import { EveningCard, PinNearCard } from "@/components/christmas/NearbyCards";
import { LocalFavouriteStops } from "@/components/featured/LocalFavouriteCard";
import { townById } from "@/domain/discovery/towns";
import { favouritesNear } from "@/domain/featured/locals";
import { youngest, type Ask } from "@/domain/christmas/discover";
import { finderData } from "@/domain/christmas/finder";
import { lightsNear, openThisEvening } from "@/domain/christmas/nearby";
import { whenLabel } from "@/domain/christmas/when";
import { christmasFinds } from "../_server/corpus";
import { lightsFor, viewer } from "../_server/lights";

/**
 * **The discovery half of the Christmas landing page** (owner brief M1128:
 * "Christmas Home and Discover are the same experience"). The only part of
 * the page that waits on Atlas, so it streams in behind the hero and the
 * ways. It answers where, when and how far once, for every category
 * (`finderData`); the visitor's categories are a filter in their own hand
 * (`Finder`), so changing them never comes back here.
 */
export async function Discovery({
  ask,
  today,
}: {
  readonly ask: Ask;
  readonly today: string;
}) {
  const town = townById(ask.at)!;
  const townName = town.name.replace(/,\s*BC$/, "");
  const origin = { latitude: town.latitude, longitude: town.longitude };
  const [corpus, lights] = await Promise.all([
    christmasFinds(ask, today),
    viewer()
      .then((v) => lightsFor(v))
      .catch(() => ({ pins: [], ready: false })),
  ]);
  const data = finderData(corpus.finds, ask, { today, now: new Date() });
  const dated = Boolean(ask.from || ask.to);
  const days = dated
    ? { from: ask.from ?? ask.to!, to: ask.to ?? ask.from! }
    : undefined;
  const oneDay = days && days.from === days.to ? days.from : undefined;
  const when = whenLabel(ask, today);
  const tonight = oneDay === today;
  const pins = lightsNear(lights.pins, origin, ask.km, days);
  const evening = oneDay
    ? openThisEvening(corpus.experiences, origin, ask.km, oneDay)
    : [];
  const age = youngest(ask);

  return (
    <Finder
      data={data}
      ask={ask}
      today={today}
      when={when}
      townName={townName}
      origin={origin}
      {...(age !== undefined ? { youngest: age } : {})}
      pinsOn={pins.on.length}
      outage={Boolean(corpus.outage)}
      lights={
        pins.on.length + pins.popular.length > 0 ? (
          <section data-testid="shelf-lights-on" aria-labelledby="pins-title">
            <p className="text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
              From the lights map
            </p>
            <h2
              id="pins-title"
              className="ghad-display mt-1 text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl"
            >
              {tonight
                ? "Lights on tonight"
                : dated
                  ? "Lights on these dates"
                  : "A little Christmas magic nearby"}
            </h2>
            <p className="mt-1 max-w-2xl text-base text-[var(--gh-ink-soft)]">
              Displays pinned by locals and checked by a person
              {pins.popular.length > 0
                ? ", with families' own star ratings"
                : ""}
              .
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ...pins.popular,
                ...pins.on.filter(
                  (n) => !pins.popular.some((p) => p.pin.id === n.pin.id),
                ),
              ].map((n) => (
                <PinNearCard key={n.pin.id} near={n} />
              ))}
            </div>
          </section>
        ) : undefined
      }
      evening={
        evening.length > 0 ? (
          <section data-testid="shelf-evening" aria-labelledby="evening-title">
            <p className="text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
              Make an evening of it
            </p>
            <h2
              id="evening-title"
              className="ghad-display mt-1 text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl"
            >
              {tonight ? "Dinner open tonight" : `Dinner open ${when}`}
            </h2>
            <p className="mt-1 max-w-2xl text-base text-[var(--gh-ink-soft)]">
              Open after 8 pm by their own published hours. Book ahead.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {evening.map((o) => (
                <EveningCard key={o.experience.id} open={o} />
              ))}
            </div>
          </section>
        ) : undefined
      }
      warm={
        <LocalFavouriteStops
          experience="christmas"
          title="Warm up before or after"
          stops={favouritesNear("christmas", origin, ask.km)}
          className="pt-2"
        />
      }
    />
  );
}
