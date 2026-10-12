/**
 * **Airlines, as a boarding pass names them and as a radio calls them.**
 *
 * A boarding pass says `AC 855`: the IATA designator. An aircraft's ADS-B
 * transponder broadcasts a callsign, which is usually the ICAO designator and
 * the same number, `ACA855`. Usually. The gaps are why this table exists and
 * why it is not the whole answer:
 *
 * - **Operators.** Regional flights are sold under a mainline code and flown
 *   by someone else under *their* designator: `DL 3584` can be `SKW3584`.
 *   `operators` lists who commonly does that, with the number ranges they are
 *   usually given. These are hints for where to look. A match through an
 *   operator needs an independent route record as well (see `matching.ts`).
 * - **Codeshares.** `LH 6830` may be an Air Canada aircraft calling itself
 *   `ACA-something` with a different number. Nothing public maps one to the
 *   other without a schedule provider, so a codeshare number simply never
 *   matches, and the form asks for the number of the airline that operates it.
 * - **Alphanumeric callsigns.** Some airlines fly `BAW8F` or `SKW162Z`. No
 *   flight number turns into those. They stay unmatched.
 *
 * Every ICAO designator here was written from the airlines' own published
 * codes; the set is the carriers plausible into a North American conference
 * plus the large international ones. Unknown airlines still work if somebody
 * types the ICAO form (`ACA855`).
 */

export interface Operator {
  readonly icao: string;
  readonly name: string;
  /** Inclusive flight-number range this operator usually flies. Absent: any. */
  readonly numbers?: readonly [number, number];
}

export interface Airline {
  readonly iata: string;
  readonly icao: string;
  readonly name: string;
  readonly operators?: readonly Operator[];
}

const SKYWEST = (from: number, to: number): Operator => ({
  icao: "SKW",
  name: "SkyWest",
  numbers: [from, to],
});

export const AIRLINES: readonly Airline[] = [
  // Canada
  {
    iata: "AC",
    icao: "ACA",
    name: "Air Canada",
    operators: [
      { icao: "ROU", name: "Air Canada Rouge", numbers: [1, 2999] },
      { icao: "JZA", name: "Jazz", numbers: [7000, 8999] },
    ],
  },
  {
    iata: "WS",
    icao: "WJA",
    name: "WestJet",
    operators: [{ icao: "WEN", name: "WestJet Encore", numbers: [3000, 3999] }],
  },
  { iata: "PD", icao: "POE", name: "Porter" },
  { iata: "F8", icao: "FLE", name: "Flair" },
  { iata: "TS", icao: "TSC", name: "Air Transat" },
  { iata: "WG", icao: "SWG", name: "Sunwing" },
  { iata: "8P", icao: "PCO", name: "Pacific Coastal" },
  { iata: "9M", icao: "GLR", name: "Central Mountain Air" },
  { iata: "4N", icao: "ANT", name: "Air North" },
  // United States
  {
    iata: "AS",
    icao: "ASA",
    name: "Alaska",
    operators: [
      { icao: "QXE", name: "Horizon", numbers: [2000, 2999] },
      SKYWEST(3000, 3999),
    ],
  },
  {
    iata: "UA",
    icao: "UAL",
    name: "United",
    operators: [
      SKYWEST(3000, 6999),
      { icao: "RPA", name: "Republic", numbers: [3000, 6999] },
      { icao: "ASH", name: "Mesa", numbers: [5000, 6999] },
    ],
  },
  {
    iata: "DL",
    icao: "DAL",
    name: "Delta",
    operators: [
      SKYWEST(3000, 5999),
      { icao: "EDV", name: "Endeavor", numbers: [3000, 5999] },
      { icao: "RPA", name: "Republic", numbers: [3000, 6999] },
    ],
  },
  {
    iata: "AA",
    icao: "AAL",
    name: "American",
    operators: [
      SKYWEST(2900, 6299),
      { icao: "ENY", name: "Envoy", numbers: [2900, 4999] },
      { icao: "PDT", name: "Piedmont", numbers: [4900, 6299] },
    ],
  },
  { iata: "B6", icao: "JBU", name: "JetBlue" },
  { iata: "WN", icao: "SWA", name: "Southwest" },
  { iata: "HA", icao: "HAL", name: "Hawaiian" },
  { iata: "NK", icao: "NKS", name: "Spirit" },
  { iata: "F9", icao: "FFT", name: "Frontier" },
  { iata: "G4", icao: "AAY", name: "Allegiant" },
  { iata: "SY", icao: "SCX", name: "Sun Country" },
  { iata: "MX", icao: "MXY", name: "Breeze" },
  // Mexico, Central and South America
  { iata: "AM", icao: "AMX", name: "Aeroméxico" },
  { iata: "Y4", icao: "VOI", name: "Volaris" },
  { iata: "VB", icao: "VIV", name: "Viva Aerobus" },
  { iata: "CM", icao: "CMP", name: "Copa" },
  { iata: "AV", icao: "AVA", name: "Avianca" },
  { iata: "LA", icao: "LAN", name: "LATAM" },
  // Europe
  { iata: "BA", icao: "BAW", name: "British Airways" },
  { iata: "VS", icao: "VIR", name: "Virgin Atlantic" },
  { iata: "LH", icao: "DLH", name: "Lufthansa" },
  { iata: "LX", icao: "SWR", name: "Swiss" },
  { iata: "OS", icao: "AUA", name: "Austrian" },
  { iata: "AF", icao: "AFR", name: "Air France" },
  { iata: "KL", icao: "KLM", name: "KLM" },
  { iata: "EI", icao: "EIN", name: "Aer Lingus" },
  { iata: "IB", icao: "IBE", name: "Iberia" },
  { iata: "AY", icao: "FIN", name: "Finnair" },
  { iata: "SK", icao: "SAS", name: "SAS" },
  { iata: "FI", icao: "ICE", name: "Icelandair" },
  { iata: "DE", icao: "CFG", name: "Condor" },
  { iata: "EW", icao: "EWG", name: "Eurowings" },
  { iata: "TK", icao: "THY", name: "Turkish Airlines" },
  { iata: "LO", icao: "LOT", name: "LOT" },
  { iata: "TP", icao: "TAP", name: "TAP Air Portugal" },
  { iata: "AZ", icao: "ITY", name: "ITA Airways" },
  // Middle East, Asia, Pacific
  { iata: "EK", icao: "UAE", name: "Emirates" },
  { iata: "QR", icao: "QTR", name: "Qatar Airways" },
  { iata: "EY", icao: "ETD", name: "Etihad" },
  { iata: "AI", icao: "AIC", name: "Air India" },
  { iata: "CX", icao: "CPA", name: "Cathay Pacific" },
  { iata: "BR", icao: "EVA", name: "EVA Air" },
  { iata: "CI", icao: "CAL", name: "China Airlines" },
  { iata: "JL", icao: "JAL", name: "Japan Airlines" },
  { iata: "NH", icao: "ANA", name: "ANA" },
  { iata: "KE", icao: "KAL", name: "Korean Air" },
  { iata: "OZ", icao: "AAR", name: "Asiana" },
  { iata: "CA", icao: "CCA", name: "Air China" },
  { iata: "MU", icao: "CES", name: "China Eastern" },
  { iata: "CZ", icao: "CSN", name: "China Southern" },
  { iata: "HU", icao: "CHH", name: "Hainan" },
  { iata: "MF", icao: "CXA", name: "Xiamen Air" },
  { iata: "3U", icao: "CSC", name: "Sichuan Airlines" },
  { iata: "HX", icao: "CRK", name: "Hong Kong Airlines" },
  { iata: "PR", icao: "PAL", name: "Philippine Airlines" },
  { iata: "5J", icao: "CEB", name: "Cebu Pacific" },
  { iata: "SQ", icao: "SIA", name: "Singapore Airlines" },
  { iata: "TG", icao: "THA", name: "Thai" },
  { iata: "VN", icao: "HVN", name: "Vietnam Airlines" },
  { iata: "QF", icao: "QFA", name: "Qantas" },
  { iata: "NZ", icao: "ANZ", name: "Air New Zealand" },
  { iata: "FJ", icao: "FJI", name: "Fiji Airways" },
];

export const airlineByIata = (code: string): Airline | undefined =>
  AIRLINES.find((a) => a.iata === code);

export const airlineByIcao = (code: string): Airline | undefined =>
  AIRLINES.find((a) => a.icao === code);

/** "Air Canada", "air canada", "WestJet" → the airline. Exact name only. */
export function airlineByName(typed: string): Airline | undefined {
  const plain = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  const t = plain(typed);
  return AIRLINES.find((a) => plain(a.name) === t);
}
