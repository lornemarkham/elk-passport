import { kmLine, type PrintableAdventure } from "@/lib/analog/printable";
import type { PrintLeg, RouteSketch, RouteSummary } from "@/lib/analog/route";
import type { WeatherPrep } from "@/lib/analog/weather";
import { BASIS_LABEL } from "@/lib/analog/printable";
import { Box, H2, H3, Rule, TimeBlank, listOf } from "./paper";

/**
 * **The field-guide sections of the printed adventure**: the route, the
 * weather, and a card to cut out and carry.
 *
 * Each one prints only what something said: Atlas's coordinates and rain
 * readings, a routing provider's minutes, a named forecast. Where nobody
 * said, the section leaves a blank for the person to fill in, which is
 * honest, and turns out to be the part people like writing on.
 */

// ---------------------------------------------------------------------------
// The route
// ---------------------------------------------------------------------------

export function RouteSection({ route }: { readonly route: RouteSummary }) {
  return (
    <section
      aria-labelledby="route-heading"
      data-testid="adventure-route"
      className="mt-10 border-t-2 border-[#111] pt-5"
    >
      <h2 id="route-heading" className={H2}>
        The route
      </h2>

      {route.sketch ? (
        <figure className="section mt-3">
          <Sketch sketch={route.sketch} />
          <figcaption className="mt-2 text-[13px] leading-relaxed text-[#444]">
            A sketch, not a map. North is up. Straight lines between the places
            Atlas has located; the roads will be longer.
            {route.unplaced.length > 0 &&
              ` Not on the sketch, because no location is published: ${listOf(route.unplaced)}.`}
          </figcaption>
        </figure>
      ) : (
        <p
          data-testid="adventure-no-sketch"
          className="mt-2 text-[14px] leading-relaxed text-[#444]"
        >
          No sketch: Atlas has located fewer than two of these places, so there
          is nothing honest to draw. The directions under each stop say what to
          search a map for.
        </p>
      )}

      <div className="section mt-5 flex flex-wrap gap-x-8 gap-y-3 text-[14px]">
        <span className="inline-flex items-end gap-2">
          <span className="font-semibold">Leave at</span>
          <TimeBlank label="Leave at" />
        </span>
        <span className="inline-flex items-end gap-2">
          <span className="font-semibold">Home by</span>
          <TimeBlank label="Home by" />
        </span>
      </div>

      {route.legs.length > 0 && (
        <table
          data-testid="adventure-legs"
          className="mt-4 w-full border-collapse text-left text-[14px] leading-snug"
        >
          <caption className="sr-only">
            Getting between stops, with room to write when you left and arrived
          </caption>
          <thead>
            <tr className="border-b-2 border-[#111]">
              <th scope="col" className="py-1.5 pr-2 font-semibold">
                Getting there
              </th>
              <th scope="col" className="py-1.5 pr-2 font-semibold">
                How far
              </th>
              <th scope="col" className="w-[4.5rem] py-1.5 pr-2 font-semibold">
                Left
              </th>
              <th scope="col" className="w-[4.5rem] py-1.5 font-semibold">
                Got there
              </th>
            </tr>
          </thead>
          <tbody>
            {route.legs.map((leg) => (
              <tr
                key={leg.id}
                data-testid="adventure-leg"
                className="section border-b border-[#bbb] align-bottom"
              >
                <td className="py-1.5 pr-2">
                  {leg.from} →{" "}
                  {leg.toNumber !== undefined && `${leg.toNumber}. `}
                  {leg.to}
                  {leg.home && " (home)"}
                </td>
                <td className="py-1.5 pr-2 text-[#222]">
                  <LegDistance leg={leg} />
                </td>
                <td className="py-1.5 pr-2">
                  <TimeBlank label="Left" />
                </td>
                <td className="py-1.5">
                  <TimeBlank label="Got there" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-[13px] leading-relaxed text-[#444]">
        {route.attribution.length > 0
          ? "A time is a routing provider's estimate. A straight line is not a road and has no time."
          : "Straight lines, not roads. Passport has no road routing here, so it gives no drive times. Write the real ones in."}
      </p>
      {route.attribution.map((line) => (
        <p
          key={line}
          data-testid="adventure-attribution"
          className="mt-1 text-[12px] text-[#444]"
        >
          {line}
        </p>
      ))}
    </section>
  );
}

function LegDistance({ leg }: { readonly leg: PrintLeg }) {
  if (leg.routed) {
    return (
      <>
        {leg.routed.minutes} min {leg.routed.mode}, {kmLine(leg.routed.roadKm)}{" "}
        by road
      </>
    );
  }
  if (leg.km !== undefined) return <>{kmLine(leg.km)}, straight line</>;
  return <span className="text-[#444]">Not measured</span>;
}

function Sketch({ sketch }: { readonly sketch: RouteSketch }) {
  const { width, height, points, scale } = sketch;
  const path = [...points, ...(sketch.loops ? [points[0]!] : [])]
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`)
    .join(" ");
  const named = points
    .map((p) =>
      p.number !== undefined ? `${p.number}, ${p.label}` : `start, ${p.label}`,
    )
    .join("; ");
  return (
    <svg
      data-testid="adventure-sketch"
      role="img"
      aria-label={`Route sketch, north up: ${named}.`}
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full border border-[#111]"
    >
      <path
        d={path}
        fill="none"
        stroke="#111"
        strokeWidth={1.5}
        strokeDasharray="6 5"
      />
      {points.map((p) => {
        const right = p.x > width * 0.62;
        const label = (
          <text
            x={right ? p.x - 14 : p.x + 14}
            y={p.y + 4}
            textAnchor={right ? "end" : "start"}
            fontSize={12}
            fontWeight={p.number === undefined ? 700 : 600}
            fill="#111"
          >
            {p.number === undefined ? `Start: ${p.label}` : p.label}
          </text>
        );
        return p.number === undefined ? (
          <g key={`start-${p.label}`}>
            <rect x={p.x - 6} y={p.y - 6} width={12} height={12} fill="#111" />
            {label}
          </g>
        ) : (
          <g key={`${p.number}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={10}
              fill="#fff"
              stroke="#111"
              strokeWidth={2}
            />
            <text
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={800}
              fill="#111"
            >
              {p.number}
            </text>
            {label}
          </g>
        );
      })}
      {/* North arrow */}
      <g transform={`translate(${width - 22} 14)`}>
        <path d="M0 18 L6 0 L12 18 L6 13 Z" fill="#111" />
        <text
          x={6}
          y={32}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill="#111"
        >
          N
        </text>
      </g>
      {/* Scale */}
      <g transform={`translate(14 ${height - 14})`}>
        <path
          d={`M0 -5 L0 0 L${scale.px} 0 L${scale.px} -5`}
          fill="none"
          stroke="#111"
          strokeWidth={1.5}
        />
        <text x={scale.px + 6} y={0} fontSize={11} fill="#111">
          {scale.km} km
        </text>
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

export function WeatherSection({ weather }: { readonly weather: WeatherPrep }) {
  const { forecast } = weather;
  return (
    <section
      aria-labelledby="weather-heading"
      data-testid="adventure-weather"
      className="mt-10 border-t-2 border-[#111] pt-5"
    >
      <h2 id="weather-heading" className={H2}>
        Weather
      </h2>

      {forecast ? (
        <p
          data-testid="adventure-forecast"
          className="section mt-3 border border-[#111] px-3 py-2 text-[15px] leading-relaxed"
        >
          <span className="font-semibold">
            {forecast.source}
            {forecast.area && `, for ${forecast.area}`}
            {forecast.km !== undefined &&
              ` (${kmLine(forecast.km)} from where you start)`}
            :{" "}
          </span>
          {forecast.description ??
            (forecast.wet ? "Rain expected" : "No rain expected")}
          {forecast.chance !== undefined &&
            `, ${forecast.chance}% chance at worst`}
          .{" "}
          {forecast.wet
            ? "Pack for wet."
            : "Nothing falling expected when this was printed."}
        </p>
      ) : (
        <div
          data-testid="adventure-forecast-blank"
          className="section mt-3 border border-[#111] px-3 py-3 text-[14px]"
        >
          <p className="font-semibold">
            The forecast{weather.dateLine && ` for ${weather.dateLine}`}, the
            night before
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
            <span className="inline-flex items-end gap-2">
              High{" "}
              <span
                aria-hidden
                className="inline-block h-6 w-12 border-b border-[#777]"
              />
            </span>
            <span className="inline-flex items-end gap-2">
              Low{" "}
              <span
                aria-hidden
                className="inline-block h-6 w-12 border-b border-[#777]"
              />
            </span>
            {["Sun", "Cloud", "Rain", "Snow", "Wind"].map((sky) => (
              <span key={sky} className="inline-flex items-center gap-1.5">
                <Box />
                {sky}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="section mt-4 text-[14px] leading-relaxed">
        <h3 className={H3}>If it rains</h3>
        <ul data-testid="adventure-rain" className="mt-1.5 flex flex-col gap-1">
          {weather.covered.length > 0 && (
            <li>
              <span className="font-semibold">Somewhere to shelter: </span>
              {listOf(weather.covered)}.
            </li>
          )}
          {weather.exposed.length > 0 && (
            <li>
              <span className="font-semibold">Out in the open: </span>
              {listOf(weather.exposed)}.
            </li>
          )}
          {weather.mayNotRun.length > 0 && (
            <li>
              <span className="font-semibold">
                May not run in bad weather, call first:{" "}
              </span>
              {listOf(weather.mayNotRun)}.
            </li>
          )}
          {weather.unknown.length > 0 && (
            <li className="text-[#444]">
              <span className="font-semibold text-[#111]">
                No word on rain:{" "}
              </span>
              {listOf(weather.unknown)}.
            </li>
          )}
        </ul>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-3 print:grid-cols-3">
        {(
          [
            ["If it's wet", weather.ifWet],
            ["If it's cold", weather.ifCold],
            ["If it's hot", weather.ifHot],
          ] as const
        ).map(([heading, items]) => (
          <div key={heading} className="section">
            <h3 className={H3}>{heading}</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {items.map((item) => (
                <li
                  key={item}
                  data-basis="suggested"
                  className="flex items-start gap-2.5 text-[14px] leading-snug"
                >
                  <Box />
                  <span>
                    {item}
                    <span className="sr-only"> ({BASIS_LABEL.suggested})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The pocket card
// ---------------------------------------------------------------------------

/**
 * **The part that goes in a pocket.** Everything needed on the move, small,
 * at the end of the guide so cutting it out takes nothing else with it.
 */
export function PocketCard({
  adventure,
}: {
  readonly adventure: PrintableAdventure;
}) {
  return (
    <section
      aria-labelledby="pocket-heading"
      data-testid="adventure-pocket"
      className="section"
    >
      <p aria-hidden className="text-[12px] text-[#444]">
        ✂ Cut along the dashed line and keep it in a pocket
      </p>
      <div className="mt-1.5 border-2 border-dashed border-[#111] px-4 py-3">
        <h2
          id="pocket-heading"
          className="ghad-display text-[16px] leading-tight font-extrabold"
        >
          {adventure.title}
          {adventure.dateLine && (
            <span className="block text-[12px] font-semibold text-[#444]">
              {adventure.dateLine}
            </span>
          )}
        </h2>
        <ol className="mt-2 flex flex-col gap-1.5 text-[13px] leading-snug">
          {adventure.stops.map((stop) => (
            <li key={stop.id} className="flex gap-2">
              <span className="w-4 shrink-0 font-extrabold tabular-nums">
                {stop.number}
              </span>
              <span>
                <span className="font-semibold">{stop.title}</span>
                {stop.findBy ? ` · ${stop.findBy}` : " · ask locally"}
                {stop.hours && ` · ${stop.hours}`}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-3 grid grid-cols-[auto_1fr] items-end gap-x-3 gap-y-1 text-[13px]">
          <span className="font-semibold">Where we parked</span>
          <Rule />
          <span className="font-semibold">Emergency contact</span>
          <Rule />
        </div>
      </div>
    </section>
  );
}
