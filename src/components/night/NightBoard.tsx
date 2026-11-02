"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Check, Plus, Share2, Sparkles, Trash2 } from "lucide-react";
import { AdventurePeople } from "@/components/adventures/AdventurePeople";
import { Picture } from "@/components/adventures/Picture";
import { shrinkPhoto } from "@/components/christmas/photo";
import type { Experience } from "@/domain/experience/types";
import type {
  NightActivity,
  NightConfig,
} from "@/domain/date-night/adventures";
import type { Moment } from "@/domain/christmas/recap";
import type {
  AdventureView,
  InviteView,
  ItemView,
} from "@/lib/adventures/store";
import type { ResponseValue } from "@/lib/adventures/rules";
import type { PackingView } from "@/lib/date-night/night";
import { planOf, type Vote } from "@/domain/date-night/adventures/plan";

const POLL_MS = 15_000;

const VOTES: readonly { value: ResponseValue; label: string }[] = [
  { value: "in", label: "Love it" },
  { value: "maybe", label: "Maybe" },
  { value: "out", label: "Nope" },
];

async function call(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(String(response.status));
  return response;
}

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto mt-10 max-w-2xl px-4">
      <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
      {note && <p className="text-muted-foreground mt-1 text-sm">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * **The board for two.** Everything it shows is read from the adventure core
 * (items, votes, members, packing, memories); the page refreshes itself so
 * the other person's choices appear without a reload. A tap is applied here
 * at once and confirmed by the server a moment later.
 */
export function NightBoard({
  view,
  invites,
  packing,
  moments,
  sharing,
  atlasNames,
  experiences,
  config,
}: {
  view: AdventureView;
  invites: readonly InviteView[];
  packing: readonly PackingView[] | null;
  moments: readonly Moment[];
  sharing: boolean;
  atlasNames: Record<string, string>;
  experiences: Record<string, Experience>;
  config: NightConfig | null;
}) {
  const router = useRouter();
  const [mine, setMine] = useState<Record<string, ResponseValue | null>>({});
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [idea, setIdea] = useState("");
  const [bring, setBring] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  const isOwner = view.role === "owner";
  const others = view.members.filter((m) => !m.isYou);
  const otherName = others[0]?.displayName ?? null;
  const activities = new Map<string, NightActivity>(
    (config?.activities ?? []).map((a) => [a.title, a]),
  );

  const yours = (item: ItemView): ResponseValue | null =>
    item.id in mine ? mine[item.id]! : item.yourResponse;

  /** What everybody but you answered, from the counts the core gives. */
  const theirs = (item: ItemView): ResponseValue | null => {
    const left = { ...item.responses };
    const own = item.yourResponse;
    if (own) left[own] = Math.max(0, left[own] - 1);
    return left.in > 0
      ? "in"
      : left.maybe > 0
        ? "maybe"
        : left.out > 0
          ? "out"
          : null;
  };

  const votes: Vote[] = view.items.map((item) => ({
    id: item.id,
    confirmed: item.status === "confirmed",
    yours: yours(item),
    theirs: theirs(item),
  }));
  const plan = planOf(votes);
  const byId = new Map(view.items.map((i) => [i.id, i]));

  async function vote(item: ItemView, value: ResponseValue) {
    const next = yours(item) === value ? null : value;
    setMine((m) => ({ ...m, [item.id]: next }));
    try {
      await call(
        `/api/adventures/${view.id}/items/${item.id}/response`,
        "PUT",
        {
          response: next,
        },
      );
      router.refresh();
    } catch {
      setMine((m) => {
        const { [item.id]: _gone, ...rest } = m;
        return rest;
      });
      toast.error("That didn't save. Try again.");
    }
  }

  async function suggest(event: React.FormEvent) {
    event.preventDefault();
    const label = idea.trim();
    if (!label) return;
    setBusy(true);
    try {
      await call(`/api/adventures/${view.id}/items`, "POST", { label });
      setIdea("");
      toast.success("Added. Now it needs a vote.");
      router.refresh();
    } catch {
      toast.error("Couldn't add that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function mystery() {
    setBusy(true);
    try {
      await call(`/api/night/${view.id}/mystery`, "POST");
      toast.success("Passport has chosen. Brace yourselves.");
      router.refresh();
    } catch {
      toast.error("Passport is out of surprises for now.");
    } finally {
      setBusy(false);
    }
  }

  async function lock(item: ItemView, confirmed: boolean) {
    try {
      await call(`/api/adventures/${view.id}/items/${item.id}`, "PATCH", {
        status: confirmed ? "confirmed" : "proposed",
      });
      router.refresh();
    } catch {
      toast.error("Only the person who started it can lock the plan.");
    }
  }

  async function tick(item: PackingView) {
    const next = !(item.id in ticks ? ticks[item.id] : item.checked);
    setTicks((t) => ({ ...t, [item.id]: next }));
    try {
      await call(`/api/night/${view.id}/packing/${item.id}`, "PATCH", {
        checked: next,
      });
      router.refresh();
    } catch {
      setTicks((t) => {
        const { [item.id]: _gone, ...rest } = t;
        return rest;
      });
      toast.error("That didn't save. Try again.");
    }
  }

  async function addBring(event: React.FormEvent) {
    event.preventDefault();
    const label = bring.trim();
    if (!label) return;
    try {
      await call(`/api/night/${view.id}/packing`, "POST", { label });
      setBring("");
      router.refresh();
    } catch {
      toast.error("Couldn't add that. Try again.");
    }
  }

  async function dropBring(item: PackingView) {
    try {
      await call(`/api/night/${view.id}/packing/${item.id}`, "DELETE");
      router.refresh();
    } catch {
      toast.error("Only whoever added it (or the host) can remove it.");
    }
  }

  async function invite() {
    setBusy(true);
    try {
      const response = await call(
        `/api/adventures/${view.id}/invites`,
        "POST",
        {},
      );
      const body = await response.json();
      const url = `${window.location.origin}${body.path}`;
      const text = [
        ...(config?.invitation ?? ["Help me plan our adventure."]),
        url,
      ].join("\n\n");
      if (navigator.share) {
        await navigator.share({ text }).catch(() => undefined);
      } else {
        await navigator.clipboard.writeText(text).catch(() => undefined);
        toast.success("Invitation copied. Send it to them.");
      }
      router.refresh();
    } catch {
      toast.error("Couldn't make the invitation. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const packed = (packing ?? []).filter((p) =>
    p.id in ticks ? ticks[p.id] : p.checked,
  ).length;

  return (
    <main className="pb-24">
      <header className="bg-gradient-to-b from-[#3b0f1f] via-[#7a2a2a] to-[#e9a15b] px-5 pt-10 pb-12 text-center text-white">
        <p className="text-4xl" aria-hidden>
          🧭❤️
        </p>
        <h1 className="mx-auto mt-3 max-w-md text-4xl leading-tight font-extrabold text-balance">
          {view.title}
        </h1>
        <p className="mt-2 text-white/85">
          {config?.tagline ?? "A questionable adventure."}
        </p>
        <p className="mt-4 text-sm text-white/80">
          {view.members
            .map((m) => (m.isYou ? "You" : m.displayName))
            .join(" ❤️ ")}
        </p>
        <nav className="mt-5 flex flex-wrap justify-center gap-2 text-sm font-semibold">
          {[
            ["#ideas", "Ideas"],
            ["#plan", "Our plan"],
            ["#packing", "Packing"],
            ["#memories", "Memories"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full bg-black/25 px-4 py-2"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      {isOwner && others.length === 0 && (
        <div className="mx-auto mt-6 max-w-2xl px-4">
          <div className="rounded-3xl border border-[#7a2a2a]/20 bg-[#fff6ee] p-5 text-center">
            <p className="font-bold">Waiting on your favourite person</p>
            <p className="text-muted-foreground mt-1 text-sm">
              This makes a private link that works once, with the invitation
              attached.
            </p>
            <button
              onClick={invite}
              disabled={busy}
              className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#7a2a2a] px-6 font-bold text-white disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" aria-hidden /> Send the invitation
            </button>
          </div>
        </div>
      )}

      <Section
        id="ideas"
        title="Ideas"
        note={
          otherName
            ? `Vote on each. You'll see what ${otherName} thinks, too.`
            : "Vote on each. Your favourite person votes when they join."
        }
      >
        <ul className="grid gap-4">
          {view.items.map((item) => {
            const activity = item.label
              ? activities.get(item.label)
              : undefined;
            const experience = item.atlasRef
              ? experiences[item.atlasRef]
              : undefined;
            const title =
              item.atlasRef && !item.label
                ? (atlasNames[item.atlasRef] ??
                  experience?.title ??
                  "A place Atlas knows")
                : (item.label ?? "An idea");
            const mineNow = yours(item);
            const theirNow = theirs(item);
            return (
              <li
                key={item.id}
                data-testid="idea"
                className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/10"
              >
                {item.atlasRef ? (
                  <Picture
                    experience={experience}
                    fallbackTitle={title}
                    tone="#7a2a2a"
                    className="h-40 w-full"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-[#fbe3cf] to-[#f3b99a] text-5xl">
                    <span aria-hidden>{activity?.emoji ?? "✨"}</span>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-lg font-bold">{title}</h3>
                  {item.note && <p className="mt-1 text-sm">{item.note}</p>}
                  {item.atlasRef ? (
                    <p className="text-muted-foreground mt-2 text-xs">
                      A real place from Atlas. Check access and conditions
                      before you go.
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Our own idea, not checked by Passport.
                    </p>
                  )}
                  {activity?.caution && (
                    <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">
                      ⚠️ {activity.caution}
                    </p>
                  )}
                  <div
                    role="group"
                    aria-label={`Your vote on ${title}`}
                    className="mt-4 grid grid-cols-3 gap-2"
                  >
                    {VOTES.map((v) => (
                      <button
                        key={v.value}
                        onClick={() => vote(item, v.value)}
                        aria-pressed={mineNow === v.value}
                        className={`min-h-12 rounded-2xl border text-sm font-bold transition ${
                          mineNow === v.value
                            ? v.value === "in"
                              ? "border-[#7a2a2a] bg-[#7a2a2a] text-white"
                              : v.value === "maybe"
                                ? "border-amber-500 bg-amber-100"
                                : "border-slate-500 bg-slate-200"
                            : "bg-white"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                  {otherName && (
                    <p
                      className="text-muted-foreground mt-2 text-xs"
                      data-testid="their-vote"
                    >
                      {otherName}:{" "}
                      {theirNow
                        ? VOTES.find((v) => v.value === theirNow)!.label
                        : "hasn't voted yet"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <form onSubmit={suggest} className="mt-4 flex gap-2">
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={120}
            placeholder="Suggest something (it needn't be in Atlas)"
            aria-label="Suggest an adventure"
            className="min-h-12 flex-1 rounded-2xl border px-4 text-base"
          />
          <button
            disabled={busy || !idea.trim()}
            className="inline-flex min-h-12 items-center gap-1 rounded-2xl bg-[#7a2a2a] px-4 font-bold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add
          </button>
        </form>
        {config && (
          <button
            onClick={mystery}
            disabled={busy}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#7a2a2a] font-bold text-[#7a2a2a] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Let Passport pick a
            mystery
          </button>
        )}
      </Section>

      <Section
        id="plan"
        title="Our plan"
        note="Built from your votes: what you both love first. The host can lock things in."
      >
        {plan.locked.length + plan.bothIn.length + plan.leaning.length === 0 ? (
          <p className="text-muted-foreground rounded-2xl bg-black/5 p-4 text-sm">
            Nothing yet. Vote on the ideas and the plan builds itself.
          </p>
        ) : (
          <div className="grid gap-4" data-testid="plan">
            {(
              [
                ["Locked in ✅", plan.locked],
                ["You both love these ❤️", plan.bothIn],
                ["Leaning that way", plan.leaning],
              ] as const
            ).map(([heading, ids]) =>
              ids.length === 0 ? null : (
                <div key={heading}>
                  <h3 className="text-sm font-bold tracking-wide text-[#7a2a2a] uppercase">
                    {heading}
                  </h3>
                  <ul className="mt-2 grid gap-2">
                    {ids.map((id) => {
                      const item = byId.get(id)!;
                      const name =
                        item.label ??
                        atlasNames[item.atlasRef ?? ""] ??
                        "A place";
                      return (
                        <li
                          key={id}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/10"
                        >
                          <span className="font-semibold">{name}</span>
                          {isOwner && (
                            <button
                              onClick={() =>
                                lock(item, item.status !== "confirmed")
                              }
                              className="min-h-10 rounded-full border px-3 text-xs font-bold"
                            >
                              {item.status === "confirmed"
                                ? "Unlock"
                                : "Lock it in"}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ),
            )}
          </div>
        )}
      </Section>

      <Section
        id="packing"
        title="Packing list"
        note={
          packing
            ? `${packed} of ${packing.length} packed. Either of you can tick or add.`
            : undefined
        }
      >
        {packing === null ? (
          <p className="text-muted-foreground rounded-2xl bg-black/5 p-4 text-sm">
            The packing list isn&apos;t switched on yet. Everything else works.
          </p>
        ) : (
          <>
            <ul className="grid gap-2" data-testid="packing">
              {packing.map((p) => {
                const checked = p.id in ticks ? ticks[p.id]! : p.checked;
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/10"
                  >
                    <button
                      onClick={() => tick(p)}
                      role="checkbox"
                      aria-checked={checked}
                      className="flex min-h-12 flex-1 items-center gap-3 px-3 text-left"
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          checked
                            ? "border-[#7a2a2a] bg-[#7a2a2a] text-white"
                            : ""
                        }`}
                      >
                        {checked && <Check className="h-4 w-4" aria-hidden />}
                      </span>
                      <span
                        className={checked ? "line-through opacity-60" : ""}
                      >
                        {p.label}
                      </span>
                      {checked && p.checkedBy && (
                        <span className="text-muted-foreground ml-auto text-xs">
                          {p.checkedBy}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => dropBring(p)}
                      aria-label={`Remove ${p.label}`}
                      className="text-muted-foreground flex h-12 w-12 items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
            <form onSubmit={addBring} className="mt-3 flex gap-2">
              <input
                value={bring}
                onChange={(e) => setBring(e.target.value)}
                maxLength={80}
                placeholder="Something to bring"
                aria-label="Add something to bring"
                className="min-h-12 flex-1 rounded-2xl border px-4 text-base"
              />
              <button
                disabled={!bring.trim()}
                className="min-h-12 rounded-2xl bg-[#7a2a2a] px-4 font-bold text-white disabled:opacity-50"
              >
                Add
              </button>
            </form>
          </>
        )}
      </Section>

      <Memories adventureId={view.id} moments={moments} sharing={sharing} />

      <div id="people" className="mx-auto mt-10 max-w-2xl px-4">
        <AdventurePeople
          adventureId={view.id}
          isOwner={isOwner}
          members={view.members}
          you={view.you}
          invites={invites}
        />
      </div>
    </main>
  );
}

function Memories({
  adventureId,
  moments,
  sharing,
}: {
  adventureId: string;
  moments: readonly Moment[];
  sharing: boolean;
}) {
  const router = useRouter();
  const [words, setWords] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    try {
      setPhoto(await shrinkPhoto(chosen));
    } catch {
      toast.error("That photo wouldn't shrink. Try another.");
    }
  }

  async function share(event: React.FormEvent) {
    event.preventDefault();
    if (!words.trim() && !photo) return;
    setBusy(true);
    try {
      await call(`/christmas/api/${adventureId}/moments`, "POST", {
        kind: "moment",
        text: words.trim() || null,
        photo,
      });
      setWords("");
      setPhoto(null);
      if (file.current) file.current.value = "";
      router.refresh();
    } catch {
      toast.error("Couldn't share that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      id="memories"
      title="Memories"
      note="Photos and words, afterwards. Only the two of you can see them."
    >
      {!sharing ? (
        <p className="text-muted-foreground rounded-2xl bg-black/5 p-4 text-sm">
          Sharing memories isn&apos;t switched on yet. Everything else works.
        </p>
      ) : (
        <>
          <ul className="grid gap-3">
            {moments.map((m) => (
              <li
                key={m.id}
                className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/10"
              >
                {m.hasPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/christmas/api/${adventureId}/moments/${m.id}/photo`}
                    alt={m.text ?? "A shared photo"}
                    className="max-h-96 w-full object-cover"
                  />
                )}
                <div className="p-3 text-sm">
                  {m.text && <p>{m.text}</p>}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {m.mine ? "You" : m.by}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <form onSubmit={share} className="mt-4 grid gap-2">
            <textarea
              value={words}
              onChange={(e) => setWords(e.target.value)}
              maxLength={600}
              rows={2}
              placeholder="A moment worth keeping"
              aria-label="A moment worth keeping"
              className="rounded-2xl border p-3 text-base"
            />
            <div className="flex gap-2">
              <label className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border font-bold">
                <Camera className="h-4 w-4" aria-hidden />
                {photo ? "Photo ready" : "Add a photo"}
                <input
                  ref={file}
                  type="file"
                  accept="image/*"
                  onChange={pick}
                  className="sr-only"
                />
              </label>
              <button
                disabled={busy || (!words.trim() && !photo)}
                className="min-h-12 rounded-2xl bg-[#7a2a2a] px-5 font-bold text-white disabled:opacity-50"
              >
                Share
              </button>
            </div>
          </form>
        </>
      )}
    </Section>
  );
}
