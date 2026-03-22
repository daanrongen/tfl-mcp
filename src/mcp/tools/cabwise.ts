import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { TflClient } from "../../domain/TflClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

export const registerCabwiseTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
) => {
  server.tool(
    "cabwise_search",
    "Search for licensed taxis and minicabs near a location in London. Returns operator contact information.",
    {
      lat: z
        .number()
        .min(51.2)
        .max(51.8)
        .describe("Latitude of the search location (within Greater London)"),
      lon: z
        .number()
        .min(-0.6)
        .max(0.4)
        .describe("Longitude of the search location (within Greater London)"),
      radius: z.number().positive().optional().describe("Search radius in metres (default: 1000)"),
      optype: z
        .enum(["Minicab", "BlackCab"])
        .optional()
        .describe("Operator type filter: 'Minicab' or 'BlackCab'"),
      name: z.string().optional().describe("Filter by operator name"),
      maxResults: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum number of results to return (default: 10)"),
      twentyFourSevenOnly: z
        .boolean()
        .optional()
        .describe("If true, only return operators available 24/7"),
      wc: z.boolean().optional().describe("If true, include wheelchair-accessible vehicles only"),
    },
    {
      title: "Cabwise Search",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ lat, lon, radius, optype, name, maxResults, twentyFourSevenOnly, wc }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<unknown>("/Cabwise/search", {
            lat,
            lon,
            radius,
            optype,
            name,
            maxResults,
            twentyFourSevenOnly,
            wc,
          });
          return `Taxi/minicab operators near (${lat}, ${lon}):\n\n${JSON.stringify(data, null, 2)}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
