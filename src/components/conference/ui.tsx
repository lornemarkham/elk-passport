import type { ReactNode } from "react";

/** The few pieces every conference screen shares. Mobile-first: big targets. */
export const field =
  "w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-[16px] outline-none focus:border-black/60";

export const primary =
  "rounded-xl bg-black px-5 py-3 text-[16px] font-bold text-white disabled:opacity-40";

export const secondary =
  "rounded-xl border border-black/15 px-4 py-2.5 text-[15px] font-semibold disabled:opacity-40";

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
      <h2 className="text-[13px] font-bold tracking-[0.14em] text-black/50 uppercase">
        {title}
      </h2>
      {hint ? <p className="mt-1 text-[14px] text-black/55">{hint}</p> : null}
      <div className="mt-3">{children}</div>
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
