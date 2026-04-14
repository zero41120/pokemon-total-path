import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  BOOTSTRAP_TOOL_NAME,
  OPENAPI_RESOURCE_URI,
  OPENAPI_YAML,
  REST_ENDPOINTS,
  createBootstrapToolResult,
  proxyRestEndpoint,
  startMcpServer,
} from "../src/mcp";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("mcp wrapper", () => {
  test("registers one MCP tool per REST endpoint", () => {
    expect(REST_ENDPOINTS.map((endpoint) => endpoint.toolName)).toEqual([
      "get_health",
      "get_team",
      "get_presets",
      "run_calc",
      "get_pokemon_stats",
      "run_batch_calc",
      "run_scenario",
    ]);
    expect(BOOTSTRAP_TOOL_NAME).toBe("get_openapi_spec");
  });

  test("exposes the OpenAPI spec as an MCP resource payload", () => {
    expect(OPENAPI_RESOURCE_URI).toBe("openapi://pokemon-tools/spec");
    expect(OPENAPI_YAML).toContain("openapi: 3.1.0");
    expect(OPENAPI_YAML).toContain("title: Pokemon Champions Calc API");
    expect(OPENAPI_YAML).toContain("/calc:");
  });

  test("returns the OpenAPI spec through the bootstrap tool", async () => {
    expect(createBootstrapToolResult()).toEqual({
      content: [
        {
          type: "text",
          text: OPENAPI_YAML,
        },
      ],
      structuredContent: {
        uri: OPENAPI_RESOURCE_URI,
        mimeType: "application/yaml",
        text: OPENAPI_YAML,
      },
    });
  });

  test("proxies JSON requests to the REST server", async () => {
    globalThis.fetch = mock(async (input, init) => {
      expect(input).toBe("http://127.0.0.1:3000/calc");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "content-type": "application/json" });
      expect(init?.body).toBeString();

      return Response.json({
        ok: true,
        echoedMethod: init?.method,
      });
    });

    const result = await proxyRestEndpoint("http://127.0.0.1:3000", REST_ENDPOINTS[3], {
      attacker: {
        species: "Umbreon",
        championsPreset: "fully_physical_defensive",
      },
      defender: {
        species: "Incineroar",
        championsPreset: "fully_physical_defensive",
      },
      move: "Foul Play",
    });

    expect(result).toEqual({
      ok: true,
      echoedMethod: "POST",
    });
  });

  test("surfaces REST errors", async () => {
    globalThis.fetch = mock(async () =>
      Response.json(
        {
          error: "bad request",
        },
        { status: 400 },
      ),
    );

    await expect(proxyRestEndpoint("http://127.0.0.1:3000", REST_ENDPOINTS[0])).rejects.toThrow(
      "GET /health failed with 400",
    );
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
