import type { Metadata } from "next";
import { PassportVideoCard } from "@/components/passport/PassportVideoCard";

export const metadata: Metadata = {
  title: "Campfire Card — Passport Labs",
};

export default function CampfireCardPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0b0b0b] p-10">
      <div className="w-full max-w-xs">
        <PassportVideoCard
          title="Campfire"
          videoSrc="/video/campfire-summer.mp4"
        />
      </div>
    </div>
  );
}
