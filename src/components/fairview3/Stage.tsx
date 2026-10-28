"use client";

import { AnimatePresence, motion } from "framer-motion";
import { questionForSection, teamForSection } from "@/lib/fairview3/show";
import { initialState } from "@/lib/fairview3/store";
import { Finale } from "./Finale";
import {
  ChallengeStage,
  Curtain,
  Know,
  Merlin,
  Parallel,
  Spellbook,
  TeamSection,
  VoteStage,
} from "./Sections";
import { useLive } from "./useLive";

/** The projector. Public, read-only, follows the presenter's console. */
export function Stage() {
  const { snapshot, link } = useLive(1500);
  const state = snapshot?.state ?? initialState();
  const section = state.section;
  const team = teamForSection(section);
  const question = questionForSection(section);

  return (
    <main className="relative overflow-hidden">
      <div
        className="fixed top-4 right-5 z-20 flex items-center gap-3 rounded-full bg-black/40 px-4 py-1.5 text-sm text-white/80 backdrop-blur"
        data-testid="stage-status"
        data-link={link}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${link === "live" ? "bg-emerald-400" : "fv3-pulse bg-amber-400"}`}
        />
        <span className="fv3-display-tight text-white">
          {snapshot?.participants ?? 0}
        </span>{" "}
        in the circle
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={section}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.45 }}
        >
          {section === "curtain" && (
            <Curtain mode="stage" participants={snapshot?.participants ?? 0} />
          )}
          {section === "merlin" && <Merlin mode="stage" />}
          {section === "spellbook" && <Spellbook mode="stage" />}
          {team && <TeamSection team={team} mode="stage" />}
          {section === "parallel" && <Parallel mode="stage" />}
          {section === "know" && <Know mode="stage" />}
          {question && snapshot && (
            <VoteStage question={question} snapshot={snapshot} />
          )}
          {section === "challenge" && snapshot && (
            <ChallengeStage snapshot={snapshot} />
          )}
          {section === "finale" && (
            <Finale mode="stage" finale={state.finale} />
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
