import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Play, type Gate } from "@/components/date-night/connect/Play";
import { cookieName } from "@/lib/date-night/connect/http";
import { isCode, openNight } from "@/lib/date-night/connect/service";
import { NotReady, nightStore } from "@/lib/date-night/connect/store";

export const dynamic = "force-dynamic";

/**
 * A night is private: it is not indexed, the address is never sent on to a
 * site the page links to, and the title says nothing about who or what.
 */
export const metadata: Metadata = {
  title: "Date Night · you're invited",
  description: "A few questions and games for two. No sign-up.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function NightPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  if (!isCode(code)) notFound();
  const justMade = (await searchParams).invite === "1";
  const jar = await cookies();
  let gate: Gate;
  try {
    gate = (await openNight(
      nightStore(),
      code,
      jar.get(cookieName(code))?.value ?? null,
    )) as Gate;
  } catch (e) {
    if (!(e instanceof NotReady)) throw e;
    gate = { status: "not-ready" };
  }
  return <Play code={code} initial={gate} justMade={justMade} />;
}
