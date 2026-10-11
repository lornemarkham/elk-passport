import { JoinWithCode } from "@/components/conference/JoinWithCode";

type Props = { searchParams?: Promise<{ code?: string | string[] }> };

/** `/conferences/join?code=…`: a code you can put in a QR or a calendar invite. */
export default async function JoinPage({ searchParams }: Props) {
  const code = (await searchParams)?.code;
  return (
    <div className="mx-auto max-w-[560px] px-5 pt-16">
      <h1 className="text-[36px] leading-none font-black tracking-[-0.03em]">
        Join a conference
      </h1>
      <p className="mt-3 mb-6 text-black/60">
        Type the code from your invitation. No account needed.
      </p>
      <JoinWithCode initial={typeof code === "string" ? code : ""} />
    </div>
  );
}
