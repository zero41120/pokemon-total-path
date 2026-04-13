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
});
