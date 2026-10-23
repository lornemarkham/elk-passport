import Link from "next/link";
import { notFound } from "next/navigation";
import { KIND_WORDS } from "@/domain/conference/details";
import { enabledModules } from "@/domain/conference/modules";
import { digest } from "@/domain/conference-arrivals/digest";
import { arrivalsEnabled } from "@/lib/conference-arrivals/enabled";
import { readArrivals } from "@/lib/conference-arrivals/service";
import { arrivalsDeps } from "@/lib/conference-arrivals/request";
import { readRoom } from "@/lib/conference-chat/service";
import { readAlbum } from "@/lib/conference-memories/service";
import { readPeople } from "@/lib/conference-people/service";
import { readPlans } from "@/lib/conference-plans/service";
import { conferenceSetup } from "@/lib/conference/config";
import { deps, readIdentity } from "@/lib/conference/request";
import { homeFor } from "@/lib/conference/service";
import { togetherEnabled } from "@/lib/conference-together/enabled";
import {
  chatDeps,
  memoriesDeps,
  peopleDeps,
  plansDeps,
} from "@/lib/conference-together/request";
import { Closed } from "@/components/conference/Closed";
import { Hero } from "@/components/conference/Hero";
import { LiveRefresh } from "@/components/conference/LiveRefresh";
import { MyPresence } from "@/components/conference/MyPresence";
import { Section } from "@/components/conference/ui";
import { ExplorePicks } from "@/components/conference-together/ExplorePicks";
import { Reminders } from "@/components/conference-together/Reminders";
import { UpNext } from "@/components/conference-together/UpNext";
import { clock, dayWords } from "@/domain/conference-plans/time";

export const dynamic = "force-dynamic";

const quietly = (others: number) =>
  others === 0
    ? "Just you so far."
    : `Nobody else has chosen to be seen yet. ${
        others === 1 ? "One other person is" : `${others} others are`
      } here quietly.`;

/** A module's summary failing never takes the home page down with it. */
const soft = <T,>(p: Promise<T>): Promise<T | null> =>
  p.catch((error) => {
    console.error("[conference home] a summary failed", error);
    return null;
  });

/**
 * **A conference's home.** Members only. To anybody else it doesn't exist:
 * this is `notFound()`, the same page a mistyped URL gets.
 *
 * It answers five questions, in the order someone standing in a hotel lobby
 * asks them: what's happening and what can I join (with where we meet), who
 * is here, what have we done together, and what's good nearby. Each answer
 * comes from its own module, and only when that module is switched on.
 */
export default async function ConferenceHome({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const setup = conferenceSetup();
  if (!setup.open) return <Closed missing={setup.missing} />;
  const identity = await readIdentity(setup.config);
  if (!identity) notFound();
  const d = deps();
  const home = await homeFor(d, identity, (await params).id);
  if (!home) notFound();

  const { conference: c, you, people } = home;
  const words = KIND_WORDS[c.kind];
  const modules = enabledModules(c);
  const together = togetherEnabled();
  const on = (id: (typeof c.modules)[number]) =>
    c.modules.includes(id) &&
    (id === "arrivals"
      ? arrivalsEnabled()
      : id === "discover" || id === "schedule"
        ? true
        : together);
  const open = (id: string) =>
    id === "arrivals" ? arrivalsEnabled() : id === "discover" || together;

  const [board, arrivals, room, album, sharing] = await Promise.all([
    on("plans")
      ? soft(plansDeps(c, 1500).then((p) => readPlans(p, identity, c.id)))
      : null,
    on("arrivals")
      ? soft(readArrivals(arrivalsDeps(), identity, c.id, false))
      : null,
    on("community") ? soft(readRoom(chatDeps(), identity, c.id, null)) : null,
    on("memories") ? soft(readAlbum(memoriesDeps(), identity, c.id)) : null,
    on("people") ? soft(readPeople(peopleDeps(), identity, c.id)) : null,
  ]);
  const arrived = arrivals?.board
    ? digest(arrivals.board, d.now, c.timeZone)
    : null;
  const lastWords = room?.messages.slice(-3) ?? [];
  const sharingNow = sharing?.people.filter((p) => !p.you) ?? [];

  return (
    <>
      <LiveRefresh />
      <Hero details={c} now={d.now}>
        {you.role === "organiser" ? (
          <Link
            href={`/conferences/${c.id}/admin`}
            className="mt-6 inline-block rounded-xl bg-black/15 px-4 py-2.5 text-[15px] font-bold"
          >
            Organiser settings
          </Link>
        ) : null}
      </Hero>
      <div className="mx-auto max-w-[760px] px-5">
        {board ? <Reminders conferenceId={c.id} /> : null}

        {c.welcome ? (
          <p className="mt-8 text-[18px] leading-relaxed whitespace-pre-line text-black/80">
            {c.welcome}
          </p>
        ) : null}

        {board ? (
          <Section title="What's happening">
            <UpNext conferenceId={c.id} initial={board} />
          </Section>
        ) : null}

        {on("plans") || on("community") || on("people") || on("discover") ? (
          <nav
            aria-label="Do something"
            className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {[
              on("plans") && {
                href: `/conferences/${c.id}/plans?kind=coffee`,
                label: "+ Make a plan",
              },
              on("community") && {
                href: `/conferences/${c.id}/chat`,
                label: "💬 Chat",
              },
              on("people") && {
                href: `/conferences/${c.id}/people`,
                label: "📡 Find my people",
              },
              on("discover") && {
                href: `/conferences/${c.id}/discover`,
                label: "🧭 Explore",
              },
            ]
              .filter((x): x is { href: string; label: string } => !!x)
              .map((x) => (
                <Link
                  key={x.href}
                  href={x.href}
                  className="flex min-h-12 items-center justify-center rounded-2xl bg-black px-3 text-center text-[15px] font-bold text-white"
                >
                  {x.label}
                </Link>
              ))}
          </nav>
        ) : null}

        <Section
          title={`Who's here · ${people.total}`}
          hint={people.visible.length ? undefined : quietly(people.total - 1)}
        >
          {arrived && (arrived.landed.length || arrived.next) ? (
            <p className="mb-3 text-[16px]" data-testid="arrivals-summary">
              {arrived.landed.length
                ? `✅ ${arrived.landed.length} landed${
                    arrived.landed.length <= 3
                      ? ` (${arrived.landed.map((e) => e.name).join(", ")})`
                      : ""
                  }. `
                : ""}
              {arrived.next ? (
                <>
                  ✈️ Next: <strong>{arrived.next.name}</strong>,{" "}
                  {dayWords(
                    new Date(arrived.next.at!),
                    c.timeZone,
                    d.now,
                  ).toLowerCase()}{" "}
                  {arrived.next.kind === "estimated" ? "~" : ""}
                  {clock(new Date(arrived.next.at!), c.timeZone)}.{" "}
                </>
              ) : null}
              <Link
                href={`/conferences/${c.id}/arrivals`}
                className="underline"
              >
                Arrivals
              </Link>
            </p>
          ) : null}
          {people.visible.length ? (
            <ul className="flex flex-wrap gap-2" data-testid="visible-people">
              {people.visible.map((p) => (
                <li
                  key={p.memberId}
                  className="rounded-full bg-black/5 px-3 py-1.5 text-[15px]"
                >
                  {p.displayName}
                </li>
              ))}
            </ul>
          ) : null}
          {sharingNow.length ? (
            <p className="mt-3 text-[15px]">
              📡 {sharingNow.map((p) => p.name).join(", ")}{" "}
              {sharingNow.length === 1 ? "is" : "are"} sharing where they are.{" "}
              <Link href={`/conferences/${c.id}/people`} className="underline">
                Find them
              </Link>
            </p>
          ) : null}
        </Section>

        {room ? (
          <Section title="In the chat">
            {lastWords.length ? (
              <Link
                href={`/conferences/${c.id}/chat`}
                className="block rounded-2xl border border-black/10 p-4"
                data-testid="chat-preview"
              >
                {lastWords.map((m) => (
                  <span
                    key={m.id}
                    className="block truncate py-0.5 text-[15px]"
                  >
                    <strong>{m.by.name}:</strong> {m.body}
                  </span>
                ))}
              </Link>
            ) : (
              <p className="text-[15px] text-black/55">
                Quiet so far.{" "}
                <Link href={`/conferences/${c.id}/chat`} className="underline">
                  Say hello
                </Link>
                .
              </p>
            )}
          </Section>
        ) : null}

        {album ? (
          <Section title="What we've done together">
            {album.photos.length ? (
              <Link
                href={`/conferences/${c.id}/memories`}
                className="grid grid-cols-3 gap-1.5"
                data-testid="recent-memories"
              >
                {album.photos.slice(0, 6).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element -- private bytes from a members-only route
                  <img
                    key={p.id}
                    src={`/api/conferences/${c.id}/memories/${p.id}`}
                    alt={p.caption || `Photo by ${p.by.name}`}
                    loading="lazy"
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                ))}
              </Link>
            ) : (
              <p className="text-[15px] text-black/55">
                No photos yet.{" "}
                <Link
                  href={`/conferences/${c.id}/memories`}
                  className="underline"
                >
                  Start the album
                </Link>
                .
              </p>
            )}
          </Section>
        ) : null}

        {on("discover") ? (
          <Section
            title={`Good nearby`}
            hint="Real places a walk from the venue."
          >
            <ExplorePicks conferenceId={c.id} />
            <Link
              href={`/conferences/${c.id}/discover`}
              className="mt-3 inline-block text-[15px] underline"
            >
              Explore {c.place.label}
            </Link>
          </Section>
        ) : null}

        {modules.length ? (
          <nav aria-label={`Inside this ${words.noun}`} className="mt-10">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {modules.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/conferences/${c.id}/${m.id === "community" ? "chat" : m.id}`}
                    className="flex h-full flex-col rounded-2xl border border-black/10 p-4"
                  >
                    <span className="text-[17px] font-bold">{m.label}</span>
                    <span className="mt-1 text-[13px] text-black/55">
                      {m.status === "built" && open(m.id)
                        ? m.promise
                        : "Not open yet"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div id="you" className="scroll-mt-4">
          <Section title="You">
            <MyPresence conferenceId={c.id} you={you} people={words.people} />
          </Section>
        </div>
      </div>
    </>
  );
}
