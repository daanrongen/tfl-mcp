import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, tflRequest } from "./client.js";

interface Place {
	id?: string;
	commonName?: string;
	placeType?: string;
	lat?: number;
	lon?: number;
	additionalProperties?: Array<{ key?: string; value?: string }>;
}

function formatPlace(p: Place): string {
	return `${p.commonName ?? "??"} (${p.placeType ?? "?"}) — ID: ${p.id ?? "?"} — ${p.lat?.toFixed(5) ?? "?"}, ${p.lon?.toFixed(5) ?? "?"}`;
}

export function registerPlaceTools(server: McpServer): void {
	server.registerTool(
		"place_search",
		{
			description:
				"Search for TfL places (stations, stops, landmarks) by name.",
			inputSchema: {
				name: z
					.string()
					.min(1)
					.describe(
						"Place name to search for (e.g. 'Victoria', 'London Bridge')",
					),
				types: z
					.string()
					.optional()
					.describe(
						"Comma-separated place types to filter by. Use place_meta_types to get available types.",
					),
			},
		},
		async ({ name, types }) => {
			try {
				const data = await tflRequest<Place[]>("/Place/Search", {
					name,
					types,
				});
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No places found matching "${name}".`,
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text" as const,
							text: `Places matching "${name}" (${data.length} results):\n\n${data.map(formatPlace).join("\n")}`,
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
		"place_by_id",
		{
			description:
				"Gets a TfL place by its ID, including all additional properties.",
			inputSchema: {
				id: z.string().describe("Place ID (e.g. '1000005' or 'BikePoints_1')"),
				includeChildren: z
					.boolean()
					.optional()
					.describe(
						"If true, include child places (e.g. platforms within a station)",
					),
			},
		},
		async ({ id, includeChildren }) => {
			try {
				const data = await tflRequest<Place | Place[]>(
					`/Place/${encodeURIComponent(id)}`,
					{ includeChildren },
				);
				const places = Array.isArray(data) ? data : [data];
				return {
					content: [
						{
							type: "text" as const,
							text: `Place details:\n\n${JSON.stringify(places, null, 2)}`,
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
		"place_by_geo",
		{
			description:
				"Gets TfL places within a geographic area. Supports radius search (lat/lon + radius) or bounding box search.",
			inputSchema: {
				lat: z
					.number()
					.optional()
					.describe("Centre latitude for radius search"),
				lon: z
					.number()
					.optional()
					.describe("Centre longitude for radius search"),
				radius: z
					.number()
					.positive()
					.optional()
					.describe("Radius in metres (default: 200)"),
				swLat: z
					.number()
					.optional()
					.describe("Bounding box south-west latitude"),
				swLon: z
					.number()
					.optional()
					.describe("Bounding box south-west longitude"),
				neLat: z
					.number()
					.optional()
					.describe("Bounding box north-east latitude"),
				neLon: z
					.number()
					.optional()
					.describe("Bounding box north-east longitude"),
				type: z
					.string()
					.optional()
					.describe("Comma-separated place type filters"),
				activeOnly: z
					.boolean()
					.optional()
					.describe("If true, only return currently active places"),
				categories: z
					.string()
					.optional()
					.describe("Comma-separated category filters"),
				numberOfPlacesToReturn: z
					.number()
					.int()
					.optional()
					.describe("Maximum number of places to return"),
			},
		},
		async ({
			lat,
			lon,
			radius,
			swLat,
			swLon,
			neLat,
			neLon,
			type,
			activeOnly,
			categories,
			numberOfPlacesToReturn,
		}) => {
			try {
				const data = await tflRequest<Place[]>("/Place", {
					"placeGeo.lat": lat,
					"placeGeo.lon": lon,
					radius,
					"placeGeo.swLat": swLat,
					"placeGeo.swLon": swLon,
					"placeGeo.neLat": neLat,
					"placeGeo.neLon": neLon,
					type,
					activeOnly,
					categories,
					numberOfPlacesToReturn,
				});
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No places found in the specified area.",
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text" as const,
							text: `Places in area (${data.length} found):\n\n${data.map(formatPlace).join("\n")}`,
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
		"place_by_type",
		{
			description:
				"Gets all TfL places of a specific type (e.g. all tube stations, all bus stops).",
			inputSchema: {
				types: z
					.string()
					.describe(
						"Comma-separated place types. Use place_meta_types to get available types.",
					),
				activeOnly: z
					.boolean()
					.optional()
					.describe("If true, only return currently active places"),
			},
		},
		async ({ types, activeOnly }) => {
			try {
				const data = await tflRequest<Place[]>(
					`/Place/Type/${encodeURIComponent(types)}`,
					{ activeOnly },
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Places of type "${types}" (${data.length}):\n\n${data.map(formatPlace).join("\n")}`,
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
		"place_at_coordinates",
		{
			description:
				"Gets any polygonal places (e.g. borough boundaries) of a given type whose geography intersects given coordinates.",
			inputSchema: {
				type: z
					.string()
					.describe("Place type (e.g. 'BoroughBoundaries', 'Postcode')"),
				lat: z.number().describe("Latitude"),
				lon: z.number().describe("Longitude"),
			},
		},
		async ({ type, lat, lon }) => {
			try {
				const data = await tflRequest<Place[]>(
					`/Place/${encodeURIComponent(type)}/At/${lat}/${lon}`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Places of type "${type}" at (${lat}, ${lon}):\n\n${data.map(formatPlace).join("\n")}`,
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
		"place_streets_by_postcode",
		{
			description: "Gets the set of streets associated with a London postcode.",
			inputSchema: {
				postcode: z
					.string()
					.describe("UK postcode (e.g. 'SW1A1AA', 'EC1A1BB')"),
			},
		},
		async ({ postcode }) => {
			try {
				const data = await tflRequest<unknown>(
					`/Place/Address/Streets/${encodeURIComponent(postcode)}`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Streets for postcode ${postcode}:\n\n${JSON.stringify(data, null, 2)}`,
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
		"place_meta_types",
		{
			description:
				"Gets the list of all available TfL place types (e.g. NaptanMetroStation, NaptanBusCoachStation, BikePoint).",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<Array<{ type?: string }>>(
					"/Place/Meta/PlaceTypes",
				);
				const types = data.map((t) => t.type ?? "??");
				return {
					content: [
						{
							type: "text" as const,
							text: `Available place types:\n\n${types.join("\n")}`,
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
		"place_meta_categories",
		{
			description:
				"Gets all available place property categories and keys (useful for filtering place searches).",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<unknown>("/Place/Meta/Categories");
				return {
					content: [
						{
							type: "text" as const,
							text: `Place property categories:\n\n${JSON.stringify(data, null, 2)}`,
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
