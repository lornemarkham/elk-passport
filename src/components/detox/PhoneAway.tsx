/**
 * **A phone, going away.**
 *
 * The one illustration Go Offline has: a phone sliding down into a glovebox
 * and its signal bars going out one at a time. Drawn in CSS rather than
 * photographed, because the doctrine keeps photography for places — and a
 * stock photo of somebody serenely not looking at their phone is exactly the
 * wellness cliché this experience is trying not to be.
 *
 * The motion only runs for people who have not asked for less of it, and the
 * resting frame (phone half-in, no bars) reads perfectly well without it.
 */
export function PhoneAway() {
  return (
    <div
      aria-hidden
      data-testid="offline-phone-away"
      className="relative mx-auto h-[260px] w-[220px] select-none"
    >
      <style>{CSS}</style>
      {/* The phone. */}
      <div className="detox-phone absolute left-1/2 h-[200px] w-[104px] -translate-x-1/2 rounded-[22px] bg-[#111] p-2">
        <div className="flex h-full flex-col rounded-[16px] bg-white px-3 py-3">
          <div className="flex items-end gap-[3px]">
            {[0, 1, 2, 3].map((bar) => (
              <span
                key={bar}
                className="detox-bar block w-[4px] rounded-[1px] bg-[#111]"
                style={{
                  height: `${5 + bar * 3}px`,
                  animationDelay: `${1.4 - bar * 0.25}s`,
                }}
              />
            ))}
          </div>
          <p className="ghad-display mt-auto text-[17px] leading-[1] font-extrabold tracking-[-0.03em] text-[#111]">
            Bye for now.
          </p>
        </div>
      </div>
      {/* The glovebox: the phone disappears behind its lid. */}
      <div className="absolute inset-x-0 bottom-0 h-[110px] rounded-t-[10px] rounded-b-[18px] bg-[#111]">
        <div
          className="absolute inset-x-6 top-4 h-[3px]"
          style={{ backgroundColor: "var(--ghad-accent)" }}
        />
        <div className="absolute top-1/2 right-6 h-3 w-8 rounded-full bg-white/25" />
      </div>
    </div>
  );
}

const CSS = `
.detox-phone { top: 30px; }
.detox-bar { opacity: 0.12; }
@media (prefers-reduced-motion: no-preference) {
  .detox-phone { animation: detox-sink 3.2s cubic-bezier(.6,0,.3,1) .4s both; }
  .detox-bar { animation: detox-fade .35s ease-in both; }
}
@keyframes detox-sink {
  0%, 20% { top: -10px; }
  100% { top: 30px; }
}
@keyframes detox-fade {
  from { opacity: 1; }
  to { opacity: 0.12; }
}
`;
