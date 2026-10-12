import "server-only";
import { conferenceSetup } from "@/lib/conference/config";
import { ARRIVALS_STORE_DURABLE } from "./store";

/**
 * **Whether Arrivals may run at all in this process.**
 *
 * Arrivals keeps each member's flight. A flight kept in per-instance memory
 * would vanish on a cold start, differ between serverless instances and, on
 * the durable conference store, outlive nothing it should: the conference
 * would be shared and the flights would not. That is worse than an Arrivals
 * that is plainly not open, so:
 *
 * - while the arrivals store is not durable (`ARRIVALS_STORE_DURABLE`), it
 *   runs only in development, against the in-memory conference store, where
 *   both halves live and die together;
 * - once it has a durable store it follows the conference store.
 *
 * It is a property of the code, not an environment switch, so a deployment
 * cannot turn it on by accident.
 */
export function arrivalsEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
  isDev = process.env.NODE_ENV !== "production",
): boolean {
  const setup = conferenceSetup(env, isDev);
  if (!setup.open) return false;
  if (ARRIVALS_STORE_DURABLE) return true;
  return isDev && setup.config.store === "memory";
}
