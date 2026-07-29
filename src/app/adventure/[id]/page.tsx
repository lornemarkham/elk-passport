"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Camera, Check, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/adventure/logo";
import { cn } from "@/lib/utils";
import { resizeImageFile } from "@/lib/image";
import {
  useAddMoment,
  useAdvanceAdventure,
  useAdventure,
  useCompleteAdventure,
} from "@/lib/data/hooks";

export default function AdventureModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: adventure, isLoading } = useAdventure(id);
  const advance = useAdvanceAdventure(id);
  const complete = useCompleteAdventure(id);
  const addMoment = useAddMoment(id);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [note, setNote] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const submitGuard = useRef(false);

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

  const currentAdventure = adventure;
  const { blocks } = currentAdventure.recommendation;
  const current = blocks[currentAdventure.currentBlockIndex];
  const next = blocks[currentAdventure.currentBlockIndex + 1];
  const isLast = currentAdventure.currentBlockIndex >= blocks.length - 1;

  // Guards against a double-submit without toggling the `disabled` attribute
  // synchronously on click — doing that raced the button's own unmount when
  // this action navigates away, right as the click was still being dispatched.
  async function completeStep() {
    if (submitGuard.current) return;
    submitGuard.current = true;
    try {
      if (isLast) {
        await complete.mutateAsync();
        router.push(`/summary/${id}`);
      } else {
        await advance.mutateAsync(currentAdventure.currentBlockIndex + 1);
      }
    } finally {
      submitGuard.current = false;
    }
  }

  async function saveMoment() {
    await addMoment.mutateAsync({ note: note || undefined, photoDataUrl });
    setNote("");
    setPhotoDataUrl(undefined);
    setCaptureOpen(false);
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 pb-10 sm:px-8">
      <header className="flex items-center justify-between py-4">
        <Logo />
        <Dialog open={planOpen} onOpenChange={setPlanOpen}>
          <DialogTrigger render={<Button variant="ghost" size="sm" />}>
            <ListChecks className="size-4" />
            Full plan
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{currentAdventure.recommendation.title}</DialogTitle>
            </DialogHeader>
            <ul className="space-y-1">
              {blocks.map((block, i) => (
                <li key={i}>
                  <button
                    onClick={async () => {
                      await advance.mutateAsync(i);
                      setPlanOpen(false);
                    }}
                    className={cn(
                      "hover:bg-secondary flex w-full items-center gap-3 rounded-md px-3 py-2 text-left",
                      i === currentAdventure.currentBlockIndex &&
                        "bg-secondary",
                    )}
                  >
                    <span className="text-muted-foreground w-16 shrink-0 text-xs font-semibold uppercase">
                      {block.time}
                    </span>
                    <span className="font-medium">{block.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex gap-1.5 py-2">
        {blocks.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= currentAdventure.currentBlockIndex
                ? "bg-primary"
                : "bg-muted",
            )}
          />
        ))}
      </div>

      <main className="flex flex-1 flex-col justify-center py-10">
        <motion.div
          key={currentAdventure.currentBlockIndex}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-3"
        >
          <span className="text-accent text-sm font-semibold tracking-wide uppercase">
            Right now · {current.time}
          </span>
          <h1
            data-testid="adventure-current-title"
            className="font-heading text-3xl leading-tight font-semibold text-balance sm:text-4xl"
          >
            {current.title}
          </h1>
          <p className="text-muted-foreground text-lg text-pretty">
            {current.description}
          </p>
        </motion.div>

        {next && (
          <div className="mt-8 border-t pt-6">
            <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Up next
            </span>
            <p className="font-medium">{next.title}</p>
          </div>
        )}
      </main>

      <div className="grid grid-cols-2 gap-3 pb-4">
        <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
          <DialogTrigger
            render={<Button variant="outline" size="lg" className="h-14" />}
          >
            <Camera className="size-4" />
            Capture
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Capture this moment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <label className="border-input hover:bg-secondary flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
                {photoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoDataUrl}
                    alt="Captured moment"
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <>
                    <Camera className="text-muted-foreground size-6" />
                    <span className="text-muted-foreground text-sm">
                      Add a photo
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) setPhotoDataUrl(await resizeImageFile(file));
                  }}
                />
              </label>
              <Textarea
                placeholder="What just happened? (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                className="h-12"
                onClick={saveMoment}
                disabled={addMoment.isPending}
              >
                Save moment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          size="lg"
          className="h-14"
          onClick={completeStep}
          data-testid="adventure-action-button"
          data-last={isLast}
        >
          <Check className="size-4" />
          {isLast ? "Finish adventure" : "Next step"}
        </Button>
      </div>
    </div>
  );
}
