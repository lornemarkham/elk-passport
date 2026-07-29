"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdventure, useAdvanceAdventure } from "@/lib/data/hooks";

export default function RevealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: adventure, isLoading } = useAdventure(id);
  const advance = useAdvanceAdventure(id);
  const [revealed, setRevealed] = useState(false);

  if (isLoading) return null;

  if (!adventure) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground">
          We couldn&apos;t find that adventure.
        </p>
        <Button onClick={() => router.push("/plan")}>Plan a new day</Button>
      </div>
    );
  }

  const { recommendation } = adventure;

  async function begin() {
    await advance.mutateAsync(0);
    router.push(`/adventure/${id}`);
  }

  if (!revealed) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Sparkles className="text-accent size-8" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-muted-foreground text-lg"
        >
          Okay, I think I have something you&apos;re going to love.
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.4 }}
        >
          <Button
            size="lg"
            className="h-12 px-6"
            onClick={() => setRevealed(true)}
          >
            Show me
            <ArrowRight className="size-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-3"
      >
        <span className="text-accent text-sm font-semibold tracking-wide uppercase">
          Today&apos;s adventure
        </span>
        <h1 className="font-heading text-4xl leading-tight font-semibold text-balance sm:text-5xl">
          {recommendation.title}
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          {recommendation.tagline}
        </p>
      </motion.div>

      <ol className="mt-10 space-y-4">
        {recommendation.blocks.map((block, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
            className="flex gap-4 border-l-2 pl-4"
          >
            <div className="min-w-0">
              <span className="text-accent text-xs font-semibold tracking-wide uppercase">
                {block.time}
              </span>
              <p className="font-heading text-xl font-semibold">
                {block.title}
              </p>
              <p className="text-muted-foreground">{block.description}</p>
            </div>
          </motion.li>
        ))}
      </ol>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 + recommendation.blocks.length * 0.15 + 0.2 }}
        className="mt-10"
      >
        <Button
          size="lg"
          className="h-14 w-full px-6 text-base sm:w-auto"
          onClick={begin}
        >
          Let&apos;s go
          <ArrowRight className="size-4" />
        </Button>
      </motion.div>
    </div>
  );
}
