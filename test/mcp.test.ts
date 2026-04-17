import { afterEach, describe, expect, test } from "bun:test";
import { REST_ENDPOINTS, startMcpServer } from "../src/mcp";
import * as z from "zod/v4";
import { CalcMcpRequestSchema } from "../src/lib/schemas";

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

  test("calc schema keeps optional advanced params optional in generated JSON Schema", () => {
    const calc = REST_ENDPOINTS.find((e) => e.toolName === "calc");
    const schema = z.toJSONSchema(calc!.inputSchema, { reused: "inline" }) as {
      properties: {
        attacker: { required?: string[] };
        defender: { required?: string[] };
        move: { required?: string[] };
      };
    };

    expect(schema.properties.attacker.required).toEqual(["name"]);
    expect(schema.properties.defender.required).toEqual(["name"]);
    expect(schema.properties.move.required).toEqual(["name"]);
  });

  test("mcp schema exposes advanced params as top-level optional fields", () => {
    const schema = z.toJSONSchema(CalcMcpRequestSchema, { reused: "inline" }) as {
      required?: string[];
      properties: Record<string, unknown>;
    };

    expect(schema.properties.attackerOptionalParameterIgnoreUnlessNecessary).toBeDefined();
    expect(schema.properties.defenderOptionalParameterIgnoreUnlessNecessary).toBeDefined();
    expect(schema.properties.moveOptionalParameterIgnoreUnlessNecessary).toBeDefined();
    expect(schema.required).toEqual(["format", "attacker", "defender", "move"]);
    expect(schema.required).not.toContain("attackerOptionalParameterIgnoreUnlessNecessary");
    expect(schema.required).not.toContain("defenderOptionalParameterIgnoreUnlessNecessary");
    expect(schema.required).not.toContain("moveOptionalParameterIgnoreUnlessNecessary");
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
