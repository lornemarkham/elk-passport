/**
 * **A place, an activity or an event, before Atlas has answered for it.**
 *
 * Measured on production (2026-11-17): a place page took 9–11 s to its first
 * byte on every visit. The memo in `getPlaceDetail` takes the repeat visits
 * off that; the first visit still waits on Atlas, and for those seconds the
 * person who tapped a card sees this — the shape of the page that is coming
 * (a picture, a name, a few lines), in its first bytes — instead of the card
 * they already tapped, apparently ignored.
 *
 * Server-rendered and static; the pulse stops for reduced motion.
 */
export function SubjectSkeleton() {
  const block =
    "animate-pulse rounded-xl bg-black/[0.06] motion-reduce:animate-none";
  return (
    <main
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12"
      aria-busy="true"
      data-testid="subject-loading"
    >
      <div className={`${block} aspect-[21/9] w-full`} aria-hidden />
      <div className="space-y-3" aria-hidden>
        <div className={`${block} h-9 w-2/3`} />
        <div className={`${block} h-4 w-1/3`} />
      </div>
      <div className="space-y-2" aria-hidden>
        <div className={`${block} h-4 w-full`} />
        <div className={`${block} h-4 w-11/12`} />
        <div className={`${block} h-4 w-4/5`} />
      </div>
      <p
        role="status"
        className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase"
      >
        Getting everything we know about it…
      </p>
    </main>
  );
}
