import { describe, expect, test } from "bun:test";
import { runCalc } from "../src/lib/calc";

const PELIPPER = {
  species: "Pelipper",
  level: 50,
  item: "Focus Sash",
  ability: "Drizzle",
  exactStats:{ hp: 135, atk: 70, def: 127, spa: 147, spd: 81, spe: 123 },
};

describe("calc service", () => {
  test("runs a benchmark calc and preserves exact stats", async () => {
    const result = await runCalc({
      attacker: PELIPPER,
      defender: {
        species: "Garchomp",
        level: 50,
        exactStats:{ hp: 183, atk: 150, def: 115, spa: 90, spd: 105, spe: 122 },
      },
      move: "Ice Beam",
      field: { weather: "rain" },
    });

    expect(result.attacker.stats).toEndWith("/123");
    expect(result.damage.min).toBeGreaterThan(0);
  });

  test("derives final stats from Champions points", async () => {
    const result = await runCalc({
      attacker: {
        species: "Umbreon",
        level: 50,
        championsPoints: { hp: 32, def: 32, spd: 2 },
        nature: "Bold",
      },
      defender: PELIPPER,
      move: "Foul Play",
    });

    expect(result.attacker.nature).toBe(undefined); // nature encoded in stats string
    expect(result.attacker.stats).toContain("+"); // Bold: def+
    expect(result.attacker.stats).toContain("-"); // Bold: atk-
  });

  test("engine description reflects resolved stats instead of EV-style placeholders", async () => {
    const result = await runCalc({
      attacker: {
        species: "Tyranitar",
        level: 50,
        exactStats:{ hp: 175, atk: 204, def: 150, spa: 115, spd: 150, spe: 91 },
      },
      defender: {
        species: "Sinistcha",
        level: 50,
        championsPoints: { hp: 32, def: 32 },
        nature: "Bold",
      },
      move: "Knock Off",
    });

    expect(result.description).toContain("204 Atk Tyranitar");
    expect(result.description).toContain("178 HP / 173 Def Sinistcha");
  });

  test("higher exact attack stat produces higher damage output", async () => {
    const defender = {
      species: "Sinistcha",
      level: 50,
      championsPoints: { hp: 32, def: 32 },
      nature: "Bold",
    };

    const lowerAttack = await runCalc({
      attacker: {
        species: "Tyranitar",
        level: 50,
        exactStats:{ hp: 175, atk: 187, def: 140, spa: 103, spd: 150, spe: 91 },
      },
      defender,
      move: "Knock Off",
    });

    const higherAttack = await runCalc({
      attacker: {
        species: "Tyranitar",
        level: 50,
        exactStats:{ hp: 175, atk: 204, def: 140, spa: 103, spd: 150, spe: 91 },
      },
      defender,
      move: "Knock Off",
    });

    expect(higherAttack.damage.max).toBeGreaterThan(lowerAttack.damage.max);
  });
});
