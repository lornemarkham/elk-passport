import { afterEach, describe, expect, it, vi } from "vitest";
import { OCTOBER_PLACES } from "@/domain/environment/places";
import {
  SCENARIOS,
  SIMULATED_SOURCE,
  scenarioFrom,
  simulatedEnvironment,
} from "./scenario";

/**
 * **Simulated weather must be impossible to reach in production, and
 * impossible to mistake for real anywhere.**
 *
 * This is a safety property rather than a feature, so it is pinned rather
 * than trusted: every simulated `Environment` in the product is produced by
 * `simulatedEnvironment`, and every one of its three call sites is guarded by
 * a truthy `Scenario`, which only `scenarioFrom` can produce.
 */
const vernon = OCTOBER_PLACES.find((p) => p.id === "vernon")!;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("it cannot operate outside development", () => {
  it("refuses every scenario name in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const name of SCENARIOS) {
      expect(scenarioFrom(name), name).toBeUndefined();
    }
  });

  it("refuses them in test and in any other mode too", () => {
    for (const mode of ["test", "staging", "preview", ""]) {
      vi.stubEnv("NODE_ENV", mode);
      expect(scenarioFrom(SCENARIOS[0]), mode).toBeUndefined();
    }
  });

  it("works in development, which is the only reason it exists", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(scenarioFrom(SCENARIOS[0])?.name).toBe(SCENARIOS[0]);
  });

  it("refuses a name nobody defined, even in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(scenarioFrom("../../etc/passwd")).toBeUndefined();
    expect(scenarioFrom("kelowna-sunny-afternoon-x")).toBeUndefined();
    expect(scenarioFrom("")).toBeUndefined();
    expect(scenarioFrom(undefined)).toBeUndefined();
  });
});

describe("it cannot be mistaken for real weather", () => {
  it("labels every reading it produces, loudly", () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const name of SCENARIOS) {
      const scenario = scenarioFrom(name)!;
      const environment = simulatedEnvironment(scenario, vernon);
      expect(environment.provenance.source, name).toBe(SIMULATED_SOURCE);
      // And that string is what the surfaces render as attribution.
      expect(environment.provenance.source).toMatch(/SIMULATED/);
      expect(environment.provenance.source).not.toMatch(/Environment Canada/);
    }
  });

  it("never claims a real provider on any hour or night it invents", () => {
    vi.stubEnv("NODE_ENV", "development");
    const environment = simulatedEnvironment(
      scenarioFrom(SCENARIOS[0])!,
      vernon,
    );
    expect(environment.hourly.length).toBeGreaterThan(0);
    for (const hour of environment.hourly) {
      expect(hour.description).toBe("(simulated)");
    }
    for (const night of environment.nights) {
      expect(night.description).toBe("(simulated)");
    }
  });
});

describe("it cannot persist", () => {
  it("is derived from a name and holds nothing that could be written", () => {
    vi.stubEnv("NODE_ENV", "development");
    const scenario = scenarioFrom(SCENARIOS[0])!;
    // A scenario is a label, an area id and an instant. There is no user, no
    // profile and no identifier on it that a write path could pick up.
    expect(Object.keys(scenario).sort()).toEqual([
      "areaId",
      "label",
      "name",
      "now",
    ]);
  });
});
