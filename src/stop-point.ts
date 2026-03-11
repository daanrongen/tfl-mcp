import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, tflRequest } from "./client.js";

interface StopPoint {
	id?: string;
	naptanId?: string;
	icsCode?: string;
	commonName?: string;
	stopType?: string;
	lat?: number;
	lon?: number;
	modes?: string[];
	lines?: Array<{ id?: string; name?: string }>;
	additionalProperties?: Array<{ key?: string; value?: string }>;
}

interface ArrivalPrediction {
	vehicleId?: string;
	naptanId?: string;
	stationName?: string;
	lineName?: string;
	lineId?: string;
	platformName?: string;
	direction?: string;
	destinationName?: string;
	destinationNaptanId?: string;
	timeToStation?: number;
	expectedArrival?: string;
	modeName?: string;
}

/** Canonical ID to use in journey planner: prefer ICS code, then naptanId, then id */
function stopId(s: StopPoint): string {
	return s.icsCode ?? s.naptanId ?? s.id ?? "?";
}

function formatStop(s: StopPoint): string {
	const modes = s.modes?.join(", ") ?? "?";
	const lines = s.lines?.map((l) => l.name ?? l.id).join(", ") ?? "";
	const id = stopId(s);
	return `${s.commonName ?? "??"} — ID: ${id} — ${s.stopType ?? "?"} — modes: ${modes}${lines ? ` — lines: ${lines}` : ""}`;
}

function formatArrival(a: ArrivalPrediction): string {
	const mins =
		a.timeToStation != null ? Math.round(a.timeToStation / 60) : null;
	return `  ${a.lineName ?? "?"} → ${a.destinationName ?? "?"} via ${a.platformName ?? "?"} — ${mins != null ? `${mins} min` : (a.expectedArrival ?? "?")}`;
}

export function registerStopPointTools(server: McpServer): void {
	// --- Meta ---
	server.registerTool(
		"tfl_stoppoint_meta_modes",
		{
			description:
				"Gets the list of all transport modes available at TfL stop points.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<
					Array<{ modeName?: string; isTflService?: boolean }>
				>("/StopPoint/Meta/Modes");
				const modes = data.map(
					(m) => `${m.modeName ?? "?"} (TfL: ${m.isTflService ?? false})`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `StopPoint modes:\n\n${modes.join("\n")}`,
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
		"tfl_stoppoint_meta_stop_types",
		{
			description:
				"Gets all valid stop point types (e.g. NaptanMetroStation, NaptanPublicBusCoachTram, NaptanRailStation).",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<string[]>("/StopPoint/Meta/StopTypes");
				return {
					content: [
						{
							type: "text" as const,
							text: `Stop point types:\n\n${data.join("\n")}`,
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
		"tfl_stoppoint_meta_categories",
		{
			description:
				"Gets the list of available additional information categories for stop points.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<unknown>("/StopPoint/Meta/Categories");
				return {
					content: [
						{
							type: "text" as const,
							text: `StopPoint categories:\n\n${JSON.stringify(data, null, 2)}`,
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

	// --- Lookup ---
	server.registerTool(
		"tfl_stoppoint_search",
		{
			description:
				"Search for TfL stop points (stations, bus stops) by name or 5-digit bus stop SMS code.\n\n" +
				"The returned 'ID' field is the ICS code — use this as the from/to value in tfl_journey_plan for unambiguous results.",
			inputSchema: {
				query: z
					.string()
					.min(1)
					.describe(
						"Stop name, partial name, or 5-digit bus stop SMS code (e.g. 'Victoria', 'Kings Cross', '73241')",
					),
				modes: z
					.string()
					.optional()
					.describe("Comma-separated mode filters (e.g. 'tube,bus,dlr')"),
				maxResults: z
					.number()
					.int()
					.optional()
					.describe("Maximum number of results (default: 50)"),
				lines: z
					.string()
					.optional()
					.describe("Comma-separated line IDs to filter by"),
				faresOnly: z
					.boolean()
					.optional()
					.describe("If true, only return stops where fares apply"),
				includeHubs: z
					.boolean()
					.optional()
					.describe("If true, include interchange hub stops"),
				tflOperatedNationalRailStationsOnly: z
					.boolean()
					.optional()
					.describe("If true, only return TfL-operated national rail stations"),
			},
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
			try {
				// TfL returns { matches: StopPoint[], total: number } for /StopPoint/Search
				const data = await tflRequest<{
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
				if (!matches.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No stop points found matching "${query}".`,
							},
						],
					};
				}
				const header = `Stop points matching "${query}" (${matches.length} of ${data.total ?? "?"}):\n(Use the 'ID' value in tfl_journey_plan for unambiguous routing)\n`;
				return {
					content: [
						{
							type: "text" as const,
							text: `${header}\n${matches.map(formatStop).join("\n")}`,
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
		"tfl_stoppoint_by_ids",
		{
			description:
				"Gets full details for one or more stop points by their Naptan IDs.",
			inputSchema: {
				ids: z
					.string()
					.describe(
						"Comma-separated Naptan stop IDs (e.g. '940GZZLUVIC' for Victoria tube, '490000173RG' for a bus stop). Use tfl_stoppoint_search to find IDs.",
					),
				includeCrowdingData: z
					.boolean()
					.optional()
					.describe("If true, include crowding data in the response"),
			},
		},
		async ({ ids, includeCrowdingData }) => {
			try {
				const data = await tflRequest<StopPoint[]>(
					`/StopPoint/${encodeURIComponent(ids)}`,
					{ includeCrowdingData },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Stop point details:\n\n${data.map(formatStop).join("\n")}`,
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
		"tfl_stoppoint_by_sms",
		{
			description:
				"Gets a stop point by its 5-digit SMS bus stop code (used for TfL's SMS arrival checker service).",
			inputSchema: {
				id: z
					.string()
					.length(5)
					.describe("5-digit SMS bus stop code (e.g. '73241')"),
				output: z
					.string()
					.optional()
					.describe("Output format (leave blank for default)"),
			},
		},
		async ({ id, output }) => {
			try {
				const data = await tflRequest<StopPoint>(
					`/StopPoint/Sms/${encodeURIComponent(id)}`,
					{ output },
				);
				return {
					content: [{ type: "text" as const, text: formatStop(data) }],
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
		"tfl_stoppoint_by_geo",
		{
			description:
				"Gets stop points within a radius of given coordinates, filtered by stop type. Essential for finding nearby stations or bus stops.",
			inputSchema: {
				lat: z.number().describe("Latitude"),
				lon: z.number().describe("Longitude"),
				stopTypes: z
					.string()
					.describe(
						"Comma-separated stop type(s) (e.g. 'NaptanMetroStation,NaptanPublicBusCoachTram'). Use tfl_stoppoint_meta_stop_types for available types.",
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
			try {
				const data = await tflRequest<{ stopPoints?: StopPoint[] }>(
					"/StopPoint",
					{
						"location.lat": lat,
						"location.lon": lon,
						stopTypes,
						radius,
						modes,
						useStopPointHierarchy,
						categories,
						returnLines,
					},
				);
				const stops = data.stopPoints ?? [];
				if (!stops.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No stop points found near (${lat}, ${lon}) within ${radius ?? 200}m.`,
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text" as const,
							text: `Stop points near (${lat}, ${lon}) within ${radius ?? 200}m (${stops.length}):\n\n${stops.map(formatStop).join("\n")}`,
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
		"tfl_stoppoint_by_mode",
		{
			description:
				"Gets all stop points filtered by transport mode (e.g. all tube stations, all DLR stops). Supports pagination.",
			inputSchema: {
				modes: z
					.string()
					.describe("Comma-separated modes (e.g. 'tube', 'dlr', 'overground')"),
				page: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Page number for pagination (default: 1)"),
			},
		},
		async ({ modes, page }) => {
			try {
				const data = await tflRequest<StopPoint[]>(
					`/StopPoint/Mode/${encodeURIComponent(modes)}`,
					{ page },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Stop points for mode(s) "${modes}" (page ${page ?? 1}, ${data.length} results):\n\n${data.map(formatStop).join("\n")}`,
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
		"tfl_stoppoint_by_type",
		{
			description:
				"Gets all stop points of a specific type, with optional pagination.",
			inputSchema: {
				types: z
					.string()
					.describe(
						"Comma-separated stop types (e.g. 'NaptanMetroStation'). Use tfl_stoppoint_meta_stop_types to list valid types.",
					),
				page: z
					.number()
					.int()
					.optional()
					.describe("Page number for large result sets"),
			},
		},
		async ({ types, page }) => {
			try {
				const path = page
					? `/StopPoint/Type/${encodeURIComponent(types)}/page/${page}`
					: `/StopPoint/Type/${encodeURIComponent(types)}`;
				const data = await tflRequest<StopPoint[]>(path);
				return {
					content: [
						{
							type: "text" as const,
							text: `Stop points of type "${types}" (${data.length}):\n\n${data.map(formatStop).join("\n")}`,
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
		"tfl_stoppoint_service_types",
		{
			description:
				"Gets the service types (Regular, Night) available at a specific stop point, optionally filtered by lines and modes.",
			inputSchema: {
				id: z.string().describe("Stop point Naptan ID"),
				lineIds: z
					.string()
					.optional()
					.describe("Comma-separated line IDs to filter by"),
				modes: z
					.string()
					.optional()
					.describe("Comma-separated modes to filter by"),
			},
		},
		async ({ id, lineIds, modes }) => {
			try {
				const data = await tflRequest<unknown>("/StopPoint/ServiceTypes", {
					id,
					lineIds,
					modes,
				});
				return {
					content: [
						{
							type: "text" as const,
							text: `Service types at stop ${id}:\n\n${JSON.stringify(data, null, 2)}`,
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
		"tfl_stoppoint_arrivals",
		{
			description:
				"Gets live arrival predictions for all lines at a given stop point. The most useful real-time departure board tool.",
			inputSchema: {
				id: z
					.string()
					.describe(
						"Stop point Naptan ID (e.g. '940GZZLUVIC' for Victoria tube, '490000173RG' for a bus stop). Use tfl_stoppoint_search to find IDs.",
					),
			},
		},
		async ({ id }) => {
			try {
				const data = await tflRequest<ArrivalPrediction[]>(
					`/StopPoint/${encodeURIComponent(id)}/Arrivals`,
				);
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No arrivals currently predicted at stop ${id}.`,
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
							text: `Arrivals at ${data[0]?.stationName ?? id}:\n${sorted.map(formatArrival).join("\n")}`,
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
		"tfl_stoppoint_arrival_departures",
		{
			description:
				"Gets live arrival AND departure predictions for a stop point (Overground and Elizabeth line only), optionally filtered by line.",
			inputSchema: {
				id: z.string().describe("Stop point Naptan ID"),
				lineIds: z
					.string()
					.optional()
					.describe(
						"Comma-separated line IDs to filter (e.g. 'london-overground,elizabeth')",
					),
			},
		},
		async ({ id, lineIds }) => {
			try {
				const data = await tflRequest<unknown[]>(
					`/StopPoint/${encodeURIComponent(id)}/ArrivalDepartures`,
					{ lineIds },
				);
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No arrivals/departures at stop ${id}.`,
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text" as const,
							text: `Arrival/Departures at ${id}:\n\n${JSON.stringify(data, null, 2)}`,
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
		"tfl_stoppoint_disruptions",
		{
			description: "Gets all active disruptions at one or more stop points.",
			inputSchema: {
				ids: z.string().describe("Comma-separated stop point Naptan IDs"),
				getFamily: z
					.boolean()
					.optional()
					.describe("If true, include disruptions for child stops"),
				includeRouteBlockedStops: z
					.boolean()
					.optional()
					.describe("If true, include stops where the route is blocked"),
				flattenResponse: z
					.boolean()
					.optional()
					.describe("If true, return a flat list rather than nested structure"),
			},
		},
		async ({ ids, getFamily, includeRouteBlockedStops, flattenResponse }) => {
			try {
				const data = await tflRequest<unknown>(
					`/StopPoint/${encodeURIComponent(ids)}/Disruption`,
					{ getFamily, includeRouteBlockedStops, flattenResponse },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Disruptions at ${ids}:\n\n${JSON.stringify(data, null, 2)}`,
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
		"tfl_stoppoint_disruptions_by_mode",
		{
			description: "Gets all disrupted stop points for a given transport mode.",
			inputSchema: {
				modes: z.string().describe("Comma-separated modes (e.g. 'tube,dlr')"),
				includeRouteBlockedStops: z
					.boolean()
					.optional()
					.describe("If true, include route-blocked stops"),
			},
		},
		async ({ modes, includeRouteBlockedStops }) => {
			try {
				const data = await tflRequest<StopPoint[]>(
					`/StopPoint/Mode/${encodeURIComponent(modes)}/Disruption`,
					{ includeRouteBlockedStops },
				);
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No disrupted stops for mode(s): ${modes}`,
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text" as const,
							text: `Disrupted stops for ${modes} (${data.length}):\n\n${data.map(formatStop).join("\n")}`,
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

	// --- Journey / routing helpers ---
	server.registerTool(
		"tfl_stoppoint_reachable_from",
		{
			description:
				"Gets all stop points that are reachable from a given station on a specific line — useful for showing where you can go without changing.",
			inputSchema: {
				id: z.string().describe("Origin stop point Naptan ID"),
				lineId: z
					.string()
					.describe("Line ID to travel on (e.g. 'victoria', 'central')"),
				serviceTypes: z
					.string()
					.optional()
					.describe("Service type filter (e.g. 'Regular' or 'Night')"),
			},
		},
		async ({ id, lineId, serviceTypes }) => {
			try {
				const data = await tflRequest<StopPoint[]>(
					`/StopPoint/${encodeURIComponent(id)}/CanReachOnLine/${encodeURIComponent(lineId)}`,
					{ serviceTypes },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Stops reachable from ${id} on ${lineId} (${data.length}):\n\n${data.map(formatStop).join("\n")}`,
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
		"tfl_stoppoint_direction",
		{
			description:
				"Returns the canonical direction ('inbound' or 'outbound') between two stop points on a line. Useful for journey planning.",
			inputSchema: {
				id: z.string().describe("Origin stop point Naptan ID"),
				toStopPointId: z.string().describe("Destination stop point Naptan ID"),
				lineId: z
					.string()
					.optional()
					.describe("Line ID to check direction on (helps disambiguation)"),
			},
		},
		async ({ id, toStopPointId, lineId }) => {
			try {
				const data = await tflRequest<string>(
					`/StopPoint/${encodeURIComponent(id)}/DirectionTo/${encodeURIComponent(toStopPointId)}`,
					{ lineId },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Direction from ${id} to ${toStopPointId}: ${data}`,
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
		"tfl_stoppoint_route",
		{
			description:
				"Returns the route sections for all lines that serve a given stop point.",
			inputSchema: {
				id: z.string().describe("Stop point Naptan ID"),
				serviceTypes: z
					.string()
					.optional()
					.describe("Comma-separated service type filter (e.g. 'Regular')"),
			},
		},
		async ({ id, serviceTypes }) => {
			try {
				const data = await tflRequest<unknown>(
					`/StopPoint/${encodeURIComponent(id)}/Route`,
					{ serviceTypes },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Routes serving stop ${id}:\n\n${JSON.stringify(data, null, 2)}`,
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

	// --- Crowding ---
	server.registerTool(
		"tfl_stoppoint_crowding",
		{
			description:
				"Gets crowding data for a stop point on a specific line, optionally by direction. Shows how busy trains typically are.",
			inputSchema: {
				id: z.string().describe("Stop point Naptan ID"),
				line: z.string().describe("Line ID (e.g. 'victoria', 'central')"),
				direction: z
					.enum(["inbound", "outbound", "all"])
					.describe("Direction of travel"),
			},
		},
		async ({ id, line, direction }) => {
			try {
				const data = await tflRequest<unknown>(
					`/StopPoint/${encodeURIComponent(id)}/Crowding/${encodeURIComponent(line)}`,
					{ direction },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Crowding data for ${id} on ${line} (${direction}):\n\n${JSON.stringify(data, null, 2)}`,
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

	// --- Associated places ---
	server.registerTool(
		"tfl_stoppoint_car_parks",
		{
			description:
				"Gets car parks associated with a given stop point (station).",
			inputSchema: {
				stopPointId: z.string().describe("Stop point Naptan ID"),
			},
		},
		async ({ stopPointId }) => {
			try {
				const data = await tflRequest<unknown>(
					`/StopPoint/${encodeURIComponent(stopPointId)}/CarParks`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Car parks near stop ${stopPointId}:\n\n${JSON.stringify(data, null, 2)}`,
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
		"tfl_stoppoint_taxi_ranks",
		{
			description: "Gets taxi ranks near a given stop point (station).",
			inputSchema: {
				stopPointId: z.string().describe("Stop point Naptan ID"),
			},
		},
		async ({ stopPointId }) => {
			try {
				const data = await tflRequest<unknown>(
					`/StopPoint/${encodeURIComponent(stopPointId)}/TaxiRanks`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Taxi ranks near stop ${stopPointId}:\n\n${JSON.stringify(data, null, 2)}`,
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
		"tfl_stoppoint_place_types",
		{
			description:
				"Gets places of given types that are associated with (near) a specific stop point.",
			inputSchema: {
				id: z.string().describe("Stop point Naptan ID"),
				placeTypes: z
					.string()
					.describe(
						"Comma-separated place types to look up (e.g. 'AirportTerminal,CarPark')",
					),
			},
		},
		async ({ id, placeTypes }) => {
			try {
				const data = await tflRequest<unknown>(
					`/StopPoint/${encodeURIComponent(id)}/placeTypes`,
					{ placeTypes },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Places of type "${placeTypes}" at stop ${id}:\n\n${JSON.stringify(data, null, 2)}`,
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
