import {
  ASSESSMENT_INFO,
  STANCE_LABEL,
  type Assessment,
  type PlacedSource,
  type Stance,
} from "@/lib/pulse/check";

const day = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString(
    "en-CA",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "America/Vancouver",
    },
  );

/** The assessment, said with who made it and what it is not. */
export function AssessmentCard({
  assessment,
  suggested,
  summary,
  investigatedAt,
  updatedAt,
  sources,
}: {
  assessment: Assessment;
  suggested: Assessment;
  summary: string | null;
  investigatedAt: string;
  updatedAt: string;
  sources: number;
}) {
  const info = ASSESSMENT_INFO[assessment];
  return (
    <section
      aria-labelledby="check-assessment"
      className="rounded-2xl border-2 bg-white p-4"
      style={{ borderColor: info.color }}
      data-testid="check-assessment"
      data-assessment={assessment}
    >
      <p className="text-[12px] font-bold tracking-[0.14em] text-[#5c6370] uppercase">
        What the evidence supports
      </p>
      <h2
        id="check-assessment"
        className="mt-1 text-[26px] leading-tight font-extrabold tracking-tight uppercase"
        style={{ color: info.color }}
      >
        {info.label}
      </h2>
      <p className="mt-1 text-[15px] text-[#3f4550]">{info.line}</p>
      {summary ? (
        <p className="mt-3 rounded-xl bg-[#f3f1ec] p-3 text-[15px] leading-relaxed">
          <span className="font-semibold">In the asker&apos;s words: </span>
          {summary}
        </p>
      ) : null}
      <p
        className="mt-3 text-[13px] leading-relaxed text-[#5c6370]"
        data-testid="check-assessed-by"
      >
        <strong className="text-[#14161a]">Not independently verified.</strong>{" "}
        Assessed by the person who asked, from the{" "}
        {sources === 1 ? "source" : `${sources} sources`} below
        {sources === 0 ? " (none yet)" : ""}, within rules that need a matching
        source for every verdict.
        {suggested !== assessment
          ? ` From how the sources are placed alone, the rules would say “${ASSESSMENT_INFO[suggested].label}”.`
          : ""}{" "}
        Investigated {day(investigatedAt)}
        {updatedAt !== investigatedAt
          ? `, last corrected ${day(updatedAt)}`
          : ""}
        .
      </p>
    </section>
  );
}

function SourceCard({ s }: { s: PlacedSource }) {
  return (
    <li
      className="rounded-2xl border border-[#e7e3da] bg-white p-4"
      data-testid="check-source"
    >
      <a
        href={s.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-[16px] leading-snug font-semibold text-[#14161a] underline decoration-[#d9d4c8] underline-offset-4 hover:decoration-[#14161a]"
      >
        {s.title ?? s.site}
      </a>
      <p className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-[#5c6370]">
        <span className="font-medium text-[#3f4550]">{s.site}</span>
        <span>
          {s.published
            ? `Published ${day(s.published)}`
            : "No publication date on the page"}
        </span>
        <span>Read {day(s.readAt)}</span>
      </p>
      {s.excerpts.length ? (
        <div className="mt-3 grid gap-2">
          {s.excerpts.map((x) => (
            <blockquote
              key={x}
              className="border-l-4 border-[#d9d4c8] pl-3 text-[15px] leading-relaxed"
            >
              “{x}”
            </blockquote>
          ))}
          <p className="text-[12px] text-[#8a909a]">
            Copied word for word from the page.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[14px] text-[#5c6370]">
          No sentence on the page mentions the claim&apos;s figures or key
          words.
        </p>
      )}
      <p className="mt-2 text-[13px] text-[#5c6370]">
        {s.figureFound
          ? "The claim's figure appears on this page."
          : "The claim's figure does not appear on this page."}
      </p>
      {s.note ? (
        <p className="mt-2 text-[14px]">
          <span className="font-semibold">Asker&apos;s note: </span>
          {s.note}
        </p>
      ) : null}
    </li>
  );
}

const GROUPS: { stance: Stance; title: string }[] = [
  { stance: "supports", title: "Supporting sources" },
  { stance: "contradicts", title: "Contradicting sources" },
  { stance: "context", title: "Context" },
];

/** Every source, grouped by what the asker said it shows. */
export function Sources({ sources }: { sources: readonly PlacedSource[] }) {
  if (!sources.length)
    return (
      <p
        className="rounded-2xl border border-dashed border-[#d9d4c8] p-4 text-[15px] text-[#5c6370]"
        data-testid="check-no-sources"
      >
        No sources yet. Know of one? Suggest it in the conversation below.
      </p>
    );
  return (
    <div className="grid gap-5">
      {GROUPS.map(({ stance, title }) => {
        const list = sources.filter((s) => s.stance === stance);
        return (
          <div key={stance} data-testid={`check-sources-${stance}`}>
            <h3 className="text-[12px] font-bold tracking-[0.14em] text-[#5c6370] uppercase">
              {title} · {list.length}
            </h3>
            <p className="sr-only">{STANCE_LABEL[stance]}</p>
            {list.length ? (
              <ul className="mt-2 grid gap-3">
                {list.map((s) => (
                  <SourceCard key={s.url} s={s} />
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[14px] text-[#8a909a]">None listed.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { day as fmtDay };
