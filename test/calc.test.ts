import { describe, expect, test } from "bun:test";
import { runCalc } from "../src/lib/calc";
import { CalcRequestSchema } from "../src/lib/schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const garchomp = {
  name: "Garchomp",
  params: {
    ability: "Rough Skin",
    item: "Life Orb",
    nature: "Jolly",
    evs: { atk: 32, spe: 20, hp: 14 },
  }
};

const amoonguss = {
  name: "Amoonguss",
  params: {
    ability: "Regenerator",
    item: "Rocky Helmet",
    nature: "Sassy",
    evs: { hp: 32, spd: 32, def: 2 },
  }
};

const DOUBLES = "Doubles" as const;

/**
 * Legacy test cases used a flat structure. This helper wraps them into the new { name, params } structure
 * so we don't have to rewrite every single test line manually.
 */
function wrapPoke(poke: any) {
  const { name, ...params } = poke;
  return { name, params: Object.keys(params).length > 0 ? params : undefined };
}

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
      attacker: { params: { nature: "Jolly" } },
      defender: { name: "Snorlax" },
      move: { name: "Tackle" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects boosts out of range", () => {
    const result = CalcRequestSchema.safeParse({
      format: "Singles",
      attacker: { name: "Garchomp", params: { boosts: { atk: 7 } } },
      defender: { name: "Amoonguss" },
      move: { name: "Earthquake" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid status", () => {
    const result = CalcRequestSchema.safeParse({
      format: "Singles",
      attacker: { name: "Garchomp", params: { status: "confused" } },
      defender: { name: "Amoonguss" },
      move: { name: "Earthquake" },
    });
    expect(result.success).toBe(false);
  });

  test("accepts all valid status values", () => {
    for (const status of ["", "brn", "par", "psn", "tox", "slp", "frz"]) {
      const result = CalcRequestSchema.safeParse({
        format: "Singles",
        attacker: { name: "Garchomp", params: { status } },
        defender: { name: "Amoonguss" },
        move: { name: "Earthquake" },
      });
      expect(result.success).toBe(true);
    }
  });

  test("accepts forceStatsValue as null", () => {
    const result = CalcRequestSchema.safeParse({
      format: "Singles",
      attacker: { name: "Shuckle", params: { forceStatsValue: null } },
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
      attacker: { name: garchomp.name, params: { ...garchomp.params, evs: { atk: 32 } } },
      defender: amoonguss,
      move: { name: "Earthquake" },
      format: DOUBLES,
    });
    expect(result.description).toContain("256 Atk");
  });

  test("evs > 32 are treated as standard EVs", () => {
    const result = runCalc({
      attacker: { name: garchomp.name, params: { ...garchomp.params, evs: { atk: 252 } } },
      defender: amoonguss,
      move: { name: "Earthquake" },
      format: DOUBLES,
    });
    expect(result.description).toContain("252 Atk");
  });

  test("Champion points appear in stats parenthetical (≤ 32)", () => {
    const result = runCalc({
      attacker: { name: garchomp.name, params: { ...garchomp.params, evs: { atk: 32, spe: 20, hp: 14 } } },
      defender: amoonguss,
      move: { name: "Earthquake" },
      format: DOUBLES,
    });
    expect(result.attackerStats).toMatch(/\(14\/32\//);
  });

  test("standard EVs are converted to champion points for display (÷8)", () => {
    const result = runCalc({
      attacker: { name: "Miraidon", params: { ability: "Hadron Engine", item: "Choice Specs", nature: "Timid", evs: { spa: 252, spe: 252, hp: 4 } } },
      defender: { name: "Calyrex-Shadow", params: { ability: "As One (Spectrier)", nature: "Timid", evs: { spa: 252, spe: 252, hp: 4 } } },
      move: { name: "Electro Drift" },
      format: DOUBLES, field: { terrain: "Electric" },
    });
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
    const crit = runCalc({ attacker: garchomp, defender: amoonguss, move: { name: "Earthquake", params: { isCrit: true } }, format: DOUBLES });
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
    const boosted = runCalc({ 
      attacker: { ...garchomp, params: { ...garchomp.params, boosts: { atk: 2 } } }, 
      defender: amoonguss, 
      move: { name: "Earthquake" }, 
      format: DOUBLES 
    });
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
    const result = runCalc({
      attacker: { name: "Miraidon", params: { ability: "Hadron Engine", item: "Choice Specs", nature: "Timid", evs: { spa: 32, spe: 32, hp: 1 } } },
      defender: { name: "Calyrex-Shadow", params: { ability: "As One (Spectrier)", nature: "Timid", evs: { spa: 32, spe: 32, hp: 1 } } },
      move: { name: "Electro Drift" },
      format: DOUBLES, field: { terrain: "Electric" },
    });
    expect(result.ko.chance).toBe(1);
    expect(result.ko.n).toBe(1);
  });

  test("non-damaging move returns zero damage range", () => {
    const result = runCalc({
      attacker: { name: "Amoonguss", params: { ability: "Regenerator" } },
      defender: { name: "Garchomp", params: { ability: "Rough Skin" } },
      move: { name: "Spore" },
      format: DOUBLES,
    });
    expect(result.range[0]).toBe(0);
    expect(result.range[1]).toBe(0);
    expect(result.ko.chance === undefined || result.ko.chance === 0).toBe(true);
  });

  test("nature markers appear in stats string", () => {
    const result = runCalc({
      attacker: { name: "Garchomp", params: { nature: "Jolly", evs: { atk: 32 } } },
      defender: amoonguss,
      move: { name: "Earthquake" },
      format: DOUBLES,
    });
    expect(result.attackerStats).toContain("+");
    expect(result.attackerStats).toContain("-");
  });

  test("defaults to gen 9 when gen is omitted", () => {
    const result = runCalc({
      attacker: { name: "Flutter Mane", params: { ability: "Protosynthesis", nature: "Timid" } },
      defender: { name: "Incineroar", params: { ability: "Intimidate" } },
      move: { name: "Moonblast" },
      format: DOUBLES,
    });
    expect(result.description).toBeTypeOf("string");
    expect(result.description.length).toBeGreaterThan(0);
  });

  test("corrects optimistic KO claims for multi-hit moves (Maushold vs Aerodactyl case)", () => {
    // 0 HP / 0 Def Aerodactyl has 155 HP.
    // If damage range is 120-150, it should NOT be a KO.
    // Using forceStatsValue to ensure a specific outcome if needed, 
    // but first let's see if we can reproduce it with specific investment.
    const result = runCalc({
      format: DOUBLES,
      attacker: { 
        name: "Maushold", 
        params: { 
          ability: "Technician", 
          evs: { atk: 32 }, // approx 252 EVs in standard
          nature: "Jolly"
        } 
      },
      defender: { 
        name: "Aerodactyl", 
        params: {
          evs: { hp: 0, def: 0 }
        }
      },
      move: { 
        name: "Population Bomb", 
        params: { hits: 10 } 
      }
    });

    const [min, max] = result.range;
    const defHp = 155; // Lvl 50, 0 EV, 31 IV Aerodactyl

    if (max < defHp) {
      expect(result.ko.text).toBe("not a KO");
      expect(result.description).not.toContain("guaranteed OHKO");
    }
  });
});

// ---------------------------------------------------------------------------
// forceStatsValue
// ---------------------------------------------------------------------------

describe("forceStatsValue", () => {
  test("forced stat appears with ! in attackerStats", () => {
    const result = runCalc({
      attacker: { name: "Shuckle", params: { ability: "Contrary", nature: "Brave", evs: { def: 32 }, forceStatsValue: { atk: 230 } } },
      defender: { name: "Garchomp", params: { ability: "Rough Skin" } },
      move: { name: "Rock Smash" },
      format: DOUBLES,
    });
    expect(result.attackerStats).toContain("!");
  });

  test("forced atk value is used in damage calculation", () => {
    const normal = runCalc({
      attacker: { name: "Shuckle", params: { ability: "Contrary", nature: "Brave" } },
      defender: { name: "Garchomp", params: { ability: "Rough Skin" } },
      move: { name: "Rock Smash" },
      format: DOUBLES,
    });
    const forced = runCalc({
      attacker: { name: "Shuckle", params: { ability: "Contrary", nature: "Brave", forceStatsValue: { atk: 230 } } },
      defender: { name: "Garchomp", params: { ability: "Rough Skin" } },
      move: { name: "Rock Smash" },
      format: DOUBLES,
    });
    expect(forced.range[0]).toBeGreaterThan(normal.range[0]);
  });

  test("null forceStatsValue is a no-op", () => {
    const base = runCalc({ attacker: garchomp, defender: amoonguss, move: { name: "Earthquake" }, format: DOUBLES });
    const nullForce = runCalc({ attacker: { ...garchomp, params: { ...garchomp.params, forceStatsValue: null } }, defender: amoonguss, move: { name: "Earthquake" }, format: DOUBLES });
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
