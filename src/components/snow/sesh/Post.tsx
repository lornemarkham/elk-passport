"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CATEGORIES,
  CATEGORY_JUDGE,
  CATEGORY_LABEL,
  DIVISIONS,
  DIVISION_LABEL,
  DIVISION_WORDS,
  SESH_MOUNTAINS,
  SPORTS,
  SPORT_LABEL,
  type AgeGroup,
  type Category,
  type Division,
  type Sport,
} from "@/domain/snow/sesh/model";
import {
  canChallenge,
  clipOf,
  featureOf,
  featureOpen,
  riderOf,
} from "@/domain/snow/sesh/rules";
import { checkCaption } from "@/domain/snow/sesh/safety";
import {
  Card,
  FeatureChip,
  Refusal,
  cx,
  mountainName,
  styles,
  useAct,
  useSesh,
  type Upload,
} from "./ctx";
import { ClipPlayer } from "./parts";

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

/** A still from the clip, for the card before anyone presses play. */
async function posterOf(file: File): Promise<Blob | undefined> {
  try {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((ok, bad) => {
      v.onloadeddata = () => ok();
      v.onerror = () => bad(new Error("no frame"));
      setTimeout(() => bad(new Error("slow")), 6000);
    });
    v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    await new Promise<void>((ok) => {
      v.onseeked = () => ok();
      setTimeout(ok, 2000);
    });
    const w = 480;
    const h = Math.round((w * (v.videoHeight || 270)) / (v.videoWidth || 480));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")?.drawImage(v, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return await new Promise((ok) =>
      c.toBlob((b) => ok(b ?? undefined), "image/jpeg", 0.72),
    );
  } catch {
    return undefined;
  }
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={cx(styles.card, "mt-4 p-4")}>
      <legend className={cx(styles.display, "px-1 text-xl uppercase")}>
        <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sw-char)] text-base text-[var(--sw-cream)]">
          {n}
        </span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Pills<T extends string>({
  value,
  options,
  label,
  onChange,
  disabled,
}: {
  value: T | "";
  options: readonly T[];
  label: (t: T) => string;
  onChange: (t: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          disabled={disabled}
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={cx(styles.btn, "min-h-11 px-4 text-sm")}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}

export function PostScreen({
  feature: presetFeature,
  answerTo,
}: {
  feature?: string;
  answerTo?: string;
}) {
  const { world, viewer, base, now, mode, signIn } = useSesh();
  const router = useRouter();
  const { run, busy, reason, setReason } = useAct();
  const me = riderOf(world, viewer.riderId);
  const defender = answerTo ? clipOf(world, answerTo) : undefined;
  const preset = defender
    ? featureOf(world, defender.featureId)
    : presetFeature
      ? featureOf(world, presetFeature)
      : undefined;

  const [mountain, setMountain] = useState<string>(
    preset?.mountainId ?? me?.homeMountain ?? "silverstar",
  );
  const [featureId, setFeatureId] = useState<string>(preset?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sport, setSport] = useState<Sport | "">(me?.sport ?? "");
  const [division, setDivision] = useState<Division | "">(
    defender?.division ?? me?.division ?? "",
  );
  const [category, setCategory] = useState<Category | "">(
    defender?.category ?? "",
  );
  const [caption, setCaption] = useState("");
  const [rights, setRights] = useState(false);
  const [openTerrain, setOpenTerrain] = useState(false);
  const [guardian, setGuardian] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  useEffect(
    () => () => void (preview && URL.revokeObjectURL(preview)),
    [preview],
  );

  if (!viewer.signedIn)
    return (
      <Card className="mt-6">
        <h1 className={cx(styles.display, "text-3xl uppercase")}>
          Post a clip
        </h1>
        <p className="mt-2">
          Sign in to post — your clips, wins and patches stay yours.
        </p>
        <a
          href={signIn}
          className={cx(
            styles.go,
            "mt-3 inline-flex min-h-12 items-center rounded-full px-6",
          )}
        >
          Sign in
        </a>
      </Card>
    );
  if (!me)
    return (
      <MeScreen
        next={
          answerTo
            ? `answer/${answerTo}`
            : featureId
              ? `post/${featureId}`
              : "post"
        }
      />
    );
  if (defender) {
    const can = canChallenge(world, viewer, defender, now);
    if (!can.ok)
      return (
        <Card className="mt-6">
          <p className="font-semibold">{can.reason}</p>
          <Link
            className="mt-2 inline-block underline"
            href={`${base}/c/${defender.id}`}
          >
            Back to the clip
          </Link>
        </Card>
      );
  }

  const features = world.features.filter((f) => f.mountainId === mountain);
  const f = featureOf(world, featureId);
  const cap = checkCaption(caption);
  const ready =
    !!f &&
    featureOpen(f, now).ok &&
    (mode === "demo" || !!file) &&
    sport &&
    division &&
    category &&
    cap.ok &&
    rights &&
    openTerrain;

  async function pick(next: File | null) {
    setReason(null);
    if (!next) return;
    if (
      !VIDEO_TYPES.includes(next.type) &&
      !/\.(mp4|mov|webm)$/i.test(next.name)
    ) {
      setReason("That's not a video we can play. MP4, MOV or WebM.");
      return;
    }
    if (next.size > MAX_VIDEO_BYTES) {
      setReason(
        `That clip is ${Math.round(next.size / 1048576)} MB — trim it under 50 MB (about 30 seconds on most phones).`,
      );
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  async function publish() {
    if (!ready || !f || !sport || !division || !category) return;
    let upload: Upload | undefined;
    if (mode === "real" && file) {
      setStage("Grabbing a still for the card…");
      upload = { video: file, poster: await posterOf(file) };
      setStage("Uploading — big clips take a minute on mountain wifi…");
    }
    const r = await run(
      {
        type: "post",
        featureId: f.id,
        sport,
        division,
        category,
        caption,
        media:
          mode === "demo"
            ? file && preview
              ? { kind: "local", url: preview }
              : {
                  kind: "illustration",
                  seed:
                    caption.length * 7919 +
                    f.id.length * 104729 +
                    division.length,
                }
            : { kind: "video", url: "pending" },
        rights,
        openTerrain,
        byGuardian: guardian,
        answerTo: defender?.id,
      },
      upload,
    );
    setStage(null);
    if (r.ok && r.created)
      router.push(`${base}/${defender ? "x" : "c"}/${r.created}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className={cx(styles.display, "mt-4 text-5xl uppercase")}>
        {defender ? "⚔️ Answer the challenge" : "🎥 Post your session"}
      </h1>
      {defender && (
        <Card className="mt-3">
          <p className="text-sm">
            You&apos;re answering{" "}
            <b>{riderOf(world, defender.riderId)?.name}</b> on{" "}
            <b>{preset?.name}</b> — same feature, same{" "}
            {DIVISION_LABEL[defender.division]} division, judged on{" "}
            <b>{CATEGORY_LABEL[defender.category]}</b>. 24 hours of voting
            starts when you post.
          </p>
          <div className="mt-2 max-w-sm">
            <ClipPlayer clip={defender} compact />
          </div>
        </Card>
      )}

      <Step n={1} title="Mountain">
        <Pills
          value={mountain}
          options={SESH_MOUNTAINS}
          label={mountainName}
          disabled={!!defender}
          onChange={(m) => (setMountain(m), setFeatureId(""))}
        />
      </Step>

      <Step n={2} title="Feature">
        {features.length === 0 ? (
          <p className="text-sm">
            No features listed at {mountainName(mountain)} yet.
          </p>
        ) : (
          <div className="grid gap-2">
            {features.map((x) => {
              const open = featureOpen(x, now);
              return (
                <button
                  key={x.id}
                  type="button"
                  disabled={!!defender || !open.ok}
                  aria-pressed={featureId === x.id}
                  onClick={() => setFeatureId(x.id)}
                  className={cx(
                    styles.btn,
                    "flex min-h-12 items-center justify-between gap-2 rounded-xl px-4 py-2 text-left text-sm",
                  )}
                >
                  <span>
                    {x.name}{" "}
                    {!open.ok && (
                      <span className="text-xs font-normal">
                        — {open.reason}
                      </span>
                    )}
                  </span>
                  <FeatureChip f={x} />
                </button>
              );
            })}
          </div>
        )}
      </Step>

      <Step n={3} title="Video">
        <label className="block">
          <span className="text-sm">
            {mode === "demo"
              ? "Pick a clip from your phone — in the demo it never leaves your phone. Or skip it and we'll draw one."
              : "From your camera roll or straight from the camera. Under 50 MB."}
          </span>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/*"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm"
          />
        </label>
        {preview && (
          <video
            src={preview}
            controls
            playsInline
            preload="metadata"
            className="mt-3 aspect-video w-full rounded-lg bg-black"
          />
        )}
      </Step>

      <Step n={4} title="Ski or snowboard">
        <Pills
          value={sport}
          options={SPORTS}
          label={(s) => SPORT_LABEL[s]}
          onChange={setSport}
        />
      </Step>

      <Step n={5} title="Division">
        <Pills
          value={division}
          options={DIVISIONS}
          label={(d) => DIVISION_LABEL[d]}
          onChange={setDivision}
          disabled={!!defender}
        />
        {division && (
          <p className="mt-2 text-xs">
            {DIVISION_WORDS[division]}. Ride your level — it&apos;s where you
            win.
          </p>
        )}
      </Step>

      <Step n={6} title="Competition">
        <Pills
          value={category}
          options={CATEGORIES}
          label={(c) => CATEGORY_LABEL[c]}
          onChange={setCategory}
          disabled={!!defender}
        />
        {category && <p className="mt-2 text-xs">{CATEGORY_JUDGE[category]}</p>}
      </Step>

      <Step n={7} title="Caption">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={140}
          placeholder="What did you land?"
          className={styles.input}
        />
        {!cap.ok && <Refusal reason={cap.reason} />}
      </Step>

      <Step n={8} title="Publish">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={rights}
            onChange={(e) => setRights(e.target.checked)}
            className="mt-1 h-5 w-5"
          />
          <span>
            I filmed this, or the person who did said I can share it — and
            everyone recognisable in it is okay with that.
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={openTerrain}
            onChange={(e) => setOpenTerrain(e.target.checked)}
            className="mt-1 h-5 w-5"
          />
          <span>
            It was on an open, resort-built feature, and nobody got hurt.
          </span>
        </label>
        {me.ageGroup === "adult" && (
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={guardian}
              onChange={(e) => setGuardian(e.target.checked)}
              className="mt-1 h-5 w-5"
            />
            <span>
              I&apos;m a parent or guardian posting for a rider under 13 (their
              name stays off it).
            </span>
          </label>
        )}
        <button
          type="button"
          disabled={!ready || busy}
          onClick={publish}
          className={cx(
            defender ? styles.war : styles.go,
            "mt-4 min-h-14 w-full rounded-full px-6 text-lg",
          )}
        >
          {busy
            ? (stage ?? "Posting…")
            : defender
              ? "⚔️ Throw down"
              : "Publish"}
        </button>
        {!ready && (
          <p className="mt-2 text-xs">Fill in every step to publish.</p>
        )}
        <Refusal reason={reason} />
      </Step>
    </div>
  );
}

/** Your rider profile — ten seconds, then you can post, vote and chirp. */
export function MeScreen({ next }: { next?: string }) {
  const { world, viewer, base, signIn } = useSesh();
  const router = useRouter();
  const { run, busy, reason } = useAct();
  const me = riderOf(world, viewer.riderId);
  const [name, setName] = useState(me?.name ?? "");
  const [home, setHome] = useState<string>(me?.homeMountain ?? "silverstar");
  const [sport, setSport] = useState<Sport>(me?.sport ?? "snowboard");
  const [division, setDivision] = useState<Division | "">(me?.division ?? "");
  const [age, setAge] = useState<AgeGroup | "under13" | "">(me?.ageGroup ?? "");
  if (!viewer.signedIn)
    return (
      <Card className="mt-6">
        <p>Sign in first — then your rider profile takes ten seconds.</p>
        <a
          href={signIn}
          className={cx(
            styles.go,
            "mt-3 inline-flex min-h-12 items-center rounded-full px-6",
          )}
        >
          Sign in
        </a>
      </Card>
    );
  return (
    <div className="mx-auto max-w-xl">
      <h1 className={cx(styles.display, "mt-4 text-5xl uppercase")}>
        {me ? "Your dossier" : "Join the squadron"}
      </h1>
      <p className="text-sm">
        A nickname, where you ride and what you ride. No real names needed, no
        location, ever.
      </p>
      <form
        className={cx(styles.card, "mt-4 space-y-4 p-4")}
        onSubmit={async (e) => {
          e.preventDefault();
          if (age !== "adult" && age !== "youth") return;
          const r = await run({
            type: "profile",
            name,
            homeMountain: home,
            sport,
            division: division || undefined,
            ageGroup: me?.ageGroup ?? age,
          });
          if (r.ok)
            router.push(
              `${base}/${next ?? `r/${viewer.riderId ?? r.created ?? ""}`}`,
            );
        }}
      >
        <label className="block">
          <span className="text-sm font-bold">Rider name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            required
            className={styles.input}
            placeholder="e.g. Powder Pilot"
          />
        </label>
        <div>
          <p className="text-sm font-bold">Home mountain</p>
          <Pills
            value={home}
            options={SESH_MOUNTAINS}
            label={mountainName}
            onChange={setHome}
          />
        </div>
        <div>
          <p className="text-sm font-bold">You ride</p>
          <Pills
            value={sport}
            options={SPORTS}
            label={(s) => SPORT_LABEL[s]}
            onChange={setSport}
          />
        </div>
        <div>
          <p className="text-sm font-bold">Division (optional)</p>
          <Pills
            value={division}
            options={DIVISIONS}
            label={(d) => DIVISION_LABEL[d]}
            onChange={setDivision}
          />
        </div>
        {!me && (
          <div>
            <p className="text-sm font-bold">How old are you?</p>
            <Pills
              value={age}
              options={["adult", "youth", "under13"] as const}
              label={(a) =>
                a === "adult"
                  ? "18 or older"
                  : a === "youth"
                    ? "13 to 17"
                    : "Under 13"
              }
              onChange={setAge}
            />
            {age === "youth" && (
              <p className="mt-2 text-xs">
                You&apos;ll compete with riders 13–17, and people who
                aren&apos;t signed in won&apos;t see your profile or clips.
              </p>
            )}
            {age === "under13" && (
              <p className="mt-2 text-sm font-semibold">
                Riders under 13 don&apos;t get their own profile. Ask a parent
                or guardian — they can post your clips from theirs.
              </p>
            )}
            <p className="mt-2 text-xs">
              This is set once and can&apos;t be changed later.
            </p>
          </div>
        )}
        <button
          type="submit"
          disabled={
            busy || !name.trim() || (!me && age !== "adult" && age !== "youth")
          }
          className={cx(styles.go, "min-h-12 w-full rounded-full px-6")}
        >
          {me ? "Save" : "Join Sesh Wars"}
        </button>
        <Refusal reason={reason} />
      </form>
    </div>
  );
}
