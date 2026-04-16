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
    expect(body.baseStats).toBeDefined();
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
        body: JSON.stringify("not an array"),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
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
