"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Camera, RotateCcw, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/adventure/logo";
import { toast } from "sonner";
import { useAdventure } from "@/lib/data/hooks";

export default function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: adventure, isLoading } = useAdventure(id);

  if (isLoading) return null;
  if (!adventure) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground">
          We couldn&apos;t find that adventure.
        </p>
        <Button onClick={() => router.push("/")}>Back to basecamp</Button>
      </div>
    );
  }

  const { recommendation, moments } = adventure;

  async function share() {
    const text = `${recommendation.title} — ${recommendation.tagline}\n\nThis is what I did. You should do it too. (via ELK Passport)`;
    if (navigator.share) {
      await navigator.share({ title: recommendation.title, text });
    } else {
      await navigator.clipboard.writeText(text);
      toast("Copied your recap — go paste it somewhere great.");
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 pb-16 sm:px-8">
      <header className="py-4">
        <Logo />
      </header>

      <main className="flex-1 space-y-10 py-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-3 text-center"
        >
          <span className="border-accent text-accent inline-flex -rotate-2 items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-bold tracking-wide uppercase">
            <Sparkles className="size-3.5" />
            NFR — No Friggin&apos; Regrets
          </span>
          <h1 className="font-heading text-4xl font-semibold text-balance">
            {recommendation.title}
          </h1>
          <p className="text-muted-foreground text-lg text-pretty">
            That was a damn good day.
          </p>
        </motion.div>

        {moments.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {moments.map((moment, i) => (
              <motion.div
                key={moment.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
              >
                <Card className="gap-2 overflow-hidden p-0">
                  {moment.photoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={moment.photoDataUrl}
                      alt={moment.note ?? "Captured moment"}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="bg-muted text-muted-foreground flex aspect-square w-full items-center justify-center">
                      <Camera className="size-6" />
                    </div>
                  )}
                  {moment.note && <p className="p-3 text-sm">{moment.note}</p>}
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center text-sm">
            No moments captured this time — next adventure, snap something.
          </p>
        )}

        <div className="space-y-3 border-t pt-8">
          {recommendation.blocks.map((block, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-muted-foreground w-20 shrink-0 text-xs font-semibold uppercase">
                {block.time}
              </span>
              <span className="text-muted-foreground">{block.title}</span>
            </div>
          ))}
        </div>
      </main>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          size="lg"
          className="h-14 flex-1"
          onClick={share}
        >
          <Share2 className="size-4" />
          Share this day
        </Button>
        <Button
          size="lg"
          className="h-14 flex-1"
          render={<Link href="/plan" />}
        >
          <RotateCcw className="size-4" />
          Dream again
        </Button>
      </div>
    </div>
  );
}
