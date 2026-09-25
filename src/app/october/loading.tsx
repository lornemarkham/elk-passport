import { Waiting } from "@/components/october/shell/Waiting";

/**
 * Shown while any `/october` surface is being built on the server.
 *
 * One file covers the whole product shell — Home, Discover, Explore, Movie
 * Night and Your October all read Atlas and Supabase before they can render a
 * single word, and until now a person who tapped one of them sat on the *old*
 * page with nothing happening. That is the exact thing that reads as frozen.
 *
 * The nav lives in the layout and stays put, so what a person sees is the
 * shell they navigated into with a light on somewhere behind it, rather than
 * a page that has stopped answering.
 */
export default function OctoberLoading() {
  return <Waiting className="min-h-[70vh]" />;
}
