import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import { TflClient } from "../../domain/TflClient.ts";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { formatError, formatSuccess } from "../utils.ts";

type LineStatus = { statusSeverityDescription?: string; reason?: string };
type Line = {
  id?: string;
  name?: string;
  modeName?: string;
  lineStatuses?: LineStatus[];
};
type Disruption = {
  category?: string;
  type?: string;
  description?: string;
};
type ArrivalPrediction = {
  destinationName?: string;
  platformName?: string;
  timeToStation?: number;
  expectedArrival?: string;
};

const formatLine = (line: Line): string => {
  const statuses =
    line.lineStatuses
      ?.map(
        (s) =>
          `${s.statusSeverityDescription ?? "?"}${s.reason ? `: ${s.reason}` : ""}`,
      )
      .join("; ") ?? "No status";
  return `${line.name ?? line.id ?? "Unknown"} (${line.modeName ?? "?"}) — ${statuses}`;
};

const formatDisruption = (d: Disruption): string =>
  [
    `Category: ${d.category ?? "Unknown"}`,
    `Type: ${d.type ?? "Unknown"}`,
    `Description: ${d.description ?? "None"}`,
  ].join("\n");

const formatArrival = (a: ArrivalPrediction): string => {
  const mins =
    a.timeToStation != null ? Math.round(a.timeToStation / 60) : null;
  return `  → ${a.destinationName ?? "?"} via ${a.platformName ?? "?"} — ${mins != null ? `${mins} min` : (a.expectedArrival ?? "?")}`;
};

export const registerLineTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<
    TflClient,
    TflError | TflDisambiguationError
  >,
) => {
  // --- Meta ---
  server.tool(
    "line_meta_modes",
    "Gets all valid line modes (e.g. tube, bus, dlr, overground, elizabeth-line, tram, cable-car).",
    {},
    {
      title: "Line Meta Modes",
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
            yield* client.request<Array<{ modeName?: string }>>(
              "/Line/Meta/Modes",
            );
          return `Available line modes: ${data.map((m) => m.modeName ?? "??").join(", ")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_meta_severity",
    "Gets all valid severity codes and their descriptions used in line status.",
    {},
    {
      title: "Line Severity Codes",
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
            Array<{
              modeName?: string;
              severityLevel?: number;
              description?: string;
            }>
          >("/Line/Meta/Severity");
          const rows = data.map(
            (s) =>
              `Level ${s.severityLevel ?? "?"} (${s.modeName ?? "?"}): ${s.description ?? "?"}`,
          );
          return `Severity codes:\n\n${rows.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_meta_disruption_categories",
    "Gets all valid disruption category names used by TfL lines.",
    {},
    {
      title: "Disruption Categories",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<string[]>(
            "/Line/Meta/DisruptionCategories",
          );
          return `Disruption categories:\n${data.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_meta_service_types",
    "Gets all valid service types for TfL lines (e.g. Regular, Night).",
    {},
    {
      title: "Line Service Types",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<string[]>(
            "/Line/Meta/ServiceTypes",
          );
          return `Service types: ${data.join(", ")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Line lookup ---
  server.tool(
    "line_search",
    "Search for TfL lines or routes by name or keyword. Returns matching lines with IDs.",
    {
      query: z
        .string()
        .min(1)
        .describe(
          "Search term (e.g. 'Victoria', 'Northern', '25', 'Waterloo')",
        ),
      modes: z
        .string()
        .optional()
        .describe("Comma-separated modes to restrict search (e.g. 'tube,bus')"),
      serviceTypes: z
        .string()
        .optional()
        .describe("Comma-separated service types (e.g. 'Regular,Night')"),
    },
    {
      title: "Line Search",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ query, modes, serviceTypes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<unknown>(
            `/Line/Search/${encodeURIComponent(query)}`,
            { modes, serviceTypes },
          );
          return `Line search results for "${query}":\n\n${JSON.stringify(data, null, 2)}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_by_ids",
    "Gets details for one or more specific TfL lines by their IDs (e.g. 'victoria', 'central', '25').",
    {
      ids: z
        .string()
        .describe(
          "Comma-separated line IDs (e.g. 'victoria,central,jubilee' or '25,73')",
        ),
    },
    {
      title: "Lines by IDs",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ ids }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Line[]>(
            `/Line/${encodeURIComponent(ids)}`,
          );
          return data.map(formatLine).join("\n");
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_by_mode",
    "Gets all lines serving a given transport mode (e.g. all tube lines, all bus lines).",
    {
      modes: z
        .string()
        .describe(
          "Comma-separated transport modes (e.g. 'tube', 'bus', 'dlr', 'overground', 'elizabeth-line')",
        ),
    },
    {
      title: "Lines by Mode",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ modes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Line[]>(
            `/Line/Mode/${encodeURIComponent(modes)}`,
          );
          return `Lines for mode(s) "${modes}" (${data.length} total):\n\n${data.map(formatLine).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Status ---
  server.tool(
    "line_status",
    "Gets current service status for one or more specific lines (e.g. 'Good Service', 'Minor Delays', 'Severe Delays', 'Suspended').",
    {
      ids: z
        .string()
        .describe(
          "Comma-separated line IDs to check (e.g. 'victoria,jubilee,central')",
        ),
      detail: z
        .boolean()
        .optional()
        .describe("If true, include detailed disruption information"),
    },
    {
      title: "Line Status",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ ids, detail }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Line[]>(
            `/Line/${encodeURIComponent(ids)}/Status`,
            { detail },
          );
          return `Current line status:\n\n${data.map(formatLine).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_status_by_mode",
    "Gets current service status for all lines of a given mode (e.g. all tube lines, all DLR lines).",
    {
      modes: z
        .string()
        .describe(
          "Comma-separated modes (e.g. 'tube', 'dlr', 'overground', 'elizabeth-line')",
        ),
      detail: z
        .boolean()
        .optional()
        .describe("If true, include detailed disruption reasons"),
    },
    {
      title: "Line Status by Mode",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ modes, detail }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Line[]>(
            `/Line/Mode/${encodeURIComponent(modes)}/Status`,
            { detail },
          );
          return `Status for ${modes} lines:\n\n${data.map(formatLine).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_status_by_severity",
    "Gets all lines currently at a given severity level. Use line_meta_severity to get severity codes.",
    {
      severity: z
        .number()
        .int()
        .describe(
          "Severity level integer code. Use line_meta_severity to look up available codes.",
        ),
    },
    {
      title: "Line Status by Severity",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ severity }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Line[]>(
            `/Line/Status/${severity}`,
          );
          if (!data.length) return `No lines at severity level ${severity}.`;
          return `Lines at severity ${severity}:\n\n${data.map(formatLine).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_status_by_date_range",
    "Gets service status for specific lines over a date range (useful for checking historical disruptions or planned closures).",
    {
      ids: z
        .string()
        .describe("Comma-separated line IDs (e.g. 'victoria,jubilee')"),
      startDate: z
        .string()
        .describe("Start date in ISO 8601 format (e.g. '2024-03-01T00:00:00')"),
      endDate: z
        .string()
        .describe("End date in ISO 8601 format (e.g. '2024-03-07T23:59:59')"),
      detail: z
        .boolean()
        .optional()
        .describe("Include detailed disruption info"),
    },
    {
      title: "Line Status by Date Range",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ ids, startDate, endDate, detail }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Line[]>(
            `/Line/${encodeURIComponent(ids)}/Status/${encodeURIComponent(startDate)}/to/${encodeURIComponent(endDate)}`,
            { detail },
          );
          return `Status for ${ids} between ${startDate} and ${endDate}:\n\n${data.map(formatLine).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Disruptions ---
  server.tool(
    "line_disruptions",
    "Gets active disruptions for specific lines.",
    {
      ids: z
        .string()
        .describe("Comma-separated line IDs (e.g. 'central,district')"),
    },
    {
      title: "Line Disruptions",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ ids }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Disruption[]>(
            `/Line/${encodeURIComponent(ids)}/Disruption`,
          );
          if (!data.length) return `No active disruptions for lines: ${ids}`;
          return `Disruptions for ${ids}:\n\n${data.map(formatDisruption).join("\n---\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_disruptions_by_mode",
    "Gets all active disruptions across all lines of a given mode.",
    {
      modes: z
        .string()
        .describe("Comma-separated modes (e.g. 'tube', 'bus', 'overground')"),
    },
    {
      title: "Line Disruptions by Mode",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ modes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Disruption[]>(
            `/Line/Mode/${encodeURIComponent(modes)}/Disruption`,
          );
          if (!data.length)
            return `No active disruptions for mode(s): ${modes}`;
          return `Disruptions for ${modes}:\n\n${data.map(formatDisruption).join("\n---\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Routes ---
  server.tool(
    "line_routes",
    "Gets all valid routes for specific lines, including originating and terminating stop names.",
    {
      ids: z
        .string()
        .describe("Comma-separated line IDs (e.g. 'victoria,elizabeth')"),
      serviceTypes: z
        .string()
        .optional()
        .describe("Filter by service type (e.g. 'Regular' or 'Night')"),
    },
    {
      title: "Line Routes",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ ids, serviceTypes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<unknown>(
            `/Line/${encodeURIComponent(ids)}/Route`,
            { serviceTypes },
          );
          return `Routes for ${ids}:\n\n${JSON.stringify(data, null, 2)}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_route_sequence",
    "Gets the ordered sequence of stops for a specific line in a given direction.",
    {
      id: z.string().describe("Line ID (e.g. 'victoria', 'jubilee', '25')"),
      direction: z
        .enum(["inbound", "outbound", "all"])
        .describe("Direction of travel"),
      serviceTypes: z
        .string()
        .optional()
        .describe("Filter by service type (e.g. 'Regular')"),
      excludeCrowding: z
        .boolean()
        .optional()
        .describe("If true, exclude crowding data from the response"),
    },
    {
      title: "Line Route Sequence",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, direction, serviceTypes, excludeCrowding }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<unknown>(
            `/Line/${encodeURIComponent(id)}/Route/Sequence/${direction}`,
            { serviceTypes, excludeCrowding },
          );
          return `Stop sequence for ${id} (${direction}):\n\n${JSON.stringify(data, null, 2)}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_routes_by_mode",
    "Gets all routes for all lines of a given mode.",
    {
      modes: z
        .string()
        .describe("Comma-separated modes (e.g. 'tube,overground')"),
      serviceTypes: z.string().optional().describe("Filter by service type"),
    },
    {
      title: "Line Routes by Mode",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ modes, serviceTypes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Line[]>(
            `/Line/Mode/${encodeURIComponent(modes)}/Route`,
            { serviceTypes },
          );
          return `Routes for mode(s) "${modes}" (${data.length} lines):\n\n${JSON.stringify(data, null, 2)}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_all_routes",
    "Gets all valid routes for all TfL lines.",
    {
      serviceTypes: z
        .string()
        .optional()
        .describe("Filter by service type (e.g. 'Regular' or 'Night')"),
    },
    {
      title: "All Line Routes",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ serviceTypes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<Line[]>("/Line/Route", {
            serviceTypes,
          });
          return `All TfL routes (${data.length} lines):\n\n${data.map((l) => `${l.name ?? l.id ?? "??"} (${l.modeName ?? "?"})`).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Stop points ---
  server.tool(
    "line_stop_points",
    "Gets the list of stations/stops that serve a specific line.",
    {
      id: z.string().describe("Line ID (e.g. 'victoria', 'central', '25')"),
      tflOperatedNationalRailStationsOnly: z
        .boolean()
        .optional()
        .describe("If true, only return TfL-operated national rail stations"),
    },
    {
      title: "Line Stop Points",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, tflOperatedNationalRailStationsOnly }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<
            Array<{ id?: string; commonName?: string }>
          >(`/Line/${encodeURIComponent(id)}/StopPoints`, {
            tflOperatedNationalRailStationsOnly,
          });
          const stops = data.map(
            (s) => `${s.commonName ?? "??"} (${s.id ?? "?"})`,
          );
          return `Stops on ${id} (${data.length} total):\n\n${stops.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Arrivals ---
  server.tool(
    "line_arrivals",
    "Gets live arrival predictions for one or more lines at a specific stop.",
    {
      ids: z
        .string()
        .describe("Comma-separated line IDs (e.g. 'victoria,jubilee')"),
      stopPointId: z
        .string()
        .describe(
          "Stop point ID where you want arrival predictions (e.g. '940GZZLUVIC' for Victoria station)",
        ),
      direction: z
        .enum(["inbound", "outbound", "all"])
        .optional()
        .describe("Filter by direction"),
      destinationStationId: z
        .string()
        .optional()
        .describe("Filter by destination station ID"),
    },
    {
      title: "Line Arrivals",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ ids, stopPointId, direction, destinationStationId }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<ArrivalPrediction[]>(
            `/Line/${encodeURIComponent(ids)}/Arrivals/${encodeURIComponent(stopPointId)}`,
            { direction, destinationStationId },
          );
          if (!data.length)
            return `No arrivals found for lines ${ids} at stop ${stopPointId}.`;
          const sorted = [...data].sort(
            (a, b) => (a.timeToStation ?? 0) - (b.timeToStation ?? 0),
          );
          return `Arrivals for ${ids} at stop ${stopPointId}:\n${sorted.map(formatArrival).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Timetable ---
  server.tool(
    "line_timetable",
    "Gets the scheduled timetable for a specific station on a given line, optionally filtered to a destination.",
    {
      id: z.string().describe("Line ID (e.g. 'victoria', 'central')"),
      fromStopPointId: z
        .string()
        .describe("Origin stop point ID (e.g. '940GZZLUVIC')"),
      toStopPointId: z
        .string()
        .optional()
        .describe(
          "Destination stop point ID — if provided, shows timetable towards that destination",
        ),
    },
    {
      title: "Line Timetable",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, fromStopPointId, toStopPointId }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const path = toStopPointId
            ? `/Line/${encodeURIComponent(id)}/Timetable/${encodeURIComponent(fromStopPointId)}/to/${encodeURIComponent(toStopPointId)}`
            : `/Line/${encodeURIComponent(id)}/Timetable/${encodeURIComponent(fromStopPointId)}`;
          const data = yield* client.request<unknown>(path);
          return `Timetable for line ${id} from ${fromStopPointId}${toStopPointId ? ` to ${toStopPointId}` : ""}:\n\n${JSON.stringify(data, null, 2)}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
