import styles from "@/components/christmas/christmas.module.css";
import { RowSkeleton } from "@/components/christmas/ways";

/** Shown at once while the surprise is drawn from what Atlas holds near here. */
export default function Loading() {
  return (
    <main className={`${styles.page} min-h-screen`}>
      <header className={styles.night}>
        <div className="mx-auto max-w-3xl px-4 pt-14 pb-6 sm:px-6">
          <p className="ghad-display text-[2.4rem] leading-[0.95] font-extrabold sm:text-6xl">
            Surprise!
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <RowSkeleton label="Picking something for you…" cards={1} />
      </div>
    </main>
  );
}
