import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { TflClient } from "../../domain/TflClient.ts";
import { type ArrivalPrediction, formatArrival } from "../arrivals.ts";
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

const formatLine = (line: Line): string => {
  const statuses =
    line.lineStatuses
      ?.map((s) => `${s.statusSeverityDescription ?? "?"}${s.reason ? `: ${s.reason}` : ""}`)
      .join("; ") ?? "No status";
  return `${line.name ?? line.id ?? "Unknown"} (${line.modeName ?? "?"}) — ${statuses}`;
};

const formatDisruption = (d: Disruption): string =>
  [
    `Category: ${d.category ?? "Unknown"}`,
    `Type: ${d.type ?? "Unknown"}`,
    `Description: ${d.description ?? "None"}`,
  ].join("\n");

export const registerLineTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
) => {
  // --- Line lookup ---
  server.tool(
    "line_search",
    "Search for TfL lines or routes by name or keyword. Returns matching lines with IDs.",
    {
      query: z
        .string()
        .min(1)
        .describe("Search term (e.g. 'Victoria', 'Northern', '25', 'Waterloo')"),
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
          const data = yield* client.request<{
            input?: string;
            searchMatches?: Array<{ lineId?: string; lineName?: string; modeName?: string }>;
          }>(`/Line/Search/${encodeURIComponent(query)}`, { modes, serviceTypes });
          const matches = data.searchMatches ?? [];
          if (!matches.length) return `No lines found matching "${query}".`;
          const lines = matches.map(
            (m) =>
              `${m.lineName ?? m.lineId ?? "?"} (${m.modeName ?? "?"}) — ID: ${m.lineId ?? "?"}`,
          );
          return `Line search results for "${query}" (${matches.length}):\n\n${lines.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "line_lookup",
    "Gets details for one or more TfL lines by their IDs, or all lines for a given mode. Valid modes: tube, bus, dlr, overground, elizabeth-line, national-rail, tflrail, tram, cable-car.",
    {
      ids: z
        .string()
        .optional()
        .describe("Comma-separated line IDs (e.g. 'victoria,central,jubilee' or '25,73')"),
      modes: z
        .string()
        .optional()
        .describe(
          "Comma-separated transport modes (e.g. 'tube', 'bus', 'dlr'). Use instead of ids to get all lines for a mode.",
        ),
    },
    {
      title: "Line Lookup",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ ids, modes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          if (modes) {
            const data = yield* client.request<Line[]>(`/Line/Mode/${encodeURIComponent(modes)}`);
            return `Lines for mode(s) "${modes}" (${data.length} total):\n\n${data.map(formatLine).join("\n")}`;
          }
          const data = yield* client.request<Line[]>(`/Line/${encodeURIComponent(ids ?? "")}`);
          return data.map(formatLine).join("\n");
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Status ---
  server.tool(
    "line_status",
    "Gets current service status for TfL lines. Can query by line IDs, mode, severity level, or date range. Severity codes: 10=Good Service, 9=Reduced Service, 6=Severe Delays, 5=Part Closure, 4=Planned Closure, 2=Suspended, 0=Special Service. Service types: Regular, Night.",
    {
      ids: z
        .string()
        .optional()
        .describe(
          "Comma-separated line IDs (e.g. 'victoria,jubilee'). Modes: tube, bus, dlr, overground, elizabeth-line",
        ),
      modes: z
        .string()
        .optional()
        .describe(
          "Comma-separated modes (e.g. 'tube,dlr'). Use instead of ids to get all lines for a mode.",
        ),
      severity: z.coerce
        .number()
        .int()
        .optional()
        .describe(
          "Severity code: 10=Good Service, 9=Reduced Service, 6=Severe Delays, 5=Part Closure, 4=Planned Closure, 2=Suspended, 0=Special Service",
        ),
      startDate: z
        .string()
        .optional()
        .describe("Start of date range, ISO 8601 (e.g. '2024-03-01T00:00:00'). Requires ids."),
      endDate: z
        .string()
        .optional()
        .describe("End of date range, ISO 8601 (e.g. '2024-03-07T23:59:59'). Requires ids."),
      detail: z.boolean().optional().describe("Include detailed disruption info"),
    },
    {
      title: "Line Status",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ ids, modes, severity, startDate, endDate, detail }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          if (severity !== undefined) {
            const data = yield* client.request<Line[]>(`/Line/Status/${severity}`);
            if (!data.length) return `No lines at severity level ${severity}.`;
            return `Lines at severity ${severity}:\n\n${data.map(formatLine).join("\n")}`;
          }
          if (ids && startDate && endDate) {
            const toIso = (d: string): string =>
              d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
            const start = toIso(startDate);
            const end = toIso(endDate);
            const data = yield* client.request<Line[]>(
              `/Line/${encodeURIComponent(ids)}/Status/${encodeURIComponent(start)}/to/${encodeURIComponent(end)}`,
              { detail },
            );
            return `Status for ${ids} between ${start} and ${end}:\n\n${data.map(formatLine).join("\n")}`;
          }
          if (modes) {
            const data = yield* client.request<Line[]>(
              `/Line/Mode/${encodeURIComponent(modes)}/Status`,
              { detail },
            );
            return `Status for ${modes} lines:\n\n${data.map(formatLine).join("\n")}`;
          }
          const data = yield* client.request<Line[]>(
            `/Line/${encodeURIComponent(ids ?? "")}/Status`,
            { detail },
          );
          return `Current line status:\n\n${data.map(formatLine).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Disruptions ---
  server.tool(
    "line_disruptions",
    "Gets active disruptions for specific lines or all lines of a given mode.",
    {
      ids: z.string().optional().describe("Comma-separated line IDs (e.g. 'central,district')"),
      modes: z
        .string()
        .optional()
        .describe(
          "Comma-separated modes (e.g. 'tube', 'bus', 'overground'). Use instead of ids to get disruptions for all lines of a mode.",
        ),
    },
    {
      title: "Line Disruptions",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ ids, modes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          if (modes) {
            const data = yield* client.request<Disruption[]>(
              `/Line/Mode/${encodeURIComponent(modes)}/Disruption`,
            );
            if (!data.length) return `No active disruptions for mode(s): ${modes}`;
            return `Disruptions for ${modes}:\n\n${data.map(formatDisruption).join("\n---\n")}`;
          }
          const data = yield* client.request<Disruption[]>(
            `/Line/${encodeURIComponent(ids ?? "")}/Disruption`,
          );
          if (!data.length) return `No active disruptions for lines: ${ids}`;
          return `Disruptions for ${ids}:\n\n${data.map(formatDisruption).join("\n---\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  // --- Routes ---
  server.tool(
    "line_routes",
    "Gets valid routes for specific lines, all lines of a mode, or all TfL lines. Service types: Regular, Night.",
    {
      ids: z.string().optional().describe("Comma-separated line IDs (e.g. 'victoria,elizabeth')"),
      modes: z
        .string()
        .optional()
        .describe(
          "Comma-separated modes (e.g. 'tube,overground'). Use instead of ids to get routes for all lines of a mode.",
        ),
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
    async ({ ids, modes, serviceTypes }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          type RouteSection = {
            name?: string;
            direction?: string;
            originator?: string;
            originationName?: string;
            destination?: string;
            destinationName?: string;
            serviceType?: string;
          };
          type LineWithRoutes = Line & { routeSections?: RouteSection[] };
          if (modes) {
            const data = yield* client.request<Line[]>(
              `/Line/Mode/${encodeURIComponent(modes)}/Route`,
              { serviceTypes },
            );
            if (!data.length) return `No routes found for mode(s): ${modes}`;
            const lines = data.map(
              (l) => `${l.name ?? l.id ?? "?"} (${l.modeName ?? "?"}) — ID: ${l.id ?? "?"}`,
            );
            return `Routes for mode(s) "${modes}" (${data.length} lines):\n\n${lines.join("\n")}`;
          }
          if (ids) {
            const data = yield* client.request<LineWithRoutes[]>(
              `/Line/${encodeURIComponent(ids)}/Route`,
              { serviceTypes },
            );
            if (!data.length) return `No routes found for lines: ${ids}`;
            const sections = data.flatMap((line) =>
              (line.routeSections ?? []).map(
                (r) =>
                  `${line.name ?? line.id ?? "?"} (${r.serviceType ?? "Regular"}) ${r.direction ?? "?"}: ${r.originationName ?? r.originator ?? "?"} → ${r.destinationName ?? r.destination ?? "?"}`,
              ),
            );
            return sections.length
              ? `Routes for ${ids} (${sections.length} sections):\n\n${sections.join("\n")}`
              : `Lines found but no route sections for: ${ids}`;
          }
          const data = yield* client.request<Line[]>("/Line/Route", { serviceTypes });
          return `All TfL routes (${data.length} lines):\n\n${data.map((l) => `${l.name ?? l.id ?? "??"} (${l.modeName ?? "?"})`).join("\n")}`;
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
      direction: z.enum(["inbound", "outbound", "all"]).describe("Direction of travel"),
      serviceTypes: z.string().optional().describe("Filter by service type (e.g. 'Regular')"),
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
          const data = yield* client.request<{
            lineId?: string;
            lineName?: string;
            direction?: string;
            stopPointSequences?: Array<{
              direction?: string;
              branchId?: number;
              nextBranchIds?: number[];
              prevBranchIds?: number[];
              stopPoint?: Array<{ id?: string; name?: string; stopLetter?: string }>;
            }>;
            orderedLineRoutes?: Array<{ name?: string; naptanIds?: string[] }>;
          }>(`/Line/${encodeURIComponent(id)}/Route/Sequence/${direction}`, {
            serviceTypes,
            excludeCrowding,
          });
          const sequences = data.stopPointSequences ?? [];
          if (!sequences.length)
            return `No stop sequence found for ${data.lineName ?? id} (${direction}).`;
          const sections = sequences.map((seq, i) => {
            const stops = (seq.stopPoint ?? []).map((s) => s.name ?? s.id ?? "?").join(" → ");
            return `Branch ${seq.branchId ?? i + 1} (${seq.direction ?? direction}): ${stops}`;
          });
          return `Stop sequence for ${data.lineName ?? id} (${direction}):\n\n${sections.join("\n\n")}`;
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
          const data = yield* client.request<Array<{ id?: string; commonName?: string }>>(
            `/Line/${encodeURIComponent(id)}/StopPoints`,
            {
              tflOperatedNationalRailStationsOnly,
            },
          );
          const stops = data.map((s) => `${s.commonName ?? "??"} (${s.id ?? "?"})`);
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
      ids: z.string().describe("Comma-separated line IDs (e.g. 'victoria,jubilee')"),
      stopPointId: z
        .string()
        .describe(
          "Stop point ID where you want arrival predictions (e.g. '940GZZLUVIC' for Victoria station)",
        ),
      direction: z.enum(["inbound", "outbound", "all"]).optional().describe("Filter by direction"),
      destinationStationId: z.string().optional().describe("Filter by destination station ID"),
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
          if (!data.length) return `No arrivals found for lines ${ids} at stop ${stopPointId}.`;
          const sorted = [...data].sort((a, b) => (a.timeToStation ?? 0) - (b.timeToStation ?? 0));
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
      fromStopPointId: z.string().describe("Origin stop point ID (e.g. '940GZZLUVIC')"),
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
