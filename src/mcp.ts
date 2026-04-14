import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request as ExpressRequest, type Response as ExpressResponse } from "express";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import * as z from "zod/v4";

type HttpMethod = "GET" | "POST";

type OpenApiSchema = {
  $ref?: string;
  type?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  required?: string[];
  enum?: Array<string | number | boolean>;
  nullable?: boolean;
  description?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
};

type OpenApiOperation = {
  operationId?: string;
  summary?: string;
  description?: string;
  requestBody?: {
    required?: boolean;
    content?: {
      "application/json"?: {
        schema?: OpenApiSchema;
      };
    };
  };
};

type OpenApiDocument = {
  info?: {
    title?: string;
    version?: string;
  };
  paths?: Record<string, Partial<Record<Lowercase<HttpMethod>, OpenApiOperation>>>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
  };
};

export type RestEndpoint = {
  toolName: string;
  title: string;
  description: string;
  method: HttpMethod;
  path: string;
  inputSchema: z.ZodTypeAny;
};

function loadOpenApiDocument() {
  return YAML.parse(
    readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8"),
  ) as OpenApiDocument;
}

function toToolName(operationId: string | undefined, method: HttpMethod, path: string) {
  const base = operationId ?? `${method.toLowerCase()}_${path}`;
  return base
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function resolveOpenApiRef(schema: OpenApiSchema, document: OpenApiDocument) {
  if (!schema.$ref) {
    return schema;
  }

  const prefix = "#/components/schemas/";
  if (!schema.$ref.startsWith(prefix)) {
    throw new Error(`Unsupported OpenAPI ref: ${schema.$ref}`);
  }

  const key = schema.$ref.slice(prefix.length);
  const resolved = document.components?.schemas?.[key];
  if (!resolved) {
    throw new Error(`Missing OpenAPI schema component: ${key}`);
  }

  return resolved;
}

function withSharedConstraints(schema: z.ZodTypeAny, definition: OpenApiSchema) {
  let current = schema;

  if (definition.description && "meta" in current && typeof current.meta === "function") {
    current = current.meta({ description: definition.description });
  }

  if (definition.nullable) {
    current = current.nullable();
  }

  return current;
}

function openApiSchemaToZod(definition: OpenApiSchema | undefined, document: OpenApiDocument): z.ZodTypeAny {
  if (!definition) {
    return z.unknown();
  }

  const schema = resolveOpenApiRef(definition, document);

  if (schema.enum && schema.enum.length > 0) {
    const literals = schema.enum.map((value) => z.literal(value));
    const literalSchema = literals.length === 1 ? literals[0] : z.union(literals as [typeof literals[0], typeof literals[0], ...typeof literals]);
    return withSharedConstraints(literalSchema, schema);
  }

  switch (schema.type) {
    case "string": {
      let result = z.string();
      if (schema.minLength !== undefined) {
        result = result.min(schema.minLength);
      }
      if (schema.maxLength !== undefined) {
        result = result.max(schema.maxLength);
      }
      return withSharedConstraints(result, schema);
    }
    case "integer": {
      let result = z.number().int();
      if (schema.minimum !== undefined) {
        result = result.min(schema.minimum);
      }
      if (schema.maximum !== undefined) {
        result = result.max(schema.maximum);
      }
      return withSharedConstraints(result, schema);
    }
    case "number": {
      let result = z.number();
      if (schema.minimum !== undefined) {
        result = result.min(schema.minimum);
      }
      if (schema.maximum !== undefined) {
        result = result.max(schema.maximum);
      }
      return withSharedConstraints(result, schema);
    }
    case "boolean":
      return withSharedConstraints(z.boolean(), schema);
    case "array":
      return withSharedConstraints(z.array(openApiSchemaToZod(schema.items, document)), schema);
    case "object":
    case undefined: {
      const shape = Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([key, property]) => {
          const propertySchema = openApiSchemaToZod(property, document);
          const required = schema.required?.includes(key) ?? false;
          return [key, required ? propertySchema : propertySchema.optional()];
        }),
      );
      return withSharedConstraints(z.object(shape).passthrough(), schema);
    }
    default:
      return withSharedConstraints(z.unknown(), schema);
  }
}

function requestBodySchema(operation: OpenApiOperation, document: OpenApiDocument) {
  const schema = operation.requestBody?.content?.["application/json"]?.schema;
  if (!schema) {
    return z.object({});
  }

  return openApiSchemaToZod(schema, document);
}

const OPENAPI_DOCUMENT = loadOpenApiDocument();

export const REST_ENDPOINTS: RestEndpoint[] = Object.entries(OPENAPI_DOCUMENT.paths ?? {}).flatMap(([path, operations]) => {
  return (["get", "post"] as const).flatMap((method) => {
    const operation = operations[method];
    if (!operation) {
      return [];
    }

    const upperMethod = method.toUpperCase() as HttpMethod;
    return [
      {
        toolName: toToolName(operation.operationId, upperMethod, path),
        title: operation.summary ?? operation.operationId ?? `${upperMethod} ${path}`,
        description: operation.description ?? operation.summary ?? `${upperMethod} ${path}`,
        method: upperMethod,
        path,
        inputSchema: requestBodySchema(operation, OPENAPI_DOCUMENT),
      },
    ];
  });
});

function toAbsoluteUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

async function parseRestResponse(response: globalThis.Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await response.json();
  }

  return await response.text();
}

export async function proxyRestEndpoint(baseUrl: string, endpoint: RestEndpoint, body?: unknown) {
  const response = await fetch(toAbsoluteUrl(baseUrl, endpoint.path), {
    method: endpoint.method,
    headers: endpoint.method === "POST" ? { "content-type": "application/json" } : undefined,
    body: endpoint.method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });

  const result = await parseRestResponse(response);
  if (!response.ok) {
    const details = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    throw new Error(`${endpoint.method} ${endpoint.path} failed with ${response.status}: ${details}`);
  }

  return result;
}

function toToolResult(endpoint: RestEndpoint, result: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: `${endpoint.method} ${endpoint.path}\n${JSON.stringify(result, null, 2)}`,
      },
    ],
    structuredContent: result,
  };
}

export function createMcpWrapperServer(restBaseUrl: string) {
  const server = new McpServer(
    {
      name: OPENAPI_DOCUMENT.info?.title ?? "pokemon-champions-calc-mcp",
      version: OPENAPI_DOCUMENT.info?.version ?? "1.0.0",
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  for (const endpoint of REST_ENDPOINTS) {
    server.registerTool(
      endpoint.toolName,
      {
        title: endpoint.title,
        description: endpoint.description,
        inputSchema: endpoint.inputSchema,
      },
      async (args) => toToolResult(endpoint, await proxyRestEndpoint(restBaseUrl, endpoint, args)),
    );
  }

  return server;
}

function methodNotAllowed(res: ExpressResponse) {
  res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
}

export function startMcpServer({
  restBaseUrl = Bun.env.REST_BASE_URL ?? `http://127.0.0.1:${Bun.env.REST_PORT ?? "3000"}`,
  port = Number(Bun.env.MCP_PORT ?? 3001),
  host = Bun.env.MCP_HOST ?? "127.0.0.1",
  allowedHosts = (Bun.env.MCP_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim())
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
      tools: REST_ENDPOINTS.map((endpoint) => endpoint.toolName),
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
      // enableJsonResponse: true,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal server error",
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
      listener.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
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
