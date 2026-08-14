import { ListChecks, NotebookText, Sparkles } from "lucide-react";

interface PassportSidebarProps {
  completed: number;
  total: number;
}

// Shared by every execution style — Flexible and Ordered both track the
// same completedIds, so there's one progress readout, not one per mode.
export function PassportSidebar({ completed, total }: PassportSidebarProps) {
  return (
    <aside aria-label="Passport context" className="flex flex-col gap-4">
      <ProgressCard completed={completed} total={total} />
      <SidebarCard
        icon={NotebookText}
        title="Adventure Snapshot"
        description="A quick look at your trip — dates, travelers, and highlights, once your execution style shapes them."
      />
      <SidebarCard
        icon={Sparkles}
        title="Helpful Insights"
        description="Tips and suggestions to help shape your adventure will appear here."
      />
    </aside>
  );
}

function ProgressCard({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const isComplete = total > 0 && completed === total;
  const remaining = total - completed;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="rounded-xl border border-[#8a5a24]/15 bg-[#f7ecd3] p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-[#8a5a24]/80" />
        <p className="text-sm font-medium text-[#2b2015]">Progress</p>
      </div>

      {isComplete ? (
        <div>
          <p className="text-sm font-semibold text-[#2b2015]">
            Congratulations!
          </p>
          <p className="mt-1 text-xs text-[#2b2015]/60">
            You completed this Passport. All experiences finished.
          </p>
        </div>
      ) : (
        <dl className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-[#2b2015]/55">Completed</dt>
            <dd className="font-medium text-[#2b2015] tabular-nums">
              {completed} / {total}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[#2b2015]/55">Remaining</dt>
            <dd className="font-medium text-[#2b2015] tabular-nums">
              {remaining}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[#2b2015]/55">Progress</dt>
            <dd className="font-medium text-[#2b2015] tabular-nums">
              {percent}%
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function SidebarCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[#8a5a24]/15 bg-[#f7ecd3] p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#8a5a24]/80" />
        <p className="text-sm font-medium text-[#2b2015]">{title}</p>
      </div>
      <p className="text-xs text-[#2b2015]/55">{description}</p>
    </div>
  );
}
