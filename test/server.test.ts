import { describe, expect, test } from "bun:test";
import { createServer } from "../src/server";

describe("server", () => {
  test("returns resolved pokemon stats by species name", async () => {
    const response = await createServer().fetch(
      new Request("http://localhost/pokemon/stats/Maushold"),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.stats.hp).toBeGreaterThan(0);
  });

  test("returns 404 for unknown species", async () => {
    const response = await createServer().fetch(
      new Request("http://localhost/pokemon/stats/NotAPokemon"),
    );
    expect(response.status).toBe(404);
  });

  test("validates bad calc requests", async () => {
    const response = await createServer().fetch(
      new Request("http://localhost/calc", {
        method: "POST",
        body: JSON.stringify({ calcs: "not an array" }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
  });

  test("returns champions points guidance in validation details", async () => {
    const response = await createServer().fetch(
      new Request("http://localhost/calc", {
        method: "POST",
        body: JSON.stringify({
          calcs: [
            {
              attacker: {
                species: "Garchomp",
                championsPoints: {
                  atk: 252,
                },
              },
              defender: {
                species: "Umbreon",
                championsPoints: {
                  hp: 32,
                },
              },
              move: "Earthquake",
            },
          ],
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Expected integer 0-32 for attacker.championsPoints.atk");
    expect(body.details.hint).toBe("Pokemon Champions uses Champions Points instead of EVs.");
    expect(body.details.championsPointsRules.totalPool).toBe(66);
    expect(body.details.championsPointsRules.statCap).toBe(32);
    expect(body.details.championsPointsRules.ratio).toBe("1 Champions Point = +1 final level 50 stat");
  });

  test("schedules self update", async () => {
    const response = await createServer(undefined, {
      scheduleUpdate: () => ({
        pid: 4321,
        command: "git pull",
      }),
    }).fetch(
      new Request("http://localhost/gitpull", {
        method: "GET",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.ok).toBe(true);
    expect(body.pid).toBe(4321);
  });
});
