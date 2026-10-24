import { agendaEntry } from "@/domain/conference/agenda";
import { safeAccent } from "@/domain/conference/branding";
import { dateRange } from "@/domain/conference/countdown";
import { conferenceContext } from "@/lib/conference/request";
import { arrivalsEnabled } from "@/lib/conference-arrivals/enabled";
import { togetherEnabled } from "@/lib/conference-together/enabled";
import {
  ConferenceBar,
  type BarLink,
} from "@/components/conference/shell/ConferenceBar";
import { SessionReminders } from "@/components/conference/schedule/SessionReminders";

/**
 * **One conference, one frame.** Every screen inside a conference shares
 * this bar: the conference's name, the five places a participant goes
 * (Home · Agenda · Arrivals · Explore · People), messages, and a profile
 * menu where settings live. Plans and memories are reached from where they
 * matter — the agenda, the overview, a place in Explore — not as tabs.
 *
 * Members only, like the pages under it: for anybody else there is no bar,
 * and the page underneath answers 404.
 */
export default async function ConferenceFrame({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const ctx = await conferenceContext((await params).id);
  if (!ctx) return <>{children}</>;
  const { conference: c, viewer, now } = ctx;
  const organiser = viewer.role === "organiser";
  const together = togetherEnabled();
  const has = (m: (typeof c.modules)[number]) => c.modules.includes(m);
  const base = `/conferences/${c.id}`;

  const tabs: BarLink[] = [
    { href: base, label: "Home", icon: "home", exact: true },
    ...(has("schedule")
      ? [{ href: `${base}/schedule`, label: "Agenda", icon: "agenda" as const }]
      : []),
    ...(has("arrivals") && arrivalsEnabled()
      ? [
          {
            href: `${base}/arrivals`,
            label: "Arrivals",
            icon: "arrivals" as const,
          },
        ]
      : []),
    ...(has("discover")
      ? [
          {
            href: `${base}/discover`,
            label: "Explore",
            icon: "explore" as const,
          },
        ]
      : []),
    { href: `${base}/people`, label: "People", icon: "people" },
  ];
  const menu: BarLink[] = [
    { href: `${base}/you`, label: "Your profile & privacy", icon: "you" },
    ...(has("plans") && together
      ? [{ href: `${base}/plans`, label: "Plans", icon: "plans" as const }]
      : []),
    ...(has("memories") && together
      ? [
          {
            href: `${base}/memories`,
            label: "Memories",
            icon: "memories" as const,
          },
        ]
      : []),
    ...(organiser
      ? [
          {
            href: `${base}/admin`,
            label: "Organiser settings",
            icon: "settings" as const,
          },
        ]
      : []),
    { href: "/conferences", label: "All your conferences", icon: "back" },
    // Go Have a Day's own bar is hidden on a phone inside a conference.
    { href: "/", label: "Go Have a Day", icon: "ghad", phoneOnly: true },
  ];

  return (
    <div
      className="cf-root bg-cf-paper text-cf-ink min-h-screen"
      data-cf-frame=""
    >
      <ConferenceBar
        home={base}
        name={c.name}
        dates={dateRange(c)}
        accent={safeAccent(c.branding.accent)}
        tabs={tabs}
        menu={menu}
        chat={has("community") && together ? `${base}/chat` : null}
        you={viewer.displayName ?? "You"}
        organiser={organiser}
      />
      {has("schedule") && c.agenda?.length ? (
        <SessionReminders
          conferenceId={c.id}
          timeZone={c.timeZone}
          serverNow={now.toISOString()}
          items={c.agenda.map((i) => ({
            id: i.id,
            day: i.day,
            title: i.title,
            where: i.where,
            kind: i.kind,
            startsAt: agendaEntry(i, c.timeZone).startsAt,
          }))}
        />
      ) : null}
      {children}
    </div>
  );
}
