import Link from "next/link";
import { dateRange } from "@/domain/conference/countdown";
import { safeAccent } from "@/domain/conference/branding";
import { conferenceSetup } from "@/lib/conference/config";
import { isGuest } from "@/lib/conference/identity";
import { deps, readIdentity } from "@/lib/conference/request";
import { conferencesOf } from "@/lib/conference/service";
import { JoinWithCode } from "@/components/conference/JoinWithCode";
import { Closed } from "@/components/conference/Closed";
import { Section } from "@/components/conference/ui";

export const dynamic = "force-dynamic";

export default async function ConferencesPage() {
  const setup = conferenceSetup();
  if (!setup.open) return <Closed missing={setup.missing} />;
  const identity = await readIdentity(setup.config);
  // The list is the one part of this page that needs the store. If it fails,
  // say so and keep the doors open: a code or a new conference may still work.
  let mine: Awaited<ReturnType<typeof conferencesOf>> = [];
  let listFailed = false;
  if (identity) {
    try {
      mine = await conferencesOf(deps(), identity);
    } catch (error) {
      listFailed = true;
      console.error("conferences: could not list yours", error);
    }
  }
  const canCreate =
    identity === null
      ? setup.config.allowGuestOrganisers
      : !isGuest(identity) || setup.config.allowGuestOrganisers;

  return (
    <div className="mx-auto max-w-[760px] px-5 pt-10">
      <p className="text-[13px] font-bold tracking-[0.16em] text-black/50 uppercase">
        Go have a conference
      </p>
      <h1 className="mt-2 text-[40px] leading-[0.95] font-black tracking-[-0.03em] sm:text-[56px]">
        Everyone&apos;s going to be in the same place.
      </h1>
      <p className="mt-4 max-w-[52ch] text-[17px] text-black/60">
        One private place for the group: who&apos;s coming, what&apos;s on, and
        something great to do with the hours in between.
      </p>

      {listFailed ? (
        <p
          role="status"
          className="mt-8 rounded-2xl border border-black/10 p-4 text-black/70"
        >
          We couldn&apos;t load your conferences just now. Nothing is lost; try
          again in a moment.
        </p>
      ) : null}

      {mine.length ? (
        <Section title="Yours">
          <ul className="flex flex-col gap-3">
            {mine.map(({ conference: c, role }) => (
              <li key={c.id}>
                <Link
                  href={`/conferences/${c.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-black/10 p-4"
                >
                  <span
                    className="h-10 w-2 rounded-full"
                    style={{ background: safeAccent(c.branding.accent) }}
                  />
                  <span>
                    <span className="block text-[18px] font-bold">
                      {c.name}
                    </span>
                    <span className="text-[14px] text-black/55">
                      {c.place.label} · {dateRange(c)}
                      {role === "organiser" ? " · you're organising" : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Got a code?">
        <JoinWithCode />
      </Section>

      <Section title="Organising one?">
        {canCreate ? (
          <Link
            href="/conferences/new"
            className="inline-block rounded-xl bg-black px-5 py-3 font-bold text-white"
          >
            Start a conference
          </Link>
        ) : (
          <p className="text-black/60">
            <Link
              href={`/auth?next=${encodeURIComponent("/conferences")}`}
              className="font-semibold underline"
            >
              Sign in to Passport
            </Link>{" "}
            to start one
            {setup.config.guests ? ". Joining needs no account" : ""}.
          </p>
        )}
      </Section>
    </div>
  );
}
