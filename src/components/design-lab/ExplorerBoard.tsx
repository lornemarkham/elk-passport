"use client";

import type { Subject, Theme } from "@/lib/design-lab/sample";
import { Shelf } from "@/components/design-lab/white";
import { ControlRow } from "@/components/design-lab/Controls";
import { themesOf, useDiscovery } from "@/components/design-lab/useDiscovery";
import { ACCENT } from "@/components/design-lab/brand";

/**
 * **ROUND FOUR, DIRECTION TWO — THE EVERYDAY EXPLORER.**
 *
 * Discovery as a tool you use rather than a page you read. Four compact rows
 * of pills, always visible, always optional — and galleries underneath that
 * answer to them immediately. No apply button, no results count in brackets,
 * no drawer.
 *
 * On a phone the control rows scroll **sideways** rather than wrapping into a
 * tall block, so the controls stay one thumb-height and the photographs start
 * above the fold.
 *
 * The galleries keep their stated basis as they narrow — a theme that falls
 * below three real subjects disappears rather than showing one lonely card —
 * and anything a control cannot honestly do is printed under the controls
 * instead of being silently ignored.
 */
export function ExplorerBoard({
  subjects,
  verbs,
  allThemes,
  base,
  now,
}: {
  readonly subjects: readonly Subject[];
  readonly verbs: readonly { label: string; ids: readonly string[] }[];
  readonly allThemes: readonly Theme[];
  /**
   * Where a subject's page lives, e.g. `/labs/design/v4/explorer`.
   *
   * A string rather than a function: a server component cannot hand a
   * function to a client one, and the id is the only thing that varies.
   */
  readonly base: string;
  /** The server's instant, so the client never reads its own clock. */
  readonly now: string;
}) {
  const { picks, set, results, notes, at, ask } = useDiscovery(
    subjects,
    verbs,
    now,
  );
  const href = (subject: Subject) => `${base}/${subject.id}`;
  const allowed = new Set(results.map((r) => r.subject.id));
  const shelves = themesOf(allThemes, allowed);
  const narrowed = Object.values(picks).some(Boolean);

  return (
    <>
      <section className="mx-auto max-w-[1800px] px-5 pt-6 sm:px-10 sm:pt-10">
        <h1 className="max-w-[15ch] text-[36px] leading-[0.92] font-extrabold tracking-[-0.045em] text-balance uppercase sm:text-[76px]">
          What do you feel like doing?
        </h1>

        <div className="mt-6 sm:mt-9">
          <ControlRow
            label="Something like"
            value={picks.doing}
            onChange={set("doing")}
            choices={verbs.map((verb) => ({
              value: verb.label,
              label: verb.label,
              count: verb.ids.length,
            }))}
          />
          <ControlRow
            label="Who is coming"
            value={picks.who}
            onChange={set("who")}
            choices={[
              { value: "just me", label: "just me" },
              { value: "a young child", label: "a young child" },
              { value: "friends", label: "friends" },
            ]}
          />
          <ControlRow
            label="When"
            value={picks.when}
            onChange={set("when")}
            choices={[
              { value: "today", label: "today" },
              { value: "this week", label: "this week" },
              { value: "sometime", label: "sometime" },
            ]}
          />
          <ControlRow
            label="How far"
            value={picks.far}
            onChange={set("far")}
            choices={[
              { value: "anywhere", label: "anywhere" },
              {
                value: "close to home",
                label: "close to home",
                ...(at ? {} : { blocked: "Share where you are first" }),
              },
              {
                value: "worth the drive",
                label: "worth the drive",
                ...(at ? {} : { blocked: "Share where you are first" }),
              },
            ]}
            after={
              !at && ask ? (
                <button
                  type="button"
                  data-testid="explorer-locate"
                  onClick={ask}
                  style={{ color: ACCENT }}
                  className="inline-flex min-h-11 shrink-0 items-center px-3 text-[14px] font-semibold whitespace-nowrap underline underline-offset-4"
                >
                  share where you are
                </button>
              ) : null
            }
          />
        </div>

        {/* What the controls did, and what they could not. Printed, never
            implied. */}
        <div className="mt-3 flex flex-col gap-1">
          <p className="text-[13px] font-semibold tabular-nums">
            {results.length} {results.length === 1 ? "place" : "places"}
            {narrowed ? " match" : " to look at"}
          </p>
          {notes.map((note) => (
            <p
              key={note}
              data-testid="explorer-note"
              className="max-w-[72ch] text-[12.5px] leading-relaxed text-black/40"
            >
              {note}
            </p>
          ))}
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-11 pb-20 sm:mt-12 sm:gap-16">
        {shelves.map((theme, index) => (
          <section key={theme.key} data-testid="explorer-shelf">
            <div className="mx-auto max-w-[1800px] px-5 sm:px-10">
              <h2 className="text-[24px] leading-[0.95] font-extrabold tracking-[-0.04em] uppercase sm:text-[44px]">
                {theme.title}
              </h2>
              <p className="mt-1 text-[12.5px] text-black/40">
                {theme.basis} · {theme.subjects.length}
              </p>
            </div>
            <div className="mt-4 sm:mt-6">
              <Shelf
                subjects={theme.subjects}
                href={href}
                ratio={index % 2 === 0 ? "3/2" : "4/5"}
                wide={index === 0}
              />
            </div>
          </section>
        ))}

        {/* **Narrowing must not empty the page.** Themes need three or four
            real subjects to be a shelf; once the sentence has cut the pool to
            eleven, none of them qualifies and the page went blank below the
            photograph. The results themselves become the one shelf. */}
        {shelves.length === 0 && results.length > 0 && (
          <section data-testid="explorer-shelf">
            <div className="mx-auto max-w-[1800px] px-5 sm:px-10">
              <h2 className="text-[26px] leading-[0.95] font-extrabold tracking-[-0.04em] uppercase sm:text-[48px]">
                What we found
              </h2>
              <p className="mt-1 text-[12.5px] text-black/40">
                Everything matching, nearest first where Atlas has placed it ·{" "}
                {results.length}
              </p>
            </div>
            <div className="mt-4 sm:mt-6">
              <Shelf
                subjects={results.map((r) => r.subject)}
                href={href}
                ratio="3/2"
                wide
              />
            </div>
          </section>
        )}

        {shelves.length === 0 && results.length === 0 && (
          <p className="mx-auto max-w-[1800px] px-5 text-[15px] text-black/50 sm:px-10">
            Nothing left once all of that is applied. Take something back off —
            Passport would rather show you nothing than pad this out.
          </p>
        )}
      </div>
    </>
  );
}
