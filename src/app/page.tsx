"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-12">
          <div className="text-primary mb-4 flex items-center justify-center gap-2">
            <Compass className="h-6 w-6" />
            <span className="text-xl font-semibold">ELK Passport</span>
          </div>

          <h1 className="text-5xl font-bold tracking-tight">
            Discover the Okanagan.
          </h1>

          <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-lg">
            Find unforgettable adventures, hidden gems, wineries, beaches,
            hikes, restaurants, and experiences curated for you.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" render={<Link href="/atlas-test" />}>
            Explore Passport
          </Button>

          <Button size="lg" variant="outline" render={<Link href="/sign-up" />}>
            Sign In / Sign Up
          </Button>
        </div>

        <div className="mt-16 grid w-full max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {[
            "🍷 Wineries",
            "🏖 Beaches",
            "🥾 Hiking",
            "🚲 Cycling",
            "🏌️ Golf",
            "🍔 Food",
            "🚤 Water",
            "🔥 Hidden Gems",
          ].map((item) => (
            <div
              key={item}
              className="bg-card rounded-xl border p-6 text-center text-sm font-medium"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
