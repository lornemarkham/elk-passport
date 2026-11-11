import { randomInt } from "node:crypto";
import type { Metadata } from "next";
import { PassportNav } from "@/components/shell/PassportNav";
import { ThemeProvider } from "@/components/ghad/theme";
import { Bingo } from "@/components/christmas/lights/Bingo";
import christmas from "@/components/christmas/christmas.module.css";
import styles from "@/components/christmas/lights/lights.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { seedFrom } from "@/domain/christmas/lights/bingo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Christmas Lights Bingo — Go Have a Christmas",
  description:
    "A car game for your lights tour: spot a giant Santa, five reindeer, a Christmas train…",
};

export default async function BingoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const session = await adventureSession();
  return (
    <>
      <PassportNav displayName={session?.user.displayName ?? null} />
      <ThemeProvider className="block">
        <main
          className={`${christmas.page} ${styles.scope} min-h-screen bg-[#082319] pb-24 print:bg-white`}
        >
          <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
            <Bingo
              seed={
                seedFrom(
                  typeof params.card === "string" ? params.card : undefined,
                ) || randomInt(1, 2_000_000_000)
              }
            />
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}
