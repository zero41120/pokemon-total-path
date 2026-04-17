import * as z from "zod/v4";
import YAML from "yaml";
import { REST_ENDPOINTS } from "../src/lib/endpoints";

const paths: Record<string, unknown> = {};

for (const endpoint of REST_ENDPOINTS) {
  const jsonSchema = z.toJSONSchema(endpoint.inputSchema, { reused: "inline" });

  paths[endpoint.path] = {
    [endpoint.method.toLowerCase()]: {
      operationId: endpoint.toolName,
      summary: endpoint.title,
      description: endpoint.description,
      requestBody: {
        required: true,
        content: { "application/json": { schema: jsonSchema } },
      },
      responses: {
        "200": { description: "Calculation result" },
        "400": { description: "Invalid input" },
      },
    },
  };
}

const doc = {
  openapi: "3.1.0",
  info: {
    title: "Pokemon Champions API",
    version: "0.3.0",
    description: "Pokémon Champions tools API. Generated from Zod schemas — do not edit by hand.",
  },
  servers: [{ url: "https://zero41120pokemontools.com" }],
  paths,
};

const outPath = new URL("../openapi.yaml", import.meta.url).pathname;
await Bun.write(outPath, YAML.stringify(doc, { lineWidth: 0 }));
console.log(`openapi.yaml written to ${outPath}`);
