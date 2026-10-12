/** Conferences are switched off here, and (outside production) why. */
export function Closed({ missing }: { missing: readonly string[] }) {
  return (
    <div className="mx-auto max-w-[560px] px-5 pt-16">
      <h1 className="text-[32px] leading-none font-black">
        Conferences aren&apos;t open here yet.
      </h1>
      {process.env.NODE_ENV !== "production" ? (
        <p className="mt-4 font-mono text-[12px] text-black/45">
          missing: {missing.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
