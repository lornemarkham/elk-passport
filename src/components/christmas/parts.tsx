/** A section with Christmas's heading rhythm. */
export function Section({
  eyebrow,
  title,
  line,
  action,
  children,
  id,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly line?: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
              {eyebrow}
            </p>
          )}
          <h2 className="ghad-display mt-1 text-3xl leading-[1] font-extrabold tracking-[-0.03em] text-balance sm:text-4xl">
            {title}
          </h2>
          {line && (
            <p className="mt-2 text-base text-[var(--gh-ink-soft)]">{line}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Atlas didn't answer — said plainly, never rendered as "nothing on". */
export function AtlasDown() {
  return (
    <p
      role="status"
      data-testid="atlas-down"
      className="rounded-[22px] bg-[#f7e3e1] p-5 text-base font-semibold text-[#8e1d26]"
    >
      Atlas can&apos;t be reached right now, so Passport can&apos;t show
      what&apos;s on. That isn&apos;t the same as nothing being on — try again
      in a minute.
    </p>
  );
}
