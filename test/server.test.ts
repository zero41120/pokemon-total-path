import { describe, expect, test } from "bun:test";
import { createServer } from "../src/server";

describe("server", () => {
  test("returns health response", async () => {
    const response = await createServer().fetch(new Request("http://localhost/health"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test("returns supported presets", async () => {
    const response = await createServer().fetch(new Request("http://localhost/presets"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(body.championsPresets)).toBe(true);
    expect(body.championsPresets.some((preset: { name: string }) => preset.name === "fully_physical_defensive")).toBe(true);
  });

  test("returns resolved pokemon stats", async () => {
    const response = await createServer().fetch(
      new Request("http://localhost/pokemon/stats", {
        method: "POST",
        body: JSON.stringify({
          pokemon: {
            species: "Umbreon",
            level: 50,
            championsPreset: "fully_physical_defensive",
            championsPoints: {
              spd: 2,
            },
          },
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.source).toBe("champions-points");
    expect(body.stats.hp).toBeGreaterThan(0);
    expect(body.championsPoints.spd).toBe(2);
  });

  test("floors Champions-derived Maushold stats to match in-game values", async () => {
    const response = await createServer().fetch(
      new Request("http://localhost/pokemon/stats", {
        method: "POST",
        body: JSON.stringify({
          pokemon: {
            species: "Maushold",
            level: 50,
            nature: "Adamant",
            championsPoints: {
              atk: 32,
              spe: 32,
            },
          },
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.stats.atk).toBe(139);
    expect(body.stats.spe).toBe(163);
  });

  test("validates bad calc requests", async () => {
    const response = await createServer().fetch(
      new Request("http://localhost/calc", {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
  });
});
