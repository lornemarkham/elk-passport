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
      <LabNote direction="the adventure brand" />
      <DayDetail
        subject={found}
        back="/labs/design/v4/adventure"
        backLabel="The Adventure Brand"
      />
    </main>
  );
}
