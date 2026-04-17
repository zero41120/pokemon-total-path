import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, {
  type Request as ExpressRequest,
  type Response as ExpressResponse,
} from "express";
import type { RestEndpoint } from "./lib/endpoints";
import { REST_ENDPOINTS } from "./lib/endpoints";

export { REST_ENDPOINTS };
export type { RestEndpoint };

function toAbsoluteUrl(baseUrl: string, path: string) {
  return new URL(
    path,
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  ).toString();
}

async function parseRestResponse(response: globalThis.Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await response.json();
  }
  return await response.text();
}

export async function proxyRestEndpoint(
  baseUrl: string,
  endpoint: RestEndpoint,
  body?: unknown,
) {
  const params =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const resolvedPath = endpoint.path.replace(/\{(\w+)\}/g, (_, key) =>
    encodeURIComponent(String(params[key] ?? "")),
  );
  const response = await fetch(toAbsoluteUrl(baseUrl, resolvedPath), {
    method: endpoint.method,
    headers:
      endpoint.method === "POST"
        ? { "content-type": "application/json" }
        : undefined,
    body: endpoint.method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });

  const result = await parseRestResponse(response);
  if (!response.ok) {
    const details =
      typeof result === "string" ? result : JSON.stringify(result, null, 2);
    throw new Error(
      `${endpoint.method} ${resolvedPath} failed with ${response.status}: ${details}`,
    );
  }
  return result;
}

function toToolResult(endpoint: RestEndpoint, result: unknown) {
  const structuredContent =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : { result };
  return {
    content: [
      {
        type: "text" as const,
        text: `${endpoint.method} ${endpoint.path}\n${JSON.stringify(result, null, 2)}`,
      },
    ],
    structuredContent,
  };
}

export function createMcpWrapperServer(restBaseUrl: string) {
  const server = new McpServer(
    { name: "pokemon-champions-calc-mcp", version: "1.0.0" },
    { capabilities: { logging: {} } },
  );

  for (const endpoint of REST_ENDPOINTS) {
    server.registerTool(
      endpoint.toolName,
      {
        title: endpoint.title,
        description: endpoint.description,
        inputSchema: endpoint.inputSchema,
      },
      async (args) =>
        toToolResult(
          endpoint,
          await proxyRestEndpoint(restBaseUrl, endpoint, args),
        ),
    );
  }

  return server;
}

function methodNotAllowed(res: ExpressResponse) {
  res
    .status(405)
    .set("Allow", "POST")
    .json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
}

export function startMcpServer({
  restBaseUrl = Bun.env.REST_BASE_URL ??
    `http://127.0.0.1:${Bun.env.REST_PORT ?? "3000"}`,
  port = Number(Bun.env.MCP_PORT ?? 3001),
  host = Bun.env.MCP_HOST ?? "127.0.0.1",
  allowedHosts = (Bun.env.MCP_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
}: {
  restBaseUrl?: string;
  port?: number;
  host?: string;
  allowedHosts?: string[];
} = {}) {
  const app = createMcpExpressApp({
    host,
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
  });
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req: ExpressRequest, res: ExpressResponse) => {
    res.json({
      ok: true,
      service: "pokemon-champions-calc-mcp",
      restBaseUrl,
      tools: REST_ENDPOINTS.map((e) => e.toolName),
    });
  });

  app.post("/mcp", async (req: ExpressRequest, res: ExpressResponse) => {
    if (req.body?.method === "notifications/initialized") {
      res.status(202).end();
      return;
    }

    const server = createMcpWrapperServer(restBaseUrl);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res
          .status(500)
          .json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message:
                error instanceof Error
                  ? error.message
                  : "Internal server error",
            },
            id: null,
          });
      }
    } finally {
      await transport.close();
      await server.close();
    }
  });

  app.get("/mcp", (_req: ExpressRequest, res: ExpressResponse) => {
    methodNotAllowed(res);
  });
  app.delete("/mcp", (_req: ExpressRequest, res: ExpressResponse) => {
    methodNotAllowed(res);
  });

  const listener = app.listen(port, host, () => {
    console.log(`MCP wrapper listening on http://${host}:${port}/mcp`);
    console.log(`Proxying to ${restBaseUrl}`);
  });

  const shutdown = async () => {
    await new Promise<void>((resolve, reject) => {
      listener.close((error) => (error ? reject(error) : resolve()));
    });
  };

  process.once("SIGINT", async () => {
    await shutdown();
    process.exit(0);
  });
  process.once("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
  });

  return listener;
}
