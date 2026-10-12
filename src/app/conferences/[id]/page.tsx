import Link from "next/link";
import { notFound } from "next/navigation";
import { KIND_WORDS } from "@/domain/conference/details";
import { doorsFor, enabledModules } from "@/domain/conference/modules";
import { conferenceSetup } from "@/lib/conference/config";
import { deps, readIdentity } from "@/lib/conference/request";
import { homeFor } from "@/lib/conference/service";
import { Closed } from "@/components/conference/Closed";
import { Doors } from "@/components/conference/Doors";
import { Hero } from "@/components/conference/Hero";
import { LiveRefresh } from "@/components/conference/LiveRefresh";
import { MyPresence } from "@/components/conference/MyPresence";
import { Section } from "@/components/conference/ui";

export const dynamic = "force-dynamic";

const quietly = (others: number) =>
  others === 0
    ? "Just you so far."
    : `Nobody else has chosen to be seen yet. ${
        others === 1 ? "One other person is" : `${others} others are`
      } here quietly.`;

/**
 * **A conference's home.** Members only. To anybody else it doesn't exist:
 * this is `notFound()`, the same page a mistyped URL gets.
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
  const doors = c.modules.includes("discover") ? doorsFor(c) : [];

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
        {c.welcome ? (
          <p className="mt-8 text-[18px] leading-relaxed whitespace-pre-line text-black/80">
            {c.welcome}
          </p>
        ) : null}

        {modules.length ? (
          <nav aria-label={`Inside this ${words.noun}`} className="mt-8">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {modules.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/conferences/${c.id}/${m.id}`}
                    className="flex h-full flex-col rounded-2xl border border-black/10 p-4"
                  >
                    <span className="text-[17px] font-bold">{m.label}</span>
                    <span className="mt-1 text-[13px] text-black/55">
                      {m.status === "built" ? m.promise : "Not built yet"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {doors.length ? (
          <Section
            title="Free time"
            hint="Built by Go Have A Day, from real places."
          >
            <Doors doors={doors} />
          </Section>
        ) : null}

        <Section
          title={`Who's here · ${people.total}`}
          hint={people.visible.length ? undefined : quietly(people.total - 1)}
        >
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
        </Section>

        <Section title="You">
          <MyPresence conferenceId={c.id} you={you} people={words.people} />
        </Section>
      </div>
    </>
  );
}
