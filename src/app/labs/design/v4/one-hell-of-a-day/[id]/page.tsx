import { notFound } from "next/navigation";
import { subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";
import { DayDetail } from "@/components/design-lab/DayDetail";

export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await subject(id);
  if (!found) notFound();

  return (
    <main className="min-h-screen bg-white text-black">
      <LabNote direction="one hell of a day" />
      <DayDetail
        subject={found}
        back="/labs/design/v4/one-hell-of-a-day"
        backLabel="One Hell of a Day"
      />
    </main>
  );
}
