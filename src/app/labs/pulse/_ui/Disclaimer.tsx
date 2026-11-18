/** Said plainly wherever results appear. */
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      data-testid="pulse-disclaimer"
      className="rounded-2xl border border-[#e7e3da] bg-white p-4 text-[13.5px] leading-relaxed text-[#5c6370]"
    >
      <p className="font-semibold text-[#14161a]">
        Voluntary responses, not a scientific poll.
      </p>
      <p className="mt-1">
        Anyone with the link can answer, so results show what the people who
        chose to respond think — not Canada, a province or a city as a whole.
        {compact
          ? null
          : " One vote per browser and a cap per network make casual repeat voting hard, not impossible. Places are self-reported and not verified. Small groups are hidden so no one's answer can be picked out."}
      </p>
    </aside>
  );
}
