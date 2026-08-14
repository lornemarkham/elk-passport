"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, X, ChevronDown, FileCode2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getConcept } from "./glossary";
import { LAYER_META, getTraceAction, type TraceEvent } from "./traceActions";
import { useTrace } from "./TraceContext";

/**
 * ELK Learning Tracer — a live application narrator, not an
 * "Apply Enrichment explainer."
 *
 * Renders any `TraceAction` as a vertical architecture flow — one card per
 * `TraceEvent`, connected by an animated flow line — generically, with no
 * per-action rendering branches. The goal: the collapsed flow alone (icons,
 * layer badges, short labels, arrows) should communicate what happened in
 * well under 10 seconds; expanding a card is for going deeper (What, Why,
 * Files, Concepts), not for baseline understanding.
 *
 * Reads its own state from `useTrace()` (a `TraceContext` mounted once at
 * the Curator Workbench layout level) rather than taking `open`/`onClose`/
 * `emission` as props — any component under that provider can call
 * `useTrace().record(...)` directly, so the panel updates automatically as
 * you use the app, with no callback chain threading through unrelated
 * components.
 *
 * Deliberately not a modal — a fixed, non-blocking side panel. See
 * learning-tracer/README.md for full scope.
 */
export function LearningTracerPanel() {
  const { emission, open, close } = useTrace();
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>(
    {},
  );
  const [expandedConcepts, setExpandedConcepts] = useState<
    Record<string, boolean>
  >({});

  const action = emission ? getTraceAction(emission.actionId) : undefined;

  function toggleEvent(id: string) {
    setExpandedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleConcept(key: string) {
    setExpandedConcepts((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <aside
      className={`bg-background fixed top-0 right-0 z-50 flex h-full w-full flex-col border-l shadow-2xl transition-transform duration-200 ease-out sm:w-[440px] ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          <p className="text-sm font-semibold">Learning Tracer</p>
        </div>
        <Button variant="ghost" size="sm" onClick={close}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!emission || !action ? (
          <div className="text-muted-foreground flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center text-sm">
            <GraduationCap className="h-6 w-6 opacity-40" />
            <p>
              Perform a traced action — like applying enrichment in the Content
              Explorer — to see it explained here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold">{action.title}</h2>
              <p className="text-muted-foreground text-xs">
                {emission.headline}
                {emission.detail ? ` · ${emission.detail}` : ""}
              </p>
            </div>

            <div className="flex flex-col">
              {action.events.map((event, i) => (
                <div key={event.id}>
                  {i > 0 && <FlowConnector index={i} />}
                  <EventCard
                    event={event}
                    open={!!expandedEvents[event.id]}
                    onToggle={() => toggleEvent(event.id)}
                    index={i}
                    expandedConcepts={expandedConcepts}
                    onToggleConcept={toggleConcept}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

/** A short animated line with a traveling dot — suggests data flowing from one layer to the next without needing a caption. */
function FlowConnector({ index }: { index: number }) {
  return (
    <div className="relative ml-4 flex h-4 w-px items-start justify-center">
      <div className="bg-border h-full w-px" />
      <motion.div
        className="bg-primary absolute h-1.5 w-1.5 rounded-full"
        style={{ top: 0 }}
        animate={{ top: ["0%", "100%"], opacity: [0, 1, 0] }}
        transition={{
          duration: 1.6,
          repeat: Infinity,
          delay: index * 0.15,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

function EventCard({
  event,
  open,
  onToggle,
  index,
  expandedConcepts,
  onToggleConcept,
}: {
  event: TraceEvent;
  open: boolean;
  onToggle: () => void;
  index: number;
  expandedConcepts: Record<string, boolean>;
  onToggleConcept: (key: string) => void;
}) {
  const meta = LAYER_META[event.layer];
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="rounded-lg border"
    >
      <button
        className="flex w-full items-center gap-2.5 p-2.5 text-left"
        onClick={onToggle}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${meta.colorClass}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={`text-[10px] ${meta.colorClass}`}
            >
              {meta.label}
            </Badge>
            <span className="truncate text-xs font-medium">{event.label}</span>
          </span>
        </span>
        <span className="text-muted-foreground shrink-0 text-[10px]">
          {event.files.length} file{event.files.length === 1 ? "" : "s"} ·{" "}
          {event.conceptIds.length} concept
          {event.conceptIds.length === 1 ? "" : "s"}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          className="shrink-0"
        >
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 border-t px-2.5 pt-2.5 pb-2.5 text-xs">
              <div>
                <p className="text-muted-foreground mb-0.5 font-medium">What</p>
                <p className="leading-relaxed">{event.what}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5 font-medium">Why</p>
                <p className="leading-relaxed">{event.why}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5 font-medium">
                  Files
                </p>
                <div className="flex flex-col gap-0.5">
                  {event.files.map((f) => (
                    <span
                      key={f}
                      className="text-muted-foreground/80 flex items-center gap-1 font-mono text-[10px]"
                    >
                      <FileCode2 className="h-2.5 w-2.5 shrink-0" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              {event.conceptIds.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 font-medium">
                    Concepts
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {event.conceptIds.map((conceptId) => {
                      const concept = getConcept(conceptId);
                      if (!concept) return null;
                      const key = `${event.id}:${conceptId}`;
                      const isOpen = !!expandedConcepts[key];
                      return (
                        <div key={key} className="bg-muted/30 rounded-md p-1.5">
                          <button
                            className="flex w-full items-center justify-between gap-2 text-left"
                            onClick={() => onToggleConcept(key)}
                          >
                            <span className="font-medium">{concept.term}</span>
                            <motion.span
                              animate={{ rotate: isOpen ? 180 : 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <ChevronDown className="text-muted-foreground h-3 w-3" />
                            </motion.span>
                          </button>
                          {!isOpen && (
                            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[10px]">
                              {concept.definition}
                            </p>
                          )}
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-1.5 flex flex-col gap-1.5 border-t pt-1.5 text-[10px]">
                                  <p className="leading-relaxed">
                                    {concept.definition}
                                  </p>
                                  <p className="text-muted-foreground leading-relaxed">
                                    <span className="font-medium">
                                      Why it exists:{" "}
                                    </span>
                                    {concept.whyItMatters}
                                  </p>
                                  <p className="text-muted-foreground leading-relaxed">
                                    <span className="font-medium">Here: </span>
                                    {concept.passportExample}
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
