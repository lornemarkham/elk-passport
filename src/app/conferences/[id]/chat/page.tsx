import { notFound } from "next/navigation";
import { ChatRoom } from "@/components/conference-together/ChatRoom";
import { ModuleTop, NotOpen } from "@/components/conference-together/ModuleTop";
import { canSee } from "@/domain/conference-plans/views";
import { readRoom } from "@/lib/conference-chat/service";
import { modulePage } from "@/lib/conference-together/page";
import { chatDeps } from "@/lib/conference-together/request";

export const dynamic = "force-dynamic";

/** **The `community` module: group chat.** `?room=<planId>` for a plan's thread. */
export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const page = await modulePage((await params).id, "community");
  if (!page) notFound();
  const { ctx, identity, open } = page;
  const c = ctx.conference;
  if (!open)
    return (
      <>
        <ModuleTop conferenceId={c.id} conferenceName={c.name} title="Chat" />
        <NotOpen what="Chat" />
      </>
    );
  const d = chatDeps();
  const room = await readRoom(
    d,
    identity,
    c.id,
    (await searchParams).room ?? null,
  );
  if (!room) notFound();
  const plans = (await d.plans.plans(c.id)).filter((p) =>
    canSee(p, ctx.viewer.memberId),
  );
  const rooms = [
    { id: null, title: "Everyone" },
    ...plans.map((p) => ({ id: p.id, title: p.title })),
  ];
  return (
    <>
      <ModuleTop
        conferenceId={c.id}
        conferenceName={c.name}
        title="Chat"
        lede="Everyone in the conference can read the main room. Use it to get together, then put the phone away."
      />
      <ChatRoom conferenceId={c.id} initial={room} rooms={rooms} />
    </>
  );
}
