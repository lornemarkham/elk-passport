import type { PlacePracticalGroup, PlacePracticalItem } from "@/lib/data/types";
import { SectionShell } from "./SectionShell";
import { asOfDate } from "./asOf";
import type { PlaceSectionProps } from "./types";

/**
 * **The practical questions a visit turns on, as Atlas composed them.**
 *
 * Is it open, does it cost, where do I park, are there toilets, can the dog
 * come, is it accessible, is anything closed or unsafe right now. Atlas
 * answers each from what it holds (`practical` on the detail read — see
 * `atlas/src/application/readmodel/practicalKnowledge.ts`), and this
 * component lays the answers out so a reader can find the one they came for
 * without reading the rest: one row per question, the question in the
 * margin, the publisher's own sentences beside it.
 *
 * Passport decides nothing here. Which label means parking, which sentence
 * is a duplicate, which fact restates the hours string — that is Atlas's
 * composition, made once. A row appears only when Atlas holds a statement
 * for it; there is no "Unknown" row, because a group with nothing in it is
 * not sent. Every sentence is verbatim.
 *
 * This replaced five sections that each rendered one field — Facilities
 * (titled "Good To Know"), Accessibility, Hours, Fees, and the key-fact list
 * (titled "Good to know") — which between them showed the same facilities
 * twice, gave a one-sentence hours string a heading of its own, and left
 * "Parking for twenty cars" beside "Trail: Big Ed loop" for the reader to
 * sort. What no group claimed is still here, under "More details", with the
 * publisher's label and grouping exactly as before: composition moves
 * facts, it does not lose them.
 */
export function PlacePractical({ practical }: PlaceSectionProps) {
  if (!practical) return null;
  const { groups, other } = practical;
  if (groups.length === 0 && other.length === 0) return null;

  return (
    <SectionShell title="Good to know">
      <div className="flex flex-col gap-6" data-testid="place-practical">
        {groups.length > 0 && (
          <dl className="grid gap-y-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-6 sm:gap-y-4">
            {groups.map((group) => (
              <PracticalRow key={group.key} group={group} />
            ))}
          </dl>
        )}

        {other.length > 0 && (
          <div data-testid="place-practical-other">
            {groups.length > 0 && (
              <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                More details
              </h3>
            )}
            <div className="flex flex-col gap-5">
              {other.map((block, index) => (
                <div key={block.category ?? `ungrouped-${index}`}>
                  {block.category && (
                    <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      {block.category}
                    </h4>
                  )}
                  <dl className="flex flex-col gap-3">
                    {block.items.map((item, index) => (
                      <div key={`${index}-${item.text.slice(0, 24)}`}>
                        <dt className="text-sm font-medium">{item.label}</dt>
                        <dd className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                          <Statement item={item} withLabel={false} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionShell>
  );
}

/**
 * One question and its answers. The Place's own statements come first;
 * an operator's follow under its name, once, so knowledge composed across
 * an `operates` edge never reads as something the Place stated.
 */
function PracticalRow({ group }: { group: PlacePracticalGroup }) {
  const own = group.items.filter((item) => !item.via);
  const viaOperator = new Map<string, PlacePracticalItem[]>();
  for (const item of group.items) {
    if (!item.via) continue;
    const list = viaOperator.get(item.via.name) ?? [];
    list.push(item);
    viaOperator.set(item.via.name, list);
  }

  return (
    <div
      className="contents"
      data-testid={`practical-${group.key}`}
      role="group"
      aria-label={group.title}
    >
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase sm:pt-0.5">
        {group.title}
      </dt>
      <dd className="flex min-w-0 flex-col gap-2 text-sm leading-relaxed">
        {group.chips && group.chips.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {group.chips.map((chip) => (
              <li
                key={chip}
                className="border-border bg-muted/40 rounded-full border px-2.5 py-1 text-xs"
              >
                {chip}
              </li>
            ))}
          </ul>
        )}
        {own.map((item, index) => (
          <p key={`${index}-${item.text.slice(0, 40)}`}>
            <Statement item={item} />
          </p>
        ))}
        {[...viaOperator.entries()].map(([name, items]) => (
          <div key={name} className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">
              From <span className="font-medium">{name}</span>, which operates
              this place
            </p>
            {items.map((item, index) => (
              <p key={`${index}-${item.text.slice(0, 40)}`}>
                <Statement item={item} />
              </p>
            ))}
          </div>
        ))}
      </dd>
    </div>
  );
}

const BARE_URL = /^https?:\/\/\S+$/i;

/**
 * A statement, verbatim. The label leads when Atlas kept one; the text
 * keeps its line breaks (hours arrive one day per line); a bare URL is a
 * link named by its host, because a 200-character booking URL is not a
 * sentence anyone reads — the target is the whole meaning, and it is
 * unchanged.
 */
function Statement({
  item,
  withLabel = true,
}: {
  item: PlacePracticalItem;
  /** False where the label is already rendered as the term of a definition list. */
  withLabel?: boolean;
}) {
  const asOf = asOfDate(item.asOf);
  return (
    <>
      {withLabel && item.label && (
        <span className="font-medium">{item.label} — </span>
      )}
      {BARE_URL.test(item.text.trim()) ? (
        <a
          href={item.text.trim()}
          className="break-all underline underline-offset-2"
          rel="noreferrer"
        >
          {hostOf(item.text.trim())}
        </a>
      ) : (
        <span className="break-words whitespace-pre-line">{item.text}</span>
      )}
      {asOf && <span className="text-muted-foreground text-xs"> {asOf}</span>}
    </>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
