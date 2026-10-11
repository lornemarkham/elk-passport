import type { TravelMode } from "@/lib/routing/journey";

const LABEL: Record<TravelMode, string> = {
  driving: "Driving",
  walking: "Walking",
  cycling: "Cycling",
  transit: "Transit",
};

/**
 * **By car or on foot.** Which modes Atlas can actually answer is Atlas's to
 * say: a mode it does not route comes back `unsupported` and is shown as
 * such, so offering a mode here promises nothing.
 */
export function TravelModeSwitch({
  mode,
  onChange,
  modes = ["driving", "walking"],
}: {
  readonly mode: TravelMode;
  readonly onChange: (mode: TravelMode) => void;
  readonly modes?: readonly TravelMode[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label="How you are getting around"
      data-testid="travel-mode"
      className="inline-flex rounded-full border border-black/15 p-0.5"
    >
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={m === mode}
          onClick={() => onChange(m)}
          className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
            m === mode
              ? "bg-[#111] text-white"
              : "text-black/60 hover:bg-black/5"
          }`}
        >
          {LABEL[m]}
        </button>
      ))}
    </div>
  );
}
