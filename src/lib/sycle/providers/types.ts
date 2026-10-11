import type { FlightRecord } from "@/domain/sycle/flight";

/**
 * The seam between the board and whoever knows about aeroplanes.
 *
 * One method, because the board only ever asks one question: *what flights
 * carry this number on this date?* A number can legitimately return several
 * (multi-sector flights, a codeshare and its operator), which is why the
 * person confirms which one is theirs rather than the code guessing.
 */
export interface FlightProvider {
  readonly name: FlightRecord["source"];
  lookup(flightNumber: string, date: string): Promise<FlightRecord[]>;
}
