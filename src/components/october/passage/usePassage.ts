"use client";

import { useSyncExternalStore } from "react";
import {
  getPassage,
  getServerPassage,
  subscribePassage,
  type Passage,
} from "@/domain/october/passage";

/**
 * What this person carries between October's places. Empty on the server and
 * on the first client render, so nothing paints a memory the markup did not.
 */
export function usePassage(): Passage {
  return useSyncExternalStore(subscribePassage, getPassage, getServerPassage);
}
