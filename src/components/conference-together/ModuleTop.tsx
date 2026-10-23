import Link from "next/link";

/** The top of a module page: back to the conference, and what this is. */
export function ModuleTop({
  conferenceId,
  conferenceName,
  title,
  lede,
}: {
  conferenceId: string;
  conferenceName: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="mx-auto max-w-[760px] px-5 pt-8">
      <Link
        href={`/conferences/${conferenceId}`}
        className="inline-flex min-h-11 items-center text-[15px] text-black/55 underline"
      >
        ← {conferenceName}
      </Link>
      <h1 className="mt-1 text-[34px] leading-none font-black tracking-[-0.03em]">
        {title}
      </h1>
      {lede ? <p className="mt-3 text-[16px] text-black/60">{lede}</p> : null}
    </div>
  );
}

/** A module that can't open here yet, said plainly. */
export function NotOpen({ what }: { what: string }) {
  return (
    <p className="mx-auto mt-6 max-w-[760px] px-5 text-black/60">
      {what} isn&apos;t open yet. The organiser has to switch it on first.
    </p>
  );
}
