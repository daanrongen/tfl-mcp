import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { TflClient } from "../../domain/TflClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

type Place = {
  id?: string;
  commonName?: string;
  placeType?: string;
  lat?: number;
  lon?: number;
};

const formatPlace = (p: Place): string =>
  `${p.commonName ?? "??"} (${p.placeType ?? "?"}) — ID: ${p.id ?? "?"} — ${p.lat?.toFixed(5) ?? "?"}, ${p.lon?.toFixed(5) ?? "?"}`;

export const registerPlaceTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
) => {
  server.tool(
    "place_search",
    "Search for TfL places (stations, stops, landmarks) by name. Valid place types include: StopPoint, NaptanMetroStation, NaptanRailStation, CarPark, Airport, BikePoint, and others.",
    {
      name: z
        .string()
        .min(1)
        .describe("Place name to search for (e.g. 'Victoria', 'London Bridge')"),
      types: z
        .string()
        .optional()
        .describe(
          "Comma-separated place types to filter by (e.g. 'StopPoint,NaptanMetroStation').",
        ),
    },
    {
      title: "Place Search",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ name, types }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Place[]>("/Place/Search", {
            name,
            types,
          });
          if (!data.length) return `No places found matching "${name}".`;
          return `Places matching "${name}" (${data.length} results):\n\n${data.map(formatPlace).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "place_by_id",
    "Gets details for a specific place by its TfL ID.",
    {
      id: z.string().describe("TfL place ID. Use place_search to find IDs."),
      includeChildren: z
        .boolean()
        .optional()
        .describe("If true, include child places (e.g. terminals at airports)"),
    },
    {
      title: "Place by ID",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, includeChildren }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Place>(`/Place/${encodeURIComponent(id)}`, {
            includeChildren,
          });
          return formatPlace(data);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "place_by_geo",
    "Gets places within a bounding box or radius of coordinates, optionally filtered by type.",
    {
      lat: z.number().describe("Latitude"),
      lon: z.number().describe("Longitude"),
      radius: z.number().positive().optional().describe("Search radius in metres"),
      types: z
        .string()
        .optional()
        .describe("Comma-separated place types to filter by (e.g. 'StopPoint,NaptanMetroStation')"),
      maxResults: z.number().int().positive().optional().describe("Maximum results to return"),
    },
    {
      title: "Places by Location",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ lat, lon, radius, types, maxResults }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Place[]>("/Place", {
            lat,
            lon,
            radius,
            type: types,
            maxResults,
          });
          if (!data.length) return `No places found near (${lat}, ${lon}).`;
          return `Places near (${lat}, ${lon}) (${data.length}):\n\n${data.map(formatPlace).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "place_by_type",
    "Gets all places of a given type. Valid types: StopPoint, NaptanMetroStation, NaptanRailStation, CarPark, Airport, BikePoint, and others.",
    {
      types: z.string().describe("Comma-separated place types (e.g. 'CarPark,Airport')."),
    },
    {
      title: "Places by Type",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ types }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Place[]>(`/Place/Type/${encodeURIComponent(types)}`);
          return `Places of type "${types}" (${data.length}):\n\n${data.map(formatPlace).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
