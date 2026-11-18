import type { Metadata } from "next";
import { CreatePulse } from "./CreatePulse";

export const metadata: Metadata = { title: "Create a Pulse" };

export default function NewPulse() {
  return (
    <>
      <h1 className="font-heading pt-4 text-[32px] leading-tight font-bold tracking-tight">
        Create a Pulse
      </h1>
      <p className="mt-2 mb-6 text-[15px] text-[#5c6370]">
        A clear question and two answers is all it takes.
      </p>
      <CreatePulse />
    </>
  );
}
