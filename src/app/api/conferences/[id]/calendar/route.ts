import { calendarFile } from "@/domain/conference/calendar";
import { isLead, leadFor } from "@/domain/conference/sessionReminders";
import { conferenceContext } from "@/lib/conference/request";
import { notFound } from "@/lib/conference-together/respond";

type Ctx = { params: Promise<{ id: string }> };

const ID = /^[\w-]{1,24}$/;

/**
 * **The agenda as a calendar file.** Members only — to anybody else this is
 * the same 404 as the pages. `?ids=a,b` exports those lines (one session, or
 * a person's own schedule); without it, the whole agenda. `?lead=15` adds an
 * alarm that many minutes before each line (breaks excepted), and
 * `?o=a:30,b:0` the person's choice for single lines — the same rule as the
 * in-app reminders (`leadFor`). Nothing about the person is stored: the
 * choices ride in the link they tapped.
 */
export async function GET(request: Request, { params }: Ctx) {
  const ctx = await conferenceContext((await params).id);
  if (!ctx) return notFound();
  const c = ctx.conference;
  if (!c.modules.includes("schedule") && ctx.viewer.role !== "organiser")
    return notFound();
  const q = new URL(request.url).searchParams;
  const ids = q.has("ids")
    ? (q.get("ids") ?? "")
        .split(",")
        .filter((s) => ID.test(s))
        .slice(0, 60)
    : undefined;
  const leadN = Number(q.get("lead") ?? 0);
  const overrides: Record<string, 0 | 5 | 15 | 30> = {};
  for (const pair of (q.get("o") ?? "").split(",").slice(0, 60)) {
    const [id, n] = pair.split(":");
    if (id && ID.test(id) && isLead(Number(n)))
      overrides[id] = Number(n) as 0 | 5 | 15 | 30;
  }
  const prefs = { lead: isLead(leadN) ? leadN : 0, overrides } as const;
  const origin = new URL(request.url).origin;
  const body = calendarFile({
    conferenceId: c.id,
    details: c,
    ids,
    alarmFor: (item) => leadFor(item, prefs) || null,
    urlFor: (item) => `${origin}/conferences/${c.id}/schedule/${item.id}`,
    // Each export is the newest: an imported event with the same UID is
    // updated, never doubled.
    revisedAt: ctx.now.toISOString(),
    now: ctx.now,
  });
  const single =
    ids?.length === 1
      ? (c.agenda ?? []).find((i) => i.id === ids[0])?.title
      : null;
  const name =
    (single ?? c.name)
      .replace(/[^\w -]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "agenda";
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
