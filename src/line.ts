import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, tflRequest } from "./client.js";

interface LineStatus {
	statusSeverityDescription?: string;
	reason?: string;
}

interface Line {
	id?: string;
	name?: string;
	modeName?: string;
	lineStatuses?: LineStatus[];
}

interface Disruption {
	category?: string;
	type?: string;
	description?: string;
	affectedRoutes?: Array<{ name?: string }>;
	affectedStops?: Array<{ commonName?: string }>;
}

interface ArrivalPrediction {
	vehicleId?: string;
	lineName?: string;
	platformName?: string;
	destinationName?: string;
	expectedArrival?: string;
	timeToStation?: number;
}

function formatLine(line: Line): string {
	const statuses =
		line.lineStatuses
			?.map(
				(s) =>
					`${s.statusSeverityDescription ?? "?"}${s.reason ? `: ${s.reason}` : ""}`,
			)
			.join("; ") ?? "No status";
	return `${line.name ?? line.id ?? "Unknown"} (${line.modeName ?? "?"}) — ${statuses}`;
}

function formatDisruption(d: Disruption): string {
	return [
		`Category: ${d.category ?? "Unknown"}`,
		`Type: ${d.type ?? "Unknown"}`,
		`Description: ${d.description ?? "None"}`,
	].join("\n");
}

function formatArrival(a: ArrivalPrediction): string {
	const mins =
		a.timeToStation != null ? Math.round(a.timeToStation / 60) : null;
	return `  → ${a.destinationName ?? "?"} via ${a.platformName ?? "?"} — ${mins != null ? `${mins} min` : (a.expectedArrival ?? "?")}`;
}

export function registerLineTools(server: McpServer): void {
	// --- Meta ---
	server.registerTool(
		"line_meta_modes",
		{
			description:
				"Gets all valid line modes (e.g. tube, bus, dlr, overground, elizabeth-line, tram, cable-car).",
			inputSchema: {},
		},
		async () => {
			try {
				const data =
					await tflRequest<Array<{ modeName?: string }>>("/Line/Meta/Modes");
				const modes = data.map((m) => m.modeName ?? "??").join(", ");
				return {
					content: [
						{ type: "text" as const, text: `Available line modes: ${modes}` },
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"line_meta_severity",
		{
			description:
				"Gets all valid severity codes and their descriptions used in line status.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<
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
				return {
					content: [
						{
							type: "text" as const,
							text: `Severity codes:\n\n${rows.join("\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"line_meta_disruption_categories",
		{
			description:
				"Gets all valid disruption category names used by TfL lines.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<string[]>(
					"/Line/Meta/DisruptionCategories",
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Disruption categories:\n${data.join("\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"line_meta_service_types",
		{
			description:
				"Gets all valid service types for TfL lines (e.g. Regular, Night).",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<string[]>("/Line/Meta/ServiceTypes");
				return {
					content: [
						{
							type: "text" as const,
							text: `Service types: ${data.join(", ")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	// --- Line lookup ---
	server.registerTool(
		"line_search",
		{
			description:
				"Search for TfL lines or routes by name or keyword. Returns matching lines with IDs.",
			inputSchema: {
				query: z
					.string()
					.min(1)
					.describe(
						"Search term (e.g. 'Victoria', 'Northern', '25', 'Waterloo')",
					),
				modes: z
					.string()
					.optional()
					.describe(
						"Comma-separated modes to restrict search (e.g. 'tube,bus')",
					),
				serviceTypes: z
					.string()
					.optional()
					.describe("Comma-separated service types (e.g. 'Regular,Night')"),
			},
		},
		async ({ query, modes, serviceTypes }) => {
			try {
				const data = await tflRequest<unknown>(
					`/Line/Search/${encodeURIComponent(query)}`,
					{ modes, serviceTypes },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Line search results for "${query}":\n\n${JSON.stringify(data, null, 2)}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"line_by_ids",
		{
			description:
				"Gets details for one or more specific TfL lines by their IDs (e.g. 'victoria', 'central', '25').",
			inputSchema: {
				ids: z
					.string()
					.describe(
						"Comma-separated line IDs (e.g. 'victoria,central,jubilee' or '25,73')",
					),
			},
		},
		async ({ ids }) => {
			try {
				const data = await tflRequest<Line[]>(
					`/Line/${encodeURIComponent(ids)}`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: data.map(formatLine).join("\n"),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"line_by_mode",
		{
			description:
				"Gets all lines serving a given transport mode (e.g. all tube lines, all bus lines).",
			inputSchema: {
				modes: z
					.string()
					.describe(
						"Comma-separated transport modes (e.g. 'tube', 'bus', 'dlr', 'overground', 'elizabeth-line')",
					),
			},
		},
		async ({ modes }) => {
			try {
				const data = await tflRequest<Line[]>(
					`/Line/Mode/${encodeURIComponent(modes)}`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Lines for mode(s) "${modes}" (${data.length} total):\n\n${data.map(formatLine).join("\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	// --- Status ---
	server.registerTool(
		"line_status",
		{
			description:
				"Gets current service status for one or more specific lines (e.g. 'Good Service', 'Minor Delays', 'Severe Delays', 'Suspended').",
			inputSchema: {
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
		},
		async ({ ids, detail }) => {
			try {
				const data = await tflRequest<Line[]>(
					`/Line/${encodeURIComponent(ids)}/Status`,
					{ detail },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Current line status:\n\n${data.map(formatLine).join("\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"line_status_by_mode",
		{
			description:
				"Gets current service status for all lines of a given mode (e.g. all tube lines, all DLR lines).",
			inputSchema: {
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
		},
		async ({ modes, detail }) => {
			try {
				const data = await tflRequest<Line[]>(
					`/Line/Mode/${encodeURIComponent(modes)}/Status`,
					{ detail },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Status for ${modes} lines:\n\n${data.map(formatLine).join("\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"line_status_by_severity",
		{
			description:
				"Gets all lines currently at a given severity level (e.g. all lines with severe delays). Use line_meta_severity to get severity codes.",
			inputSchema: {
				severity: z
					.number()
					.int()
					.describe(
						"Severity level integer code. Use line_meta_severity to look up available codes.",
					),
			},
		},
		async ({ severity }) => {
			try {
				const data = await tflRequest<Line[]>(`/Line/Status/${severity}`);
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No lines at severity level ${severity}.`,
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text" as const,
							text: `Lines at severity ${severity}:\n\n${data.map(formatLine).join("\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"line_status_by_date_range",
		{
			description:
				"Gets service status for specific lines over a date range (useful for checking historical disruptions or planned closures).",
			inputSchema: {
				ids: z
					.string()
					.describe("Comma-separated line IDs (e.g. 'victoria,jubilee')"),
				startDate: z
					.string()
					.describe(
						"Start date in ISO 8601 format (e.g. '2024-03-01T00:00:00')",
					),
				endDate: z
					.string()
					.describe("End date in ISO 8601 format (e.g. '2024-03-07T23:59:59')"),
				detail: z
					.boolean()
					.optional()
					.describe("Include detailed disruption info"),
			},
		},
		async ({ ids, startDate, endDate, detail }) => {
			try {
				const data = await tflRequest<Line[]>(
					`/Line/${encodeURIComponent(ids)}/Status/${encodeURIComponent(startDate)}/to/${encodeURIComponent(endDate)}`,
					{ detail },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Status for ${ids} between ${startDate} and ${endDate}:\n\n${data.map(formatLine).join("\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	// --- Disruptions ---
	server.registerTool(
		"line_disruptions",
		{
			description: "Gets active disruptions for specific lines.",
			inputSchema: {
				ids: z
					.string()
					.describe("Comma-separated line IDs (e.g. 'central,district')"),
			},
		},
		async ({ ids }) => {
			try {
				const data = await tflRequest<Disruption[]>(
					`/Line/${encodeURIComponent(ids)}/Disruption`,
				);
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No active disruptions for lines: ${ids}`,
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text" as const,
							text: `Disruptions for ${ids}:\n\n${data.map(formatDisruption).join("\n---\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"line_disruptions_by_mode",
		{
			description:
				"Gets all active disruptions across all lines of a given mode.",
			inputSchema: {
				modes: z
					.string()
					.describe("Comma-separated modes (e.g. 'tube', 'bus', 'overground')"),
			},
		},
		async ({ modes }) => {
			try {
				const data = await tflRequest<Disruption[]>(
					`/Line/Mode/${encodeURIComponent(modes)}/Disruption`,
				);
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No active disruptions for mode(s): ${modes}`,
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text" as const,
							text: `Disruptions for ${modes}:\n\n${data.map(formatDisruption).join("\n---\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	// --- Routes ---
	server.registerTool(
		"line_routes",
		{
			description:
				"Gets all valid routes for specific lines, including originating and terminating stop names.",
			inputSchema: {
				ids: z
					.string()
					.describe("Comma-separated line IDs (e.g. 'victoria,elizabeth')"),
				serviceTypes: z
					.string()
					.optional()
					.describe("Filter by service type (e.g. 'Regular' or 'Night')"),
			},
		},
		async ({ ids, serviceTypes }) => {
			try {
				const data = await tflRequest<unknown>(
					`/Line/${encodeURIComponent(ids)}/Route`,
					{ serviceTypes },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Routes for ${ids}:\n\n${JSON.stringify(data, null, 2)}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"line_route_sequence",
		{
			description:
				"Gets the ordered sequence of stops for a specific line in a given direction. Useful for showing the full list of stations on a line.",
			inputSchema: {
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
		},
		async ({ id, direction, serviceTypes, excludeCrowding }) => {
			try {
				const data = await tflRequest<unknown>(
					`/Line/${encodeURIComponent(id)}/Route/Sequence/${direction}`,
					{ serviceTypes, excludeCrowding },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Stop sequence for ${id} (${direction}):\n\n${JSON.stringify(data, null, 2)}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"line_routes_by_mode",
		{
			description: "Gets all routes for all lines of a given mode.",
			inputSchema: {
				modes: z
					.string()
					.describe("Comma-separated modes (e.g. 'tube,overground')"),
				serviceTypes: z.string().optional().describe("Filter by service type"),
			},
		},
		async ({ modes, serviceTypes }) => {
			try {
				const data = await tflRequest<Line[]>(
					`/Line/Mode/${encodeURIComponent(modes)}/Route`,
					{ serviceTypes },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Routes for mode(s) "${modes}" (${data.length} lines):\n\n${JSON.stringify(data, null, 2)}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"line_all_routes",
		{
			description: "Gets all valid routes for all TfL lines.",
			inputSchema: {
				serviceTypes: z
					.string()
					.optional()
					.describe("Filter by service type (e.g. 'Regular' or 'Night')"),
			},
		},
		async ({ serviceTypes }) => {
			try {
				const data = await tflRequest<Line[]>("/Line/Route", { serviceTypes });
				return {
					content: [
						{
							type: "text" as const,
							text: `All TfL routes (${data.length} lines):\n\n${data.map((l) => `${l.name ?? l.id ?? "??"} (${l.modeName ?? "?"})`).join("\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	// --- Stop points ---
	server.registerTool(
		"line_stop_points",
		{
			description:
				"Gets the list of stations/stops that serve a specific line.",
			inputSchema: {
				id: z.string().describe("Line ID (e.g. 'victoria', 'central', '25')"),
				tflOperatedNationalRailStationsOnly: z
					.boolean()
					.optional()
					.describe("If true, only return TfL-operated national rail stations"),
			},
		},
		async ({ id, tflOperatedNationalRailStationsOnly }) => {
			try {
				const data = await tflRequest<
					Array<{
						id?: string;
						commonName?: string;
						lat?: number;
						lon?: number;
					}>
				>(`/Line/${encodeURIComponent(id)}/StopPoints`, {
					tflOperatedNationalRailStationsOnly,
				});
				const stops = data.map(
					(s) => `${s.commonName ?? "??"} (${s.id ?? "?"})`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Stops on ${id} (${data.length} total):\n\n${stops.join("\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	// --- Arrivals ---
	server.registerTool(
		"line_arrivals",
		{
			description:
				"Gets live arrival predictions for one or more lines at a specific stop.",
			inputSchema: {
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
		},
		async ({ ids, stopPointId, direction, destinationStationId }) => {
			try {
				const data = await tflRequest<ArrivalPrediction[]>(
					`/Line/${encodeURIComponent(ids)}/Arrivals/${encodeURIComponent(stopPointId)}`,
					{ direction, destinationStationId },
				);
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No arrivals found for lines ${ids} at stop ${stopPointId}.`,
							},
						],
					};
				}
				const sorted = [...data].sort(
					(a, b) => (a.timeToStation ?? 0) - (b.timeToStation ?? 0),
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Arrivals for ${ids} at stop ${stopPointId}:\n${sorted.map(formatArrival).join("\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	// --- Timetable ---
	server.registerTool(
		"line_timetable",
		{
			description:
				"Gets the scheduled timetable for a specific station on a given line, optionally filtered to a destination.",
			inputSchema: {
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
		},
		async ({ id, fromStopPointId, toStopPointId }) => {
			try {
				const path = toStopPointId
					? `/Line/${encodeURIComponent(id)}/Timetable/${encodeURIComponent(fromStopPointId)}/to/${encodeURIComponent(toStopPointId)}`
					: `/Line/${encodeURIComponent(id)}/Timetable/${encodeURIComponent(fromStopPointId)}`;
				const data = await tflRequest<unknown>(path);
				return {
					content: [
						{
							type: "text" as const,
							text: `Timetable for line ${id} from ${fromStopPointId}${toStopPointId ? ` to ${toStopPointId}` : ""}:\n\n${JSON.stringify(data, null, 2)}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);
}
