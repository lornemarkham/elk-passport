"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Personality } from "./content";

/**
 * One personality, closed by default — the same "gallery, not a report"
 * discipline `ExperimentCard.tsx` established for the ideas wall, reused
 * here at a much larger scale (forty-plus cards instead of ten). A
 * Prototype card gets a real link to the real page; an Idea card gets a
 * status pill and nothing to click through to, because there's nothing
 * built yet — the honest state, not a placeholder link to nowhere.
 */
export function PersonalityCard({ personality }: { personality: Personality }) {
  const [open, setOpen] = useState(false);
  const {
    emoji,
    name,
    whoFor,
    emotion,
    weather,
    season,
    soundtrack,
    coreMemory,
    interaction,
    status,
    href,
    futureIdeas,
  } = personality;

  return (
    <div className="rounded-2xl border border-current/15 p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <p className="font-heading text-lg leading-tight">{name}</p>
            <p className="text-xs opacity-50">{whoFor}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
              status === "Prototype"
                ? "bg-[#ff5a1f]/20 text-[#ff5a1f]"
                : "border border-current/20 opacity-50"
            }`}
          >
            {status}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-current/10 pt-4 text-sm">
              <div>
                <dt className="text-xs tracking-wide uppercase opacity-40">
                  Primary emotion
                </dt>
                <dd className="opacity-80">{emotion}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide uppercase opacity-40">
                  Typical weather
                </dt>
                <dd className="opacity-80">{weather}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide uppercase opacity-40">
                  Typical season
                </dt>
                <dd className="opacity-80">{season}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide uppercase opacity-40">
                  Typical soundtrack
                </dt>
                <dd className="opacity-80">{soundtrack}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs tracking-wide uppercase opacity-40">
                  Core memory
                </dt>
                <dd className="italic opacity-80">{coreMemory}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs tracking-wide uppercase opacity-40">
                  Signature interaction
                </dt>
                <dd className="opacity-80">{interaction}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs tracking-wide uppercase opacity-40">
                  Future ideas
                </dt>
                <dd>
                  <ul className="mt-1 flex flex-col gap-1 opacity-70">
                    {futureIdeas.map((idea) => (
                      <li key={idea}>— {idea}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
            {href && (
              <Link
                href={href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#ff5a1f] hover:underline"
              >
                Visit the prototype <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
