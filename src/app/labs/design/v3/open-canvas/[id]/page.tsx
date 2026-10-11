import { notFound } from "next/navigation";
import { subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";
import { WhiteDetail } from "@/components/design-lab/WhiteDetail";

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
      <LabNote direction="open canvas" />
      <WhiteDetail
        subject={found}
        back="/labs/design/v3/open-canvas"
        backLabel="Open Canvas"
        opening="band"
      />
    </main>
  );
}
