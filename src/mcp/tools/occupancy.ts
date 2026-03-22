import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { TflClient } from "../../domain/TflClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

type CarPark = {
  id?: string;
  name?: string;
  bays?: Array<{ bayType?: string; bayCount?: number; free?: number }>;
  message?: string;
};

type ChargeConnector = {
  id?: string;
  sourceSystemPlaceId?: string;
  status?: string;
};

type BikePointOccupancy = {
  id?: string;
  name?: string;
  bikesCount?: number;
  emptyDocks?: number;
  totalDocks?: number;
};

const formatCarPark = (cp: CarPark): string => {
  const bayInfo =
    cp.bays
      ?.map((b) => `  ${b.bayType ?? "?"}: ${b.free ?? "?"} free / ${b.bayCount ?? "?"} total`)
      .join("\n") ?? "  No bay data";
  return [
    `Car Park: ${cp.name ?? cp.id ?? "?"}`,
    bayInfo,
    cp.message ? `  Note: ${cp.message}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

export const registerOccupancyTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
) => {
  server.tool(
    "occupancy_car_parks_all",
    "Gets live occupancy (free spaces) for all TfL car parks that provide occupancy data.",
    {},
    {
      title: "Car Park Occupancy",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<CarPark[]>("/Occupancy/CarPark");
          if (!data.length) return "No car park occupancy data available.";
          return `Car park occupancy (${data.length} parks):\n\n${data.map(formatCarPark).join("\n\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "occupancy_car_park_by_id",
    "Gets live occupancy for a specific TfL car park by its ID.",
    {
      id: z
        .string()
        .describe("Car park ID (e.g. 'CarParks_800491'). Use occupancy_car_parks_all to find IDs."),
    },
    {
      title: "Car Park Occupancy by ID",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ id }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<CarPark>(
            `/Occupancy/CarPark/${encodeURIComponent(id)}`,
          );
          return formatCarPark(data);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "occupancy_bike_points",
    "Gets live occupancy (bike and dock availability) for one or more Santander Cycles docking stations by ID.",
    {
      ids: z
        .string()
        .describe(
          "Comma-separated bike point IDs (e.g. 'BikePoints_1,BikePoints_2'). Use bike_point_search to find IDs.",
        ),
    },
    {
      title: "Bike Point Occupancy",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ ids }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<BikePointOccupancy[]>(
            `/Occupancy/BikePoints/${encodeURIComponent(ids)}`,
          );
          const formatted = data.map(
            (bp) =>
              `${bp.name ?? bp.id ?? "?"}: ${bp.bikesCount ?? "?"} bikes, ${bp.emptyDocks ?? "?"} empty docks, ${bp.totalDocks ?? "?"} total`,
          );
          return `Bike point occupancy:\n\n${formatted.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "occupancy_charge_connectors_all",
    "Gets live availability status for all EV charge connectors managed by TfL.",
    {},
    {
      title: "EV Charge Connector Availability",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<ChargeConnector[]>("/Occupancy/ChargeConnector");
          if (!data.length) return "No charge connector data available.";
          const formatted = data.map(
            (c) => `${c.sourceSystemPlaceId ?? c.id ?? "?"}: ${c.status ?? "?"}`,
          );
          return `Charge connector statuses (${data.length} connectors):\n\n${formatted.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "occupancy_charge_connectors_by_ids",
    "Gets live availability status for specific EV charge connectors by their source system IDs.",
    {
      ids: z
        .string()
        .describe(
          "Comma-separated charge connector source system IDs. Use occupancy_charge_connectors_all to find IDs.",
        ),
    },
    {
      title: "EV Charge Connectors by ID",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ ids }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<ChargeConnector[]>(
            `/Occupancy/ChargeConnector/${encodeURIComponent(ids)}`,
          );
          const formatted = data.map(
            (c) => `${c.sourceSystemPlaceId ?? c.id ?? "?"}: ${c.status ?? "?"}`,
          );
          return `Charge connector statuses:\n\n${formatted.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
