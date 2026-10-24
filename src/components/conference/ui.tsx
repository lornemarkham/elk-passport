import type { ReactNode } from "react";

/**
 * The few pieces every conference form shares, in the conference kit's
 * colours (`kit.tsx`). Mobile-first: big targets.
 */
export const field =
  "w-full rounded-xl border border-cf-line bg-white px-4 py-3 text-[16px] text-cf-ink outline-none transition placeholder:text-cf-mist focus:border-cf-ink/50 focus:ring-4 focus:ring-cf-ink/5";

export const primary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-cf-ink px-5 text-[15px] font-semibold text-white transition hover:bg-cf-graphite active:scale-[0.98] disabled:opacity-40";

export const secondary =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-cf-line bg-white px-4 text-[14px] font-semibold text-cf-ink transition hover:border-cf-ink/30 disabled:opacity-40";

export function Section({
  title,
  children,
  hint,
}: {
  title: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="cf-serif text-cf-ink text-[21px] leading-tight">
        {title}
      </h2>
      {hint ? (
        <p className="text-cf-slate mt-1 text-[14px] leading-relaxed">{hint}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Problem({ children }: { children: ReactNode }) {
  return children ? (
    <p role="alert" className="mt-2 text-[14px] text-[#b42318]">
      {children}
    </p>
  ) : null;
}
