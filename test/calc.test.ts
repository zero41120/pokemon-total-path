import { describe, expect, test } from "bun:test";
import { runCalc } from "../src/lib/calc";

describe("calc service", () => {
  test("runs a benchmark calc and preserves exact stats", async () => {
    const result = await runCalc({
      attacker: { teamSlot: "Pelipper" },
      defender: {
        species: "Garchomp",
        level: 50,
        stats: {
          hp: 183,
          atk: 150,
          def: 115,
          spa: 90,
          spd: 105,
          spe: 122,
        },
      },
      move: "Ice Beam",
      field: {
        weather: "rain",
      },
    });

    expect(result.attacker.stats.spe).toBe(123);
    expect(result.speed.attackerMovesFirst).toBe(true);
    expect(result.damage.min).toBeGreaterThan(0);
    expect(result.notes.some((note) => note.includes("Exact final stats"))).toBe(true);
  });

  test("derives final stats from Champions points", async () => {
    const result = await runCalc({
      attacker: {
        species: "Umbreon",
        level: 50,
        championsPreset: "fully_physical_defensive",
        championsPoints: {
          spd: 2,
        },
      },
      defender: {
        teamSlot: "Pelipper",
      },
      move: "Foul Play",
    });

    expect(result.attacker.source).toBe("champions-points");
    expect(result.attacker.championsPoints).toEqual({
      hp: 32,
      def: 32,
      spd: 2,
    });
    expect(result.attacker.nature).toBe("Bold");
    expect(result.attacker.stats.hp).toBeGreaterThan(0);
    expect(result.notes.some((note) => note.includes("Champions points"))).toBe(true);
  });

  test("forces sun when Mega Sol is active", async () => {
    const result = await runCalc({
      attacker: {
        teamSlot: "Meganium-Mega",
      },
      defender: {
        species: "Pelipper",
        level: 50,
        ability: "Drizzle",
        stats: {
          hp: 135,
          atk: 70,
          def: 127,
          spa: 147,
          spd: 81,
          spe: 123,
        },
      },
      move: "Weather Ball",
      field: {
        weather: "rain",
      },
    });

    expect(result.attacker.ability).toBe("Mega Sol");
    expect(result.endState.weather).toBe("sun");
    expect(result.notes.some((note) => note.includes("forced to Sun"))).toBe(true);
  });

  test("engine description reflects resolved stats instead of EV-style placeholders", async () => {
    const result = await runCalc({
      attacker: {
        species: "Tyranitar",
        level: 50,
        stats: {
          hp: 175,
          atk: 204,
          def: 150,
          spa: 115,
          spd: 150,
          spe: 91,
        },
      },
      defender: {
        species: "Sinistcha",
        level: 50,
        championsPreset: "fully_physical_defensive",
      },
      move: "Knock Off",
    });

    expect(result.engine.description).toContain("204 Atk Tyranitar");
    expect(result.engine.description).toContain("178 HP / 173 Def Sinistcha");
    expect(result.engine.libraryDescription).toContain("0 Atk Tyranitar");
  });

  test("higher exact attack stat produces higher damage output", async () => {
    const baseDefender = {
      species: "Sinistcha",
      level: 50,
      championsPreset: "fully_physical_defensive" as const,
    };

    const lowerAttack = await runCalc({
      attacker: {
        species: "Tyranitar",
        level: 50,
        stats: {
          hp: 175,
          atk: 187,
          def: 140,
          spa: 103,
          spd: 150,
          spe: 91,
        },
      },
      defender: baseDefender,
      move: "Knock Off",
    });

    const higherAttack = await runCalc({
      attacker: {
        species: "Tyranitar",
        level: 50,
        stats: {
          hp: 175,
          atk: 204,
          def: 140,
          spa: 103,
          spd: 150,
          spe: 91,
        },
      },
      defender: baseDefender,
      move: "Knock Off",
    });

    expect(higherAttack.damage.max).toBeGreaterThan(lowerAttack.damage.max);
    const lowerAverage = lowerAttack.engine.damage.reduce((sum, value) => sum + value, 0) / lowerAttack.engine.damage.length;
    const higherAverage = higherAttack.engine.damage.reduce((sum, value) => sum + value, 0) / higherAttack.engine.damage.length;
    expect(higherAverage).toBeGreaterThan(lowerAverage);
  });
});
