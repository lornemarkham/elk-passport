"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Compass, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/adventure/logo";
import { useAdventures } from "@/lib/data/hooks";

export default function DreamPage() {
  const { data: adventures } = useAdventures();

  const inProgress = adventures?.find(
    (a) => a.status === "planned" || a.status === "active",
  );
  const past = adventures?.filter((a) => a.status === "completed") ?? [];

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 pb-16 sm:px-8">
      <header className="py-4">
        <Logo />
      </header>

      <main className="flex flex-1 flex-col justify-center gap-10 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-4"
        >
          <span className="text-accent inline-flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
            <Compass className="size-4" />
            Basecamp
          </span>
          <h1 className="font-heading text-4xl leading-[1.05] font-semibold text-balance sm:text-6xl">
            Let&apos;s make today unforgettable.
          </h1>
          <p className="text-muted-foreground max-w-md text-lg text-pretty">
            You&apos;ve got time off. We&apos;ll help you turn it into a real
            adventure — no endless scrolling, no wasted afternoon.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          {inProgress ? (
            <Card className="flex flex-col gap-3 p-5">
              <p className="text-muted-foreground text-sm">
                {inProgress.status === "active"
                  ? "Your adventure is underway."
                  : "Your day is planned and ready."}
              </p>
              <p className="font-heading text-2xl font-semibold">
                {inProgress.recommendation.title}
              </p>
              <Button
                size="lg"
                className="mt-1 h-12 w-fit px-6"
                render={
                  <Link
                    href={
                      inProgress.status === "active"
                        ? `/adventure/${inProgress.id}`
                        : `/reveal/${inProgress.id}`
                    }
                  />
                }
              >
                {inProgress.status === "active"
                  ? "Jump back in"
                  : "Reveal your day"}
                <ArrowRight className="size-4" />
              </Button>
            </Card>
          ) : (
            <Button
              size="lg"
              className="h-14 px-8 text-base"
              render={<Link href="/plan" />}
            >
              THIS IS GOING TO BE DOPE
              <ArrowRight className="size-4" />
            </Button>
          )}
        </motion.div>
      </main>

      {past.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-3 border-t pt-8"
        >
          <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            Past adventures
          </h2>
          <ul className="space-y-2">
            {past.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/summary/${a.id}`}
                  className="group hover:border-primary/40 flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="text-muted-foreground size-4" />
                    <span className="font-medium">
                      {a.recommendation.title}
                    </span>
                  </span>
                  <ArrowRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </motion.section>
      )}
    </div>
  );
}
