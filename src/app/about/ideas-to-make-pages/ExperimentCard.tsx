"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageSlot } from "../components";
import type { Experiment } from "./content";

/**
 * One card, one experiment. Collapsed by default so the wall reads as a
 * gallery you walk past, not a report you scroll through — the exact
 * "avoid Heading / Paragraph / Divider repetition" lesson from the Place
 * Detail redesign, applied here to ten cards instead of five sections.
 * Opening a card is the interaction; nothing auto-expands.
 */
export function ExperimentCard({
  experiment,
  reverse = false,
}: {
  experiment: Experiment;
  reverse?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const {
    number,
    title,
    hook,
    feeling,
    why,
    questions,
    crazyIdeas,
    successCriteria,
    imageLabel,
    sandboxHref,
  } = experiment;

  return (
    <div className="border-t border-current/10 pt-10 first:border-t-0 first:pt-0">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-5 md:gap-12">
        <div
          className={`md:col-span-2 ${reverse ? "md:order-2" : "md:order-1"}`}
        >
          <ImageSlot label={imageLabel} aspect="aspect-[4/3]" />
        </div>

        <div
          className={`md:col-span-3 ${reverse ? "md:order-1" : "md:order-2"}`}
        >
          <span className="font-heading text-sm opacity-30">
            {String(number).padStart(2, "0")}
          </span>
          <h3 className="font-heading mt-1 text-3xl tracking-tight md:text-4xl">
            {title}
          </h3>
          <p className="mt-3 max-w-xl text-lg leading-relaxed opacity-80 md:text-xl">
            {hook}
          </p>
          <p className="mt-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
            {feeling}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-current/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-current/5"
            >
              {open ? "Close the brief" : "Open the brief"}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
            {sandboxHref && (
              <Link
                href={sandboxHref}
                className="flex items-center gap-1 text-sm font-medium underline decoration-current/30 underline-offset-4 hover:decoration-current"
              >
                Visit the sandbox
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-8 flex flex-col gap-7 border-l-2 border-current/15 pl-6">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-40">
                      Why this exists
                    </p>
                    <p className="mt-2 text-base leading-relaxed opacity-80">
                      {why}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-40">
                      Questions we&apos;re trying to answer
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {questions.map((q) => (
                        <li
                          key={q}
                          className="text-base leading-relaxed opacity-80"
                        >
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-40">
                      Crazy future ideas
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {crazyIdeas.map((idea) => (
                        <li
                          key={idea}
                          className="text-base leading-relaxed opacity-80"
                        >
                          {idea}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-40">
                      How we&apos;ll know it&apos;s working
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {successCriteria.map((s) => (
                        <li
                          key={s}
                          className="text-base leading-relaxed opacity-80"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
