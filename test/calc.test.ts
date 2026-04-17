import { describe, expect, test } from "bun:test";
import { runCalc } from "../src/lib/calc";
import { CalcRequestSchema } from "../src/lib/schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const garchomp = {
  name: "Garchomp",
  ability: "Rough Skin",
  item: "Life Orb",
  nature: "Jolly",
  evs: { atk: 32, spe: 20, hp: 14 },
} as const;

const amoonguss = {
  name: "Amoonguss",
  ability: "Regenerator",
  item: "Rocky Helmet",
  nature: "Sassy",
  evs: { hp: 32, spd: 32, def: 2 },
} as const;

const DOUBLES = "Doubles" as const;

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe("CalcRequestSchema", () => {
  test("accepts minimal valid input", () => {
    const result = CalcRequestSchema.safeParse({
      format: "Singles",
      attacker: { name: "Pikachu" },
      defender: { name: "Snorlax" },
      move: { name: "Thunderbolt" },
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing format", () => {
    const result = CalcRequestSchema.safeParse({
      attacker: { name: "Pikachu" },
      defender: { name: "Snorlax" },
      move: { name: "Thunderbolt" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing attacker name", () => {
    const result = CalcRequestSchema.safeParse({
      format: "Singles",
      attacker: { nature: "Jolly" },
      defender: { name: "Snorlax" },
      move: { name: "Tackle" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects boosts out of range", () => {
    const result = CalcRequestSchema.safeParse({
      format: "Singles",
      attacker: { name: "Garchomp", boosts: { atk: 7 } },
      defender: { name: "Amoonguss" },
      move: { name: "Earthquake" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid gender", () => {
    const result = CalcRequestSchema.safeParse({
      format: "Singles",
      attacker: { name: "Garchomp", gender: "X" },
      defender: { name: "Amoonguss" },
      move: { name: "Earthquake" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid status", () => {
    const result = CalcRequestSchema.safeParse({
      format: "Singles",
      attacker: { name: "Garchomp", status: "confused" },
      defender: { name: "Amoonguss" },
      move: { name: "Earthquake" },
    });
    expect(result.success).toBe(false);
  });

  test("accepts all valid status values", () => {
    for (const status of ["", "brn", "par", "psn", "tox", "slp", "frz"]) {
      const result = CalcRequestSchema.safeParse({
        format: "Singles",
        attacker: { name: "Garchomp", status },
        defender: { name: "Amoonguss" },
        move: { name: "Earthquake" },
      });
      expect(result.success).toBe(true);
    }
  });

  test("accepts forceStatsValue as null", () => {
    const result = CalcRequestSchema.safeParse({
      format: "Singles",
      attacker: { name: "Shuckle", forceStatsValue: null },
      defender: { name: "Garchomp" },
      move: { name: "Tackle" },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Champions mode EV detection
// ---------------------------------------------------------------------------

describe("Champions mode EV conversion", () => {
  test("evs ≤ 32 are treated as Champion stat points", () => {
    const result = runCalc({
      attacker: { ...garchomp, evs: { atk: 32 } },
      defender: amoonguss,
      move: { name: "Earthquake" },
      format: DOUBLES,
    });
    // 32 champ pts = 256 EVs → appears as "256 Atk" in description
    expect(result.description).toContain("256 Atk");
  });

  test("evs > 32 are treated as standard EVs", () => {
    const result = runCalc({
      attacker: { ...garchomp, evs: { atk: 252 } },
      defender: amoonguss,
      move: { name: "Earthquake" },
      format: DOUBLES,
    });
    expect(result.description).toContain("252 Atk");
  });

  test("Champion points appear in stats parenthetical (≤ 32)", () => {
    const result = runCalc({
      attacker: { ...garchomp, evs: { atk: 32, spe: 20, hp: 14 } },
      defender: amoonguss,
      move: { name: "Earthquake" },
      format: DOUBLES,
    });
    // attackerStats format: "HP/Atk/Def/SpA/SpD/Spe (cp/cp/cp/cp/cp/cp)"
    expect(result.attackerStats).toMatch(/\(14\/32\//);
  });

  test("standard EVs are converted to champion points for display (÷8)", () => {
    const result = runCalc({
      attacker: { name: "Miraidon", ability: "Hadron Engine", item: "Choice Specs", nature: "Timid", evs: { spa: 252, spe: 252, hp: 4 } },
      defender: { name: "Calyrex-Shadow", ability: "As One (Spectrier)", nature: "Timid", evs: { spa: 252, spe: 252, hp: 4 } },
      move: { name: "Electro Drift" },
      format: DOUBLES, field: { terrain: "Electric" },
    });
    // Timid nature boosts Spe (last stat) → "32+" at end of parenthetical; 252 EVs → 32 champ pts
    expect(result.attackerStats).toContain("32+)");
  });
});

// ---------------------------------------------------------------------------
// Core damage calculation
// ---------------------------------------------------------------------------

describe("runCalc", () => {
  test("returns required fields", () => {
    const result = runCalc({
      attacker: garchomp,
      defender: amoonguss,
      move: { name: "Earthquake" },
      format: DOUBLES,
    });
    expect(result.description).toBeTypeOf("string");
    expect(result.attackerStats).toBeTypeOf("string");
    expect(result.defenderStats).toBeTypeOf("string");
    expect(result.range).toHaveLength(2);
    expect(result.percent).toHaveLength(2);
    expect(result.ko).toHaveProperty("text");
  });

  test("range min ≤ max", () => {
    const result = runCalc({
      attacker: garchomp,
      defender: amoonguss,
      move: { name: "Earthquake" },
      format: DOUBLES,
    });
    expect(result.range[0]).toBeLessThanOrEqual(result.range[1]);
    expect(result.percent[0]).toBeLessThanOrEqual(result.percent[1]);
  });

  test("crit increases damage range minimum", () => {
    const base = runCalc({ attacker: garchomp, defender: amoonguss, move: { name: "Earthquake" }, format: DOUBLES });
    const crit = runCalc({ attacker: garchomp, defender: amoonguss, move: { name: "Earthquake", isCrit: true }, format: DOUBLES });
    expect(crit.range[0]).toBeGreaterThan(base.range[0]);
  });

  test("Helping Hand increases damage", () => {
    const base = runCalc({ attacker: garchomp, defender: amoonguss, move: { name: "Earthquake" }, format: DOUBLES });
    const hh = runCalc({
      attacker: garchomp,
      defender: amoonguss,
      move: { name: "Earthquake" },
      format: DOUBLES, field: { attackerSide: { isHelpingHand: true } },
    });
    expect(hh.range[0]).toBeGreaterThan(base.range[0]);
  });

  test("positive attack boost increases damage", () => {
    const base = runCalc({ attacker: garchomp, defender: amoonguss, move: { name: "Earthquake" }, format: DOUBLES });
    const boosted = runCalc({ attacker: { ...garchomp, boosts: { atk: 2 } }, defender: amoonguss, move: { name: "Earthquake" }, format: DOUBLES });
    expect(boosted.range[0]).toBeGreaterThan(base.range[0]);
  });

  test("Reflect halves physical damage in Doubles", () => {
    const base = runCalc({ attacker: garchomp, defender: amoonguss, move: { name: "Earthquake" }, format: DOUBLES });
    const reflect = runCalc({
      attacker: garchomp,
      defender: amoonguss,
      move: { name: "Earthquake" },
      format: DOUBLES, field: { defenderSide: { isReflect: true } },
    });
    expect(reflect.range[1]).toBeLessThan(base.range[0]);
  });

  test("guaranteed OHKO registers ko chance of 1", () => {
    // Miraidon Choice Specs Electro Drift in Electric Terrain vs uninvested Calyrex-Shadow
    const result = runCalc({
      attacker: { name: "Miraidon", ability: "Hadron Engine", item: "Choice Specs", nature: "Timid", evs: { spa: 32, spe: 32, hp: 1 } },
      defender: { name: "Calyrex-Shadow", ability: "As One (Spectrier)", nature: "Timid", evs: { spa: 32, spe: 32, hp: 1 } },
      move: { name: "Electro Drift" },
      format: DOUBLES, field: { terrain: "Electric" },
    });
    expect(result.ko.chance).toBe(1);
    expect(result.ko.n).toBe(1);
  });

  test("non-damaging move returns zero damage range", () => {
    const result = runCalc({
      attacker: { name: "Amoonguss", ability: "Regenerator" },
      defender: { name: "Garchomp", ability: "Rough Skin" },
      move: { name: "Spore" },
      format: DOUBLES,
    });
    expect(result.range[0]).toBe(0);
    expect(result.range[1]).toBe(0);
    // kochance throws for non-damaging moves; we return a safe default
    expect(result.ko.chance).toBeUndefined();
    expect(result.ko.n).toBe(0);
  });

  test("nature markers appear in stats string", () => {
    const result = runCalc({
      attacker: { name: "Garchomp", nature: "Jolly", evs: { atk: 32 } },
      defender: amoonguss,
      move: { name: "Earthquake" },
      format: DOUBLES,
    });
    // Jolly: +Spe, -SpA — both should appear in attackerStats
    expect(result.attackerStats).toContain("+");
    expect(result.attackerStats).toContain("-");
  });

  test("defaults to gen 9 when gen is omitted", () => {
    const result = runCalc({
      attacker: { name: "Flutter Mane", ability: "Protosynthesis", nature: "Timid" },
      defender: { name: "Incineroar", ability: "Intimidate" },
      move: { name: "Moonblast" },
      format: DOUBLES,
    });
    expect(result.description).toBeTypeOf("string");
    expect(result.description.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// forceStatsValue
// ---------------------------------------------------------------------------

describe("forceStatsValue", () => {
  test("forced stat appears with ! in attackerStats", () => {
    const result = runCalc({
      attacker: { name: "Shuckle", ability: "Contrary", nature: "Brave", evs: { def: 32 }, forceStatsValue: { atk: 230 } },
      defender: { name: "Garchomp", ability: "Rough Skin" },
      move: { name: "Rock Smash" },
      format: DOUBLES,
    });
    expect(result.attackerStats).toContain("!");
  });

  test("forced atk value is used in damage calculation", () => {
    const normal = runCalc({
      attacker: { name: "Shuckle", ability: "Contrary", nature: "Brave" },
      defender: { name: "Garchomp", ability: "Rough Skin" },
      move: { name: "Rock Smash" },
      format: DOUBLES,
    });
    const forced = runCalc({
      attacker: { name: "Shuckle", ability: "Contrary", nature: "Brave", forceStatsValue: { atk: 230 } },
      defender: { name: "Garchomp", ability: "Rough Skin" },
      move: { name: "Rock Smash" },
      format: DOUBLES,
    });
    expect(forced.range[0]).toBeGreaterThan(normal.range[0]);
  });

  test("null forceStatsValue is a no-op", () => {
    const base = runCalc({ attacker: garchomp, defender: amoonguss, move: { name: "Earthquake" }, format: DOUBLES });
    const nullForce = runCalc({ attacker: { ...garchomp, forceStatsValue: null }, defender: amoonguss, move: { name: "Earthquake" }, format: DOUBLES });
    expect(nullForce.range).toEqual(base.range);
  });
});

// ---------------------------------------------------------------------------
// Invalid inputs
// ---------------------------------------------------------------------------

describe("error handling", () => {
  test("throws if format is missing", () => {
    expect(() =>
      runCalc({
        attacker: { name: "Garchomp" },
        defender: { name: "Amoonguss" },
        move: { name: "Earthquake" },
      } as any)
    ).toThrow("format (Singles/Doubles) is required");
  });

  test("throws on unknown Pokemon name", () => {
    expect(() =>
      runCalc({
        attacker: { name: "NotAPokemon" },
        defender: amoonguss,
        move: { name: "Earthquake" },
        format: DOUBLES,
      })
    ).toThrow();
  });

  test("unknown move name returns zero damage (smogon/calc treats it as a 0-BP move)", () => {
    const result = runCalc({
      attacker: garchomp,
      defender: amoonguss,
      move: { name: "SuperFakeMove" },
      format: DOUBLES,
    });
    expect(result.range[0]).toBe(0);
    expect(result.range[1]).toBe(0);
  });
});
