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
      <LabNote direction="the everyday explorer" />
      <DayDetail
        subject={found}
        back="/labs/design/v4/explorer"
        backLabel="The Everyday Explorer"
      />
    </main>
  );
}
