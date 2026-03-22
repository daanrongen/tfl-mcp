import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { TflClient } from "../../domain/TflClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

type AdditionalProperty = { key?: string; value?: string };
type BikePoint = {
  id?: string;
  commonName?: string;
  lat?: number;
  lon?: number;
  additionalProperties?: AdditionalProperty[];
};

const getBikeProp = (bp: BikePoint, key: string): string =>
  bp.additionalProperties?.find((p) => p.key === key)?.value ?? "N/A";

const formatBikePoint = (bp: BikePoint): string =>
  [
    `ID: ${bp.id ?? "Unknown"}`,
    `Name: ${bp.commonName ?? "Unknown"}`,
    `Location: ${bp.lat?.toFixed(5) ?? "?"}, ${bp.lon?.toFixed(5) ?? "?"}`,
    `Bikes Available: ${getBikeProp(bp, "NbBikes")}`,
    `Empty Docks: ${getBikeProp(bp, "NbEmptyDocks")}`,
    `Total Docks: ${getBikeProp(bp, "NbDocks")}`,
    `Installed: ${getBikeProp(bp, "Installed")}`,
    `Locked: ${getBikeProp(bp, "Locked")}`,
    "---",
  ].join("\n");

export const registerBikePointTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
) => {
  server.tool(
    "bike_points_all",
    "Gets all Santander Cycles (Boris Bikes) docking station locations in London with live availability (bikes, empty docks, total docks).",
    {},
    {
      title: "All Bike Points",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<BikePoint[]>("/BikePoint");
          if (!data.length) return "No bike points found.";
          return `Found ${data.length} bike points:\n\n${data.map(formatBikePoint).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "bike_point_search",
    "Search for Santander Cycles docking stations by name or nearby landmark. Returns matching stations.",
    {
      query: z
        .string()
        .min(1)
        .describe(
          "Search term for bike station name or nearby landmark (e.g. 'Waterloo', 'Hyde Park')",
        ),
    },
    {
      title: "Search Bike Points",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ query }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<BikePoint[]>("/BikePoint/Search", {
            query,
          });
          if (!data.length) return `No bike points found matching "${query}".`;
          return `Found ${data.length} bike points matching "${query}":\n\n${data.map(formatBikePoint).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "bike_point_by_id",
    "Gets a specific Santander Cycles docking station by its ID, including live bike and dock availability.",
    {
      id: z
        .string()
        .describe("The bike point ID (e.g. 'BikePoints_1'). Use bike_point_search to find IDs."),
    },
    {
      title: "Bike Point by ID",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<BikePoint>(`/BikePoint/${encodeURIComponent(id)}`);
          return formatBikePoint(data);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
