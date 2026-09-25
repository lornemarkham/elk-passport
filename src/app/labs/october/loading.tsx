import { Waiting } from "@/components/october/shell/Waiting";

/**
 * Shown while one of the October rooms is being fetched.
 *
 * These routes carry real weight — the Video Store pulls a plate and twelve
 * sleeves, Witching Hour a pile of client code — and the wait between tapping
 * a door and the room existing was previously blank.
 *
 * Full-bleed black rather than the product shell: you have already left the
 * building by the time this appears, and a nav bar flashing up between the
 * sketchbook and the room would break the one thing these pages are for.
 */
export default function OctoberLabsLoading() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-[#08070a]">
      <Waiting />
    </main>
  );
}
