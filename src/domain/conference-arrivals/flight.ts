/**
 * **What somebody typed, turned into what an aircraft might be calling itself.**
 *
 * A flight number is not an aircraft identifier. This file does the first two
 * steps of matching one to the other: read the typed number, then list the
 * callsigns the aircraft operating it could plausibly broadcast. It never
 * decides that an aircraft *is* the flight; `matching.ts` does that, on
 * evidence.
 */
import {
  airlineByIata,
  airlineByIcao,
  airlineByName,
  type Airline,
} from "./airlines";

export interface FlightIdent {
  /** How we show it back: `AC855`, or `ACA855` when only ICAO was typed. */
  readonly display: string;
  /** Two-character designator, when typed or known. */
  readonly iata: string | null;
  /** Three-letter designator, when typed or known. */
  readonly icao: string | null;
  /** Digits without leading zeros: boarding passes print them, radios don't. */
  readonly number: string;
  /** An operational suffix letter (`AC855A`). Rare. */
  readonly suffix: string;
  /** The airline's name when this table knows it. */
  readonly airlineName: string | null;
}

/**
 * Accepts `AC855`, `ac 0855`, `ACA855`, `Air Canada 855`. `null` when it does
 * not look like a flight number, so the form can say so.
 */
export function readFlight(typed: string): FlightIdent | null {
  const raw = typed.trim();
  // "Air Canada 855": a name we know, then the number.
  const named = /^(.*?[A-Za-z].*?)\s*(\d{1,4})\s*([A-Za-z]?)$/u.exec(raw);
  if (named && named[1]!.trim().length > 3) {
    const airline = airlineByName(named[1]!);
    return airline ? identFor(airline, named[2]!, named[3]!) : null;
  }
  const compact = raw.toUpperCase().replace(/[\s-]+/g, "");
  const icao = /^([A-Z]{3})(\d{1,4})([A-Z]?)$/.exec(compact);
  if (icao) {
    const [, code, digits, suffix] = icao;
    const airline = airlineByIcao(code!);
    if (airline) return identFor(airline, digits!, suffix!, "icao");
    const number = String(Number(digits));
    if (number === "0") return null;
    return {
      display: `${code}${number}${suffix}`,
      iata: null,
      icao: code!,
      number,
      suffix: suffix!,
      airlineName: null,
    };
  }
  const iata = /^([A-Z0-9]{2})(\d{1,4})([A-Z]?)$/.exec(compact);
  if (!iata) return null;
  const [, code, digits, suffix] = iata;
  // A two-character designator may contain one digit, not two.
  if (/^\d\d$/.test(code!)) return null;
  const airline = airlineByIata(code!);
  if (airline) return identFor(airline, digits!, suffix!);
  const number = String(Number(digits));
  if (number === "0") return null;
  return {
    display: `${code}${number}${suffix}`,
    iata: code!,
    icao: null,
    number,
    suffix: suffix!,
    airlineName: null,
  };
}

function identFor(
  airline: Airline,
  digits: string,
  suffix: string,
  typedAs: "iata" | "icao" = "iata",
): FlightIdent | null {
  const number = String(Number(digits));
  if (number === "0") return null;
  const s = suffix.toUpperCase();
  return {
    display: `${typedAs === "icao" ? airline.icao : airline.iata}${number}${s}`,
    iata: airline.iata,
    icao: airline.icao,
    number,
    suffix: s,
    airlineName: airline.name,
  };
}

export interface CallsignCandidate {
  readonly callsign: string;
  /**
   * `direct`: the airline's own designator and number. `operator`: a
   * regional that usually flies this airline's numbers under its own
   * designator, which needs more evidence before it counts.
   */
  readonly kind: "direct" | "operator";
  /** Who would be flying it under this callsign. */
  readonly operator: string;
}

/** At most this many callsigns are searched per flight. Each one is a call. */
export const MAX_CANDIDATES = 4;

/** The callsigns worth looking for, most likely first. */
export function candidatesFor(ident: FlightIdent): CallsignCandidate[] {
  if (!ident.icao) return [];
  const airline = airlineByIcao(ident.icao);
  const out: CallsignCandidate[] = [
    {
      callsign: `${ident.icao}${ident.number}${ident.suffix}`,
      kind: "direct",
      operator: airline?.name ?? ident.icao,
    },
  ];
  const n = Number(ident.number);
  for (const op of airline?.operators ?? []) {
    if (op.numbers && (n < op.numbers[0] || n > op.numbers[1])) continue;
    out.push({
      callsign: `${op.icao}${ident.number}${ident.suffix}`,
      kind: "operator",
      operator: op.name,
    });
  }
  return out.slice(0, MAX_CANDIDATES);
}

/** `YYYY-MM-DD`, and a real calendar date. */
export function readFlightDate(typed: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(typed)) return null;
  const d = new Date(`${typed}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== typed
    ? null
    : typed;
}
