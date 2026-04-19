import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { TflClient } from "../../domain/TflClient.ts";
import { type ArrivalPrediction, formatArrival } from "../arrivals.ts";
import { formatError, formatSuccess } from "../utils.ts";

type StopPoint = {
  id?: string;
  naptanId?: string;
  icsCode?: string;
  commonName?: string;
  name?: string;
  stopType?: string;
  lat?: number;
  lon?: number;
  modes?: string[];
  lines?: Array<{ id?: string; name?: string }>;
};

const stopId = (s: StopPoint): string => s.icsCode ?? s.naptanId ?? s.id ?? "?";

const formatStop = (s: StopPoint): string => {
  const modes = s.modes?.join(", ") ?? "?";
  const lines = s.lines?.map((l) => l.name ?? l.id).join(", ") ?? "";
  return `${s.commonName ?? s.name ?? "??"} — ID: ${stopId(s)} — ${s.stopType ?? "?"} — modes: ${modes}${lines ? ` — lines: ${lines}` : ""}`;
};

export const registerStopPointTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
) => {
  // --- Meta ---
  server.tool(
    "stoppoint_meta_modes",
    "Gets the list of all transport modes available at TfL stop points.",
    {},
    {
      title: "StopPoint Meta Modes",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data =
            yield* client.request<Array<{ modeName?: string; isTflService?: boolean }>>(
              "/StopPoint/Meta/Modes",
            );
          const modes = data.map((m) => `${m.modeName ?? "?"} (TfL: ${m.isTflService ?? false})`);
          return `StopPoint modes:\n\n${modes.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_meta_stop_types",
    "Gets all valid stop point types (e.g. NaptanMetroStation, NaptanPublicBusCoachTram, NaptanRailStation).",
    {},
    {
      title: "StopPoint Meta Stop Types",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<string[]>("/StopPoint/Meta/StopTypes");
          return `Stop point types:\n\n${data.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_meta_categories",
    "Gets the list of available additional information categories for stop points.",
    {},
    {
      title: "StopPoint Meta Categories",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<
            Array<{ category?: string; availableKeys?: string[] }>
          >("/StopPoint/Meta/Categories");
          const lines = data.map((c) => {
            const keys = c.availableKeys?.join(", ") ?? "none";
            return `${c.category ?? "?"}: ${keys}`;
          });
          return `StopPoint categories (${data.length}):\n\n${lines.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Lookup ---
  server.tool(
    "stoppoint_search",
    "Search for TfL stop points (stations, bus stops) by name or 5-digit bus stop SMS code.\n\nThe returned 'ID' field is the ICS code — use this as the from/to value in journey_plan for unambiguous results.",
    {
      query: z
        .string()
        .min(1)
        .describe(
          "Stop name, partial name, or 5-digit bus stop SMS code (e.g. 'Victoria', 'Kings Cross', '73241')",
        ),
      modes: z.string().optional().describe("Comma-separated mode filters (e.g. 'tube,bus,dlr')"),
      maxResults: z.number().int().optional().describe("Maximum number of results (default: 50)"),
      lines: z.string().optional().describe("Comma-separated line IDs to filter by"),
      faresOnly: z.boolean().optional().describe("If true, only return stops where fares apply"),
      includeHubs: z.boolean().optional().describe("If true, include interchange hub stops"),
      tflOperatedNationalRailStationsOnly: z
        .boolean()
        .optional()
        .describe("If true, only return TfL-operated national rail stations"),
    },
    {
      title: "StopPoint Search",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({
      query,
      modes,
      maxResults,
      lines,
      faresOnly,
      includeHubs,
      tflOperatedNationalRailStationsOnly,
    }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<{
            matches?: StopPoint[];
            total?: number;
          }>("/StopPoint/Search", {
            query,
            modes,
            maxResults,
            lines,
            faresOnly,
            includeHubs,
            tflOperatedNationalRailStationsOnly,
          });
          const matches = data.matches ?? [];
          if (!matches.length) return `No stop points found matching "${query}".`;
          const header = `Stop points matching "${query}" (${matches.length} of ${data.total ?? "?"}):\n(Use the 'ID' value in journey_plan for unambiguous routing)\n`;
          return `${header}\n${matches.map(formatStop).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_by_ids",
    "Gets full details for one or more stop points by their Naptan IDs.",
    {
      ids: z
        .string()
        .describe(
          "Comma-separated Naptan stop IDs (e.g. '940GZZLUVIC' for Victoria tube). Use stoppoint_search to find IDs.",
        ),
      includeCrowdingData: z
        .boolean()
        .optional()
        .describe("If true, include crowding data in the response"),
    },
    {
      title: "StopPoints by IDs",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ ids, includeCrowdingData }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<StopPoint[]>(`/StopPoint/${encodeURIComponent(ids)}`, {
            includeCrowdingData,
          });
          return `Stop point details:\n\n${data.map(formatStop).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_by_sms",
    "Gets a stop point by its 5-digit SMS bus stop code (used for TfL's SMS arrival checker service).",
    {
      id: z.string().length(5).describe("5-digit SMS bus stop code (e.g. '73241')"),
      output: z.string().optional().describe("Output format (leave blank for default)"),
    },
    {
      title: "StopPoint by SMS Code",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, output }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<StopPoint>(
            `/StopPoint/Sms/${encodeURIComponent(id)}`,
            { output },
          );
          return formatStop(data);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_by_geo",
    "Gets stop points within a radius of given coordinates, filtered by stop type.",
    {
      lat: z.number().describe("Latitude"),
      lon: z.number().describe("Longitude"),
      stopTypes: z
        .string()
        .describe(
          "Comma-separated stop type(s) (e.g. 'NaptanMetroStation,NaptanPublicBusCoachTram'). Use stoppoint_meta_stop_types for available types.",
        ),
      radius: z
        .number()
        .int()
        .optional()
        .describe("Search radius in metres (default: 200, max: 1000)"),
      modes: z.string().optional().describe("Comma-separated mode filters"),
      useStopPointHierarchy: z
        .boolean()
        .optional()
        .describe("If true, consolidate child stops under their parent"),
      categories: z
        .string()
        .optional()
        .describe("Comma-separated additional data categories to return"),
      returnLines: z
        .boolean()
        .optional()
        .describe("If true, include lines serving each stop in the response"),
    },
    {
      title: "StopPoints by Geo",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({
      lat,
      lon,
      stopTypes,
      radius,
      modes,
      useStopPointHierarchy,
      categories,
      returnLines,
    }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<{ stopPoints?: StopPoint[] }>("/StopPoint", {
            "location.lat": lat,
            "location.lon": lon,
            stopTypes,
            radius,
            modes,
            useStopPointHierarchy,
            categories,
            returnLines,
          });
          const stops = data.stopPoints ?? [];
          if (!stops.length)
            return `No stop points found near (${lat}, ${lon}) within ${radius ?? 200}m.`;
          return `Stop points near (${lat}, ${lon}) within ${radius ?? 200}m (${stops.length}):\n\n${stops.map(formatStop).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_by_mode",
    "Gets all stop points filtered by transport mode. Supports pagination.",
    {
      modes: z.string().describe("Comma-separated modes (e.g. 'tube', 'dlr', 'overground')"),
      page: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Page number for pagination (default: 1)"),
    },
    {
      title: "StopPoints by Mode",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ modes, page }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<StopPoint[]>(
            `/StopPoint/Mode/${encodeURIComponent(modes)}`,
            { page },
          );
          return `Stop points for mode(s) "${modes}" (page ${page ?? 1}, ${data.length} results):\n\n${data.map(formatStop).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_by_type",
    "Gets all stop points of a specific type, with optional pagination.",
    {
      types: z
        .string()
        .describe(
          "Comma-separated stop types (e.g. 'NaptanMetroStation'). Use stoppoint_meta_stop_types to list valid types.",
        ),
      page: z.number().int().optional().describe("Page number for large result sets"),
    },
    {
      title: "StopPoints by Type",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ types, page }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const path = page
            ? `/StopPoint/Type/${encodeURIComponent(types)}/page/${page}`
            : `/StopPoint/Type/${encodeURIComponent(types)}`;
          const data = yield* client.request<StopPoint[]>(path);
          return `Stop points of type "${types}" (${data.length}):\n\n${data.map(formatStop).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_service_types",
    "Gets the service types (Regular, Night) available at a specific stop point.",
    {
      id: z.string().describe("Stop point Naptan ID"),
      lineIds: z.string().optional().describe("Comma-separated line IDs to filter by"),
      modes: z.string().optional().describe("Comma-separated modes to filter by"),
    },
    {
      title: "StopPoint Service Types",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, lineIds, modes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<
            Array<{ lineName?: string; lineId?: string; serviceType?: { name?: string } }>
          >("/StopPoint/ServiceTypes", { id, lineIds, modes });
          if (!data.length) return `No service types found for stop ${id}.`;
          const lines = data.map(
            (s) => `${s.lineName ?? s.lineId ?? "?"} — ${s.serviceType?.name ?? "?"}`,
          );
          return `Service types at stop ${id}:\n\n${lines.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Arrivals ---
  server.tool(
    "stoppoint_arrivals",
    "Gets live arrival predictions for all lines at a given stop point. The most useful real-time departure board tool.",
    {
      id: z
        .string()
        .describe(
          "Stop point Naptan ID (e.g. '940GZZLUVIC' for Victoria tube). Use stoppoint_search to find IDs.",
        ),
    },
    {
      title: "StopPoint Arrivals",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ id }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<ArrivalPrediction[]>(
            `/StopPoint/${encodeURIComponent(id)}/Arrivals`,
          );
          if (!data.length) return `No arrivals currently predicted at stop ${id}.`;
          const sorted = [...data].sort((a, b) => (a.timeToStation ?? 0) - (b.timeToStation ?? 0));
          return `Arrivals at ${data[0]?.stationName ?? id}:\n${sorted.map(formatArrival).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_arrival_departures",
    "Gets live arrival AND departure predictions for a stop point (Overground and Elizabeth line only).",
    {
      id: z.string().describe("Stop point Naptan ID"),
      lineIds: z
        .string()
        .optional()
        .describe("Comma-separated line IDs to filter (e.g. 'london-overground,elizabeth')"),
    },
    {
      title: "StopPoint Arrival/Departures",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ id, lineIds }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<
            Array<{
              stationName?: string;
              lineName?: string;
              platformName?: string;
              destinationName?: string;
              scheduledTimeOfArrival?: string;
              scheduledTimeOfDeparture?: string;
              estimatedTimeOfArrival?: string;
              estimatedTimeOfDeparture?: string;
            }>
          >(`/StopPoint/${encodeURIComponent(id)}/ArrivalDepartures`, { lineIds });
          if (!data.length) return `No arrivals/departures at stop ${id}.`;
          const lines = data.map((d) => {
            const dest = d.destinationName ?? "?";
            const platform = d.platformName ? ` (${d.platformName})` : "";
            const arr = d.estimatedTimeOfArrival ?? d.scheduledTimeOfArrival ?? "?";
            const dep = d.estimatedTimeOfDeparture ?? d.scheduledTimeOfDeparture ?? "?";
            return `  ${d.lineName ?? "?"} → ${dest}${platform} — arr: ${arr} dep: ${dep}`;
          });
          return `Arrival/Departures at ${data[0]?.stationName ?? id}:\n${lines.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Disruptions ---
  server.tool(
    "stoppoint_disruptions",
    "Gets all active disruptions at one or more stop points.",
    {
      ids: z.string().describe("Comma-separated stop point Naptan IDs"),
      getFamily: z.boolean().optional().describe("If true, include disruptions for child stops"),
      includeRouteBlockedStops: z
        .boolean()
        .optional()
        .describe("If true, include stops where the route is blocked"),
      flattenResponse: z
        .boolean()
        .optional()
        .describe("If true, return a flat list rather than nested structure"),
    },
    {
      title: "StopPoint Disruptions",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ ids, getFamily, includeRouteBlockedStops, flattenResponse }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<
            Array<{
              category?: string;
              type?: string;
              categoryDescription?: string;
              description?: string;
              summary?: string;
              additionalInfo?: string;
              affectedRoutes?: Array<{ name?: string }>;
              affectedStops?: Array<{ commonName?: string }>;
            }>
          >(`/StopPoint/${encodeURIComponent(ids)}/Disruption`, {
            getFamily,
            includeRouteBlockedStops,
            flattenResponse,
          });
          if (!data.length) return `No disruptions at stop(s) ${ids}.`;
          const lines = data.map((d) => {
            const parts = [
              `Category: ${d.categoryDescription ?? d.category ?? "?"}`,
              `Type: ${d.type ?? "?"}`,
            ];
            if (d.description) parts.push(`Info: ${d.description}`);
            else if (d.summary) parts.push(`Info: ${d.summary}`);
            if (d.affectedStops?.length)
              parts.push(
                `Affected stops: ${d.affectedStops.map((s) => s.commonName ?? "?").join(", ")}`,
              );
            return parts.join("\n");
          });
          return `Disruptions at ${ids} (${data.length}):\n\n${lines.join("\n---\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_disruptions_by_mode",
    "Gets all disrupted stop points for a given transport mode.",
    {
      modes: z.string().describe("Comma-separated modes (e.g. 'tube,dlr')"),
      includeRouteBlockedStops: z
        .boolean()
        .optional()
        .describe("If true, include route-blocked stops"),
    },
    {
      title: "StopPoint Disruptions by Mode",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ modes, includeRouteBlockedStops }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<StopPoint[]>(
            `/StopPoint/Mode/${encodeURIComponent(modes)}/Disruption`,
            {
              includeRouteBlockedStops,
            },
          );
          if (!data.length) return `No disrupted stops for mode(s): ${modes}`;
          return `Disrupted stops for ${modes} (${data.length}):\n\n${data.map(formatStop).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Journey / routing helpers ---
  server.tool(
    "stoppoint_reachable_from",
    "Gets all stop points that are reachable from a given station on a specific line — useful for showing where you can go without changing.",
    {
      id: z.string().describe("Origin stop point Naptan ID"),
      lineId: z.string().describe("Line ID to travel on (e.g. 'victoria', 'central')"),
      serviceTypes: z
        .string()
        .optional()
        .describe("Service type filter (e.g. 'Regular' or 'Night')"),
    },
    {
      title: "Reachable Stops from Line",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, lineId, serviceTypes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<StopPoint[]>(
            `/StopPoint/${encodeURIComponent(id)}/CanReachOnLine/${encodeURIComponent(lineId)}`,
            { serviceTypes },
          );
          return `Stops reachable from ${id} on ${lineId} (${data.length}):\n\n${data.map(formatStop).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_direction",
    "Returns the canonical direction ('inbound' or 'outbound') between two stop points on a line.",
    {
      id: z.string().describe("Origin stop point Naptan ID"),
      toStopPointId: z.string().describe("Destination stop point Naptan ID"),
      lineId: z
        .string()
        .optional()
        .describe("Line ID to check direction on (helps disambiguation)"),
    },
    {
      title: "StopPoint Direction",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, toStopPointId, lineId }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<string>(
            `/StopPoint/${encodeURIComponent(id)}/DirectionTo/${encodeURIComponent(toStopPointId)}`,
            { lineId },
          );
          return `Direction from ${id} to ${toStopPointId}: ${data}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_route",
    "Returns the route sections for all lines that serve a given stop point.",
    {
      id: z.string().describe("Stop point Naptan ID"),
      serviceTypes: z
        .string()
        .optional()
        .describe("Comma-separated service type filter (e.g. 'Regular')"),
    },
    {
      title: "StopPoint Route",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, serviceTypes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<
            Array<{
              lineId?: string;
              lineName?: string;
              direction?: string;
              originationName?: string;
              destinationName?: string;
              serviceType?: string;
            }>
          >(`/StopPoint/${encodeURIComponent(id)}/Route`, { serviceTypes });
          if (!data.length) return `No route sections found for stop ${id}.`;
          const lines = data.map(
            (r) =>
              `${r.lineName ?? r.lineId ?? "?"} (${r.serviceType ?? "Regular"}) ${r.direction ?? "?"}: ${r.originationName ?? "?"} → ${r.destinationName ?? "?"}`,
          );
          return `Routes serving stop ${id} (${data.length}):\n\n${lines.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Crowding ---
  server.tool(
    "stoppoint_crowding",
    "Gets crowding data for a stop point on a specific line, optionally by direction.",
    {
      id: z.string().describe("Stop point Naptan ID"),
      line: z.string().describe("Line ID (e.g. 'victoria', 'central')"),
      direction: z.enum(["inbound", "outbound", "all"]).describe("Direction of travel"),
    },
    {
      title: "StopPoint Crowding",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ id, line, direction }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<
            Array<{
              naptanId?: string;
              commonName?: string;
              passengerFlows?: Array<{ timeSlice?: string; value?: number }>;
              workerFlows?: Array<{ timeSlice?: string; value?: number }>;
            }>
          >(`/StopPoint/${encodeURIComponent(id)}/Crowding/${encodeURIComponent(line)}`, {
            direction,
          });
          if (!data.length) return `No crowding data available for stop ${id} on ${line}.`;
          const sections = data.map((stop) => {
            const name = stop.commonName ?? stop.naptanId ?? "?";
            if (!stop.passengerFlows?.length) return `${name}: no flow data`;
            const peak = [...(stop.passengerFlows ?? [])].sort(
              (a, b) => (b.value ?? 0) - (a.value ?? 0),
            )[0];
            return `${name}: peak at ${peak?.timeSlice ?? "?"} (${peak?.value ?? "?"} passengers)`;
          });
          return `Crowding data for ${id} on ${line} (${direction}):\n\n${sections.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Associated places ---
  server.tool(
    "stoppoint_car_parks",
    "Gets car parks associated with a given stop point (station).",
    {
      stopPointId: z.string().describe("Stop point Naptan ID"),
    },
    {
      title: "StopPoint Car Parks",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ stopPointId }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<
            Array<{
              id?: string;
              name?: string;
              carParkId?: string;
              accessPoints?: Array<{ name?: string }>;
              facilities?: Array<{ name?: string; description?: string; paymentMethods?: string }>;
            }>
          >(`/StopPoint/${encodeURIComponent(stopPointId)}/CarParks`);
          if (!data.length) return `No car parks found near stop ${stopPointId}.`;
          const lines = data.map((cp) => {
            const id = cp.carParkId ?? cp.id ?? "?";
            const name = cp.name ?? id;
            const spaces =
              cp.facilities?.map((f) => `${f.name ?? "?"}: ${f.description ?? "?"}`).join(", ") ??
              "details unavailable";
            return `${name} (${id}) — ${spaces}`;
          });
          return `Car parks near stop ${stopPointId} (${data.length}):\n\n${lines.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_taxi_ranks",
    "Gets taxi ranks near a given stop point (station).",
    {
      stopPointId: z.string().describe("Stop point Naptan ID"),
    },
    {
      title: "StopPoint Taxi Ranks",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ stopPointId }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<
            Array<{
              id?: string;
              commonName?: string;
              placeType?: string;
              lat?: number;
              lon?: number;
            }>
          >(`/StopPoint/${encodeURIComponent(stopPointId)}/TaxiRanks`);
          if (!data.length) return `No taxi ranks found near stop ${stopPointId}.`;
          const lines = data.map(
            (t) =>
              `${t.commonName ?? t.id ?? "?"} (${t.placeType ?? "TaxiRank"}) — ${t.lat != null ? `${t.lat}, ${t.lon}` : "no coords"}`,
          );
          return `Taxi ranks near stop ${stopPointId} (${data.length}):\n\n${lines.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "stoppoint_place_types",
    "Gets places of given types that are associated with (near) a specific stop point.",
    {
      id: z.string().describe("Stop point Naptan ID"),
      placeTypes: z
        .string()
        .describe("Comma-separated place types to look up (e.g. 'AirportTerminal,CarPark')"),
    },
    {
      title: "StopPoint Place Types",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, placeTypes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<
            Array<{
              id?: string;
              commonName?: string;
              placeType?: string;
              lat?: number;
              lon?: number;
            }>
          >(`/StopPoint/${encodeURIComponent(id)}/placeTypes`, { placeTypes });
          if (!data.length) return `No places of type "${placeTypes}" found at stop ${id}.`;
          const lines = data.map(
            (p) =>
              `${p.commonName ?? p.id ?? "?"} (${p.placeType ?? "?"}) — ${p.lat != null ? `${p.lat}, ${p.lon}` : "no coords"}`,
          );
          return `Places of type "${placeTypes}" at stop ${id} (${data.length}):\n\n${lines.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
