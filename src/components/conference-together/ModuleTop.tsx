import { PageHead } from "@/components/conference/kit";

/**
 * The top of a module page. The conference bar above it already says which
 * conference this is and leads home, so this is just what the page is.
 */
export function ModuleTop({
  title,
  lede,
  eyebrow,
}: {
  /** Kept for callers; the conference bar names the conference now. */
  conferenceId?: string;
  conferenceName?: string;
  title: string;
  lede?: string;
  eyebrow?: string;
}) {
  return <PageHead eyebrow={eyebrow} title={title} lede={lede} />;
}

/** A module that can't open here yet, said plainly. */
export function NotOpen({ what }: { what: string }) {
  return (
    <p className="text-cf-slate mx-auto mt-6 max-w-[1180px] px-5 sm:px-8">
      {what} isn&apos;t open yet. The organiser has to switch it on first.
    </p>
  );
}
