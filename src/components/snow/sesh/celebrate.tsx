"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Earned } from "@/domain/snow/sesh/patches";
import { Patch } from "./art";
import styles from "./sesh.module.css";

/**
 * **"Patch earned!"** — held by the Sesh Wars layout, so it survives the
 * page change that usually follows the action that earned it.
 */
const Ctx = createContext<(e: Earned[]) => void>(() => undefined);
export const useCelebrate = () => useContext(Ctx);

export function CelebrationHost({ children }: { children: ReactNode }) {
  const [earned, setEarned] = useState<Earned[]>([]);
  const celebrate = useCallback((e: Earned[]) => {
    if (e.length) setEarned(e);
  }, []);
  const close = () => setEarned([]);
  return (
    <Ctx.Provider value={celebrate}>
      {children}
      {earned.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Patch earned"
          className={`${styles.vars} fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6`}
          onClick={close}
        >
          <div
            className={`${styles.toast} max-w-sm p-6 text-center`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className={`${styles.display} text-3xl uppercase`}>
              Patch earned!
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              {earned.map((e) => (
                <div key={e.patch.id} className={styles.pop}>
                  <Patch patch={e.patch} size={earned.length > 2 ? 90 : 120} />
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm">
              {earned.map((e) => e.patch.how).join(" ")}
            </p>
            <button
              type="button"
              onClick={close}
              className={`${styles.go} mt-4 min-h-12 rounded-full px-6`}
            >
              Stitch it on
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
