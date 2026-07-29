"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { AppHeader } from "@/components/adventure/app-header";
import { cn } from "@/lib/utils";
import {
  ADVENTURE_DNA_TRAITS,
  TODAYS_INTENTS,
  type Constraints,
  type TodaysIntent,
} from "@/lib/schemas";
import {
  useAdventureDna,
  useCreateAdventure,
  useSaveAdventureDna,
} from "@/lib/data/hooks";

const STEP_COUNT = 3;

const TIME_OPTIONS: Constraints["timeAvailable"][] = [
  "A few hours",
  "Half a day",
  "All day",
];
const BUDGET_OPTIONS: Constraints["budget"][] = [
  "Keep it free/cheap",
  "Some spending money",
  "Treat me",
];

const CURATING_LINES = [
  "Scouting your options...",
  "Checking the vibe...",
  "Weighing the good stuff...",
  "Almost got it...",
];

export default function PlanPage() {
  const router = useRouter();
  const { data: savedDna } = useAdventureDna();
  const saveDna = useSaveAdventureDna();
  const createAdventure = useCreateAdventure();

  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<TodaysIntent | null>(null);
  const [timeAvailable, setTimeAvailable] =
    useState<Constraints["timeAvailable"]>("Half a day");
  const [budget, setBudget] = useState<Constraints["budget"]>(
    "Some spending money",
  );
  const [location, setLocation] = useState("");
  const [traits, setTraits] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [curatingLine, setCuratingLine] = useState(CURATING_LINES[0]);

  // Adjust local state when the saved Adventure DNA first loads, following
  // React's documented pattern for syncing state during render rather than
  // in an effect (avoids a redundant extra render from a set-state-in-effect).
  const [syncedDna, setSyncedDna] = useState(savedDna);
  if (savedDna && savedDna !== syncedDna) {
    setSyncedDna(savedDna);
    setTraits(savedDna.traits);
    setNotes(savedDna.notes ?? "");
  }

  useEffect(() => {
    if (!createAdventure.isPending) return;
    const id = setInterval(() => {
      setCuratingLine((prev) => {
        const i = CURATING_LINES.indexOf(prev);
        return CURATING_LINES[(i + 1) % CURATING_LINES.length];
      });
    }, 900);
    return () => clearInterval(id);
  }, [createAdventure.isPending]);

  function toggleTrait(trait: string) {
    setTraits((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait],
    );
  }

  async function handleSubmit() {
    if (!intent) return;
    saveDna.mutate({ traits, notes: notes || undefined });
    const adventure = await createAdventure.mutateAsync({
      intent,
      constraints: { timeAvailable, budget, location: location || "nearby" },
      dna: { traits, notes: notes || undefined },
    });
    router.push(`/reveal/${adventure.id}`);
  }

  if (createAdventure.isPending) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        >
          <Compass className="text-primary size-10" />
        </motion.div>
        <p className="font-heading text-2xl font-semibold">Curating your day</p>
        <motion.p
          key={curatingLine}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-muted-foreground"
        >
          {curatingLine}
        </motion.p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 pb-16 sm:px-8">
      <AppHeader backHref="/" backLabel="Cancel" />

      <div className="px-1 pt-2 pb-6">
        <Progress value={((step + 1) / STEP_COUNT) * 100} />
      </div>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.section
              key="intent"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h1 className="font-heading text-3xl font-semibold">
                  What kind of day is this?
                </h1>
                <p className="text-muted-foreground">
                  No wrong answer — just today&apos;s mood.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TODAYS_INTENTS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setIntent(option);
                      setTimeout(() => setStep(1), 250);
                    }}
                    className={cn(
                      "hover:border-primary/50 hover:bg-secondary rounded-xl border px-4 py-6 text-center font-medium transition-all",
                      intent === option &&
                        "border-primary bg-primary text-primary-foreground scale-[0.97]",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </motion.section>
          )}

          {step === 1 && (
            <motion.section
              key="constraints"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="space-y-1">
                <h1 className="font-heading text-3xl font-semibold">
                  How much day do you have?
                </h1>
                <p className="text-muted-foreground">
                  Quick constraints so nothing gets suggested you can&apos;t
                  use.
                </p>
              </div>

              <div className="space-y-3">
                <Label>Time available</Label>
                <div className="flex flex-wrap gap-2">
                  {TIME_OPTIONS.map((option) => (
                    <Chip
                      key={option}
                      selected={timeAvailable === option}
                      onClick={() => setTimeAvailable(option)}
                    >
                      {option}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Budget</Label>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_OPTIONS.map((option) => (
                    <Chip
                      key={option}
                      selected={budget === option}
                      onClick={() => setBudget(option)}
                    >
                      {option}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="location">
                  Where are you exploring around?
                </Label>
                <Input
                  id="location"
                  placeholder="Your city, neighbourhood, or 'near me'"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  variant="ghost"
                  className="h-12"
                  onClick={() => setStep(0)}
                >
                  Back
                </Button>
                <Button className="h-12 px-6" onClick={() => setStep(2)}>
                  Continue
                </Button>
              </div>
            </motion.section>
          )}

          {step === 2 && (
            <motion.section
              key="dna"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="space-y-1">
                <h1 className="font-heading text-3xl font-semibold">
                  Sound like you?
                </h1>
                <p className="text-muted-foreground">
                  Pick a few — this sticks around for next time.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {ADVENTURE_DNA_TRAITS.map((trait) => (
                  <Chip
                    key={trait}
                    selected={traits.includes(trait)}
                    onClick={() => toggleTrait(trait)}
                  >
                    {trait}
                  </Chip>
                ))}
              </div>

              <div className="space-y-3">
                <Label htmlFor="notes">Anything else? (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Allergic to crowds, obsessed with sunsets, whatever's true today..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  variant="ghost"
                  className="h-12"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button className="h-12 px-6" onClick={handleSubmit}>
                  Curate my day
                </Button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hover:border-primary/50 min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        selected && "border-primary bg-primary text-primary-foreground",
      )}
    >
      {children}
    </button>
  );
}
