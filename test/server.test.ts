import { describe, expect, test } from "bun:test";
import { createServer } from "../src/server";

describe("server", () => {
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
