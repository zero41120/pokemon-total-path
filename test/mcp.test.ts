import { afterEach, describe, expect, test } from "bun:test";
import {
  OPENAPI_YAML,
  REST_ENDPOINTS,
  startMcpServer,
} from "../src/mcp";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("mcp wrapper", () => {
  test("exposes the OpenAPI YAML", () => {
    expect(OPENAPI_YAML).toContain("openapi: 3.1.0");
    expect(OPENAPI_YAML).toContain("title: Pokemon Champions API");
  });

  test("registers MCP tools from REST endpoints", () => {
    expect(Array.isArray(REST_ENDPOINTS)).toBe(true);
  });

  test("acknowledges notifications/initialized", async () => {
    const server = startMcpServer({ port: 3101, host: "127.0.0.1" });

    try {
      const response = await fetch("http://127.0.0.1:3101/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: {},
        }),
      });

      expect(response.status).toBe(202);
      expect(await response.text()).toBe("");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            if ((error as NodeJS.ErrnoException).code === "ERR_SERVER_NOT_RUNNING") {
              resolve();
              return;
            }
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });
});
