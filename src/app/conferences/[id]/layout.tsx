import { safeAccent } from "@/domain/conference/branding";
import { dateRange } from "@/domain/conference/countdown";
import { conferenceContext } from "@/lib/conference/request";
import { arrivalsEnabled } from "@/lib/conference-arrivals/enabled";
import { togetherEnabled } from "@/lib/conference-together/enabled";
import {
  ConferenceBar,
  type BarLink,
} from "@/components/conference/shell/ConferenceBar";

/**
 * **One conference, one frame.** Every screen inside a conference shares
 * this bar: the conference's name, the five places a participant goes
 * (Overview · Arrivals · Agenda · Explore · People), messages, and a profile
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
  const { conference: c, viewer } = ctx;
  const organiser = viewer.role === "organiser";
  const together = togetherEnabled();
  const has = (m: (typeof c.modules)[number]) => c.modules.includes(m);
  const base = `/conferences/${c.id}`;

  const tabs: BarLink[] = [
    { href: base, label: "Overview", icon: "overview", exact: true },
    ...(has("arrivals") && arrivalsEnabled()
      ? [
          {
            href: `${base}/arrivals`,
            label: "Arrivals",
            icon: "arrivals" as const,
          },
        ]
      : []),
    ...(has("schedule")
      ? [{ href: `${base}/schedule`, label: "Agenda", icon: "agenda" as const }]
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
  ];

  return (
    <div className="cf-root bg-cf-paper text-cf-ink min-h-screen">
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
      {children}
    </div>
  );
}
