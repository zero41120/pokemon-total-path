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
