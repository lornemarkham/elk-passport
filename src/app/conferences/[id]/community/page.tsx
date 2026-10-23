import { redirect } from "next/navigation";

/** The `community` module's page is the chat. */
export default async function CommunityModule({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect(`/conferences/${(await params).id}/chat`);
}
