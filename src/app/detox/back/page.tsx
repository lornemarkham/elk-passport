import type { Metadata } from "next";
import { WelcomeBack } from "@/components/detox/WelcomeBack";
import { ThemeProvider } from "@/components/ghad/theme";
import { PassportNav } from "@/components/shell/PassportNav";
import { currentUser } from "@/lib/auth/currentUser";

export const metadata: Metadata = {
  title: "Welcome back — Go offline",
};

/**
 * **`/detox/back` — how did it go?**
 *
 * The place the printed guide's closing line — *"Come back and tell us what
 * actually happened"* — can finally point. Today nothing links here from the
 * paper; that is an integration point for the print lane, named in
 * `src/lib/detox/README.md`.
 */
export default async function WelcomeBackPage() {
  const user = await currentUser();
  return (
    <ThemeProvider>
      <PassportNav displayName={user?.displayName ?? null} />
      <main className="min-h-screen bg-white">
        <WelcomeBack />
      </main>
    </ThemeProvider>
  );
}
