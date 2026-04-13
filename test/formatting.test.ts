import { describe, expect, test } from "bun:test";
import { runCalc } from "../src/lib/calc";
import { formatScenario } from "../src/lib/format";
import { sampleScenario } from "../src/scenarios/sample-scenarios";

describe("scenario formatting", () => {
  test("renders the required headings", async () => {
    const result = await runCalc(sampleScenario.calc);
    const formatted = formatScenario(sampleScenario, result);

    expect(formatted).toContain("Scenario: Pelipper into no-speed Garchomp");
    expect(formatted).toContain("Turn 1");
    expect(formatted).toContain("End state estimate");
    expect(formatted).toContain("Field state");
  });
});
