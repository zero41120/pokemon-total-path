import { afterEach, describe, expect, test } from "bun:test";
import { REST_ENDPOINTS, startMcpServer } from "../src/mcp";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("mcp wrapper", () => {
  test("exposes REST endpoints from TypeScript definitions", () => {
    expect(Array.isArray(REST_ENDPOINTS)).toBe(true);
    expect(REST_ENDPOINTS.length).toBeGreaterThan(0);
  });

  test("calc endpoint is registered with correct metadata", () => {
    const calc = REST_ENDPOINTS.find((e) => e.toolName === "calc");
    expect(calc).toBeDefined();
    expect(calc!.method).toBe("POST");
    expect(calc!.path).toBe("/calc");
    expect(calc!.inputSchema).toBeDefined();
  });

  test("acknowledges notifications/initialized", async () => {
    const server = startMcpServer({ port: 3101, host: "127.0.0.1" });

    try {
      const response = await fetch("http://127.0.0.1:3101/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }),
      });

      expect(response.status).toBe(202);
      expect(await response.text()).toBe("");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
  });
});
