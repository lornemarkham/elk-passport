import "server-only";
import { deps } from "@/lib/conference/request";
import { arrivalsEnabled } from "./enabled";
import { adsb } from "./adsb-client";
import type { ArrivalsDeps } from "./service";
import { arrivalsStore } from "./store";

/** Live dependencies for routes and the page. Tests build their own. */
export const arrivalsDeps = (): ArrivalsDeps => ({
  conference: deps(),
  store: arrivalsStore(),
  adsb: adsb(),
  enabled: arrivalsEnabled(),
});
