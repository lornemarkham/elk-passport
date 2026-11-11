import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { ThemeProvider } from "@/components/ghad/theme";
import { Reactions } from "@/components/christmas/lights/Reactions";
import {
  PinCard,
  SeasonBadge,
  photoSrc,
} from "@/components/christmas/lights/PinCard";
import {
  Checks,
  ReportAndRemove,
  TourAndShare,
} from "@/components/christmas/lights/PinActions";
import christmas from "@/components/christmas/christmas.module.css";
import styles from "@/components/christmas/lights/lights.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { metres } from "@/domain/christmas/lights/actions";
import {
  FEATURES,
  KIND_EMOJI,
  KIND_LABEL,
  TOWN_LABEL,
} from "@/domain/christmas/lights/model";
import { lightsFor, viewer } from "../../_server/lights";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { pins } = await lightsFor({ key: null, reviewer: false });
  const pin = pins.find((p) => p.id === id);
  return {
    title: pin ? `${pin.name} — Christmas Lights Map` : "Christmas Lights Map",
    ...(pin
      ? {
          description: `${KIND_LABEL[pin.kind]} in ${TOWN_LABEL[pin.town]} on the Christmas Lights Map.`,
        }
      : {}),
  };
}

/** One display: the photo, how sure we are it's lit, the reactions, and what's nearby. */
export default async function PinPage({ params }: Props) {
  const { id } = await params;
  const [session, v] = await Promise.all([adventureSession(), viewer()]);
  const { pins } = await lightsFor(v);
  const pin = pins.find((p) => p.id === id);
  if (!pin) notFound();
  const src = photoSrc(pin);
  const nearby = pins
    .filter((p) => p.id !== pin.id && p.status === "approved")
    .map((p) => ({ p, m: metres(p.at, pin.at) }))
    .filter(({ m }) => m < 5000)
    .sort((a, b) => a.m - b.m)
    .slice(0, 3);
  const features = FEATURES.filter((f) => pin.features.includes(f.id));

  return (
    <>
      <PassportNav displayName={session?.user.displayName ?? null} />
      <ThemeProvider className="block">
        <main
          className={`${christmas.page} ${styles.scope} min-h-screen pb-24`}
        >
          <div className="relative bg-[#082319]">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={`${pin.name}, photographed by a local`}
                className="mx-auto max-h-[60svh] w-full max-w-4xl object-cover"
                data-testid="pin-photo"
              />
            ) : (
              <div
                className="xm-glow flex h-56 items-center justify-center text-8xl"
                aria-hidden
              >
                {KIND_EMOJI[pin.kind]}
              </div>
            )}
            <div className={christmas.lights} aria-hidden />
          </div>
          <article className="mx-auto max-w-3xl space-y-6 px-4 pt-6 sm:px-6">
            <Link
              href="/christmas/lights"
              className="inline-flex items-center gap-1 text-sm font-bold text-[#0f3b2b] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> The lights map
            </Link>
            <header>
              <p className="text-sm font-bold tracking-[0.12em] text-[#b3242f] uppercase">
                {KIND_LABEL[pin.kind]} · {TOWN_LABEL[pin.town]}
              </p>
              <h1
                className="ghad-display mt-1 text-4xl leading-tight font-extrabold text-[#082319]"
                data-testid="pin-name"
              >
                {pin.name}
              </h1>
              <div className="mt-2">
                <SeasonBadge pin={pin} />
              </div>
            </header>
            {pin.status === "pending" && (
              <p
                className="rounded-2xl bg-[#f7e3e1] p-4 text-[#082319]"
                data-testid="pending-note"
              >
                Thanks for pinning the magic! A reviewer checks every pin before
                families see it
                {pin.residential
                  ? " — and a home needs its owner's okay, so its location stays private until then"
                  : ""}
                .
              </p>
            )}
            {pin.description && (
              <p className="text-lg text-[#26332c]">{pin.description}</p>
            )}
            <dl className="grid gap-3 sm:grid-cols-2">
              {pin.hours && (
                <div>
                  <dt className="text-xs font-bold tracking-wider text-[#5b4a2e] uppercase">
                    Best time to see it
                  </dt>
                  <dd className="font-bold">{pin.hours}</dd>
                </div>
              )}
              {pin.address && (
                <div>
                  <dt className="text-xs font-bold tracking-wider text-[#5b4a2e] uppercase">
                    Where
                  </dt>
                  <dd className="font-bold">{pin.address}</dd>
                </div>
              )}
              {features.length > 0 && (
                <div>
                  <dt className="text-xs font-bold tracking-wider text-[#5b4a2e] uppercase">
                    Good to know
                  </dt>
                  <dd>{features.map((f) => f.label).join(" · ")}</dd>
                </div>
              )}
            </dl>
            {pin.status === "approved" && (
              <section>
                <h2 className="ghad-display mb-2 text-xl font-extrabold text-[#082319]">
                  How magical is it?
                </h2>
                <Reactions pin={pin} signedIn={v.signedIn} />
              </section>
            )}
            <TourAndShare pin={pin} />
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${pin.at.lat},${pin.at.lng}`}
              className="inline-flex items-center gap-1 font-bold text-[#0f3b2b] underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Directions <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            <Checks pin={pin} signedIn={v.signedIn} />
            {pin.source && (
              <p className="text-sm text-[#3d4a43]" data-testid="pin-source">
                From{" "}
                <a
                  href={pin.source.url}
                  className="font-bold underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {new URL(pin.source.url).hostname.replace(/^www\./, "")}
                </a>
                , read {pin.source.read}: “{pin.source.says}”. Check with the
                organiser before a long drive.
              </p>
            )}
            <ReportAndRemove pin={pin} />
            {v.reviewer && (
              <Link
                href="/christmas/lights/review"
                className="block text-sm font-bold text-[#b3242f] underline"
              >
                Review queue →
              </Link>
            )}
            {nearby.length > 0 && (
              <section>
                <h2 className="ghad-display text-2xl font-extrabold text-[#082319]">
                  More magic nearby
                </h2>
                <ul className="mt-3 grid gap-4 sm:grid-cols-3">
                  {nearby.map(({ p }) => (
                    <li key={p.id}>
                      <PinCard pin={p} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        </main>
      </ThemeProvider>
    </>
  );
}
