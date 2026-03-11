import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, tflRequest } from "./client.js";

interface Road {
	id?: string;
	displayName?: string;
	statusSeverity?: string;
	statusSeverityDescription?: string;
	bounds?: string;
	envelope?: string;
}

interface RoadDisruption {
	id?: string;
	category?: string;
	subCategory?: string;
	comments?: string;
	currentUpdate?: string;
	severity?: string;
	level?: string;
	streets?: Array<{
		name?: string;
		closure?: string;
		directions?: string;
	}>;
	startDateTime?: string;
	endDateTime?: string;
	isProvisional?: boolean;
}

function formatRoad(r: Road): string {
	return [
		`Road: ${r.displayName ?? r.id ?? "Unknown"}`,
		`Status: ${r.statusSeverityDescription ?? r.statusSeverity ?? "Unknown"}`,
	].join("\n");
}

function formatDisruption(d: RoadDisruption): string {
	const lines = [
		`ID: ${d.id ?? "?"}`,
		`Category: ${d.category ?? "?"}${d.subCategory ? ` / ${d.subCategory}` : ""}`,
		`Severity: ${d.severity ?? "?"} (${d.level ?? "?"})`,
	];
	if (d.comments) lines.push(`Comments: ${d.comments}`);
	if (d.currentUpdate) lines.push(`Update: ${d.currentUpdate}`);
	if (d.startDateTime) lines.push(`Start: ${d.startDateTime}`);
	if (d.endDateTime) lines.push(`End: ${d.endDateTime}`);
	if (d.streets?.length) {
		lines.push(
			`Streets: ${d.streets.map((s) => `${s.name ?? "?"}${s.closure ? ` (${s.closure})` : ""}`).join(", ")}`,
		);
	}
	return lines.join("\n");
}

export function registerRoadTools(server: McpServer): void {
	server.registerTool(
		"road_all",
		{
			description:
				"Gets all roads managed by TfL (the TLRN — Transport for London Road Network), including their current status.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<Road[]>("/Road");
				return {
					content: [
						{
							type: "text" as const,
							text: `TfL managed roads (${data.length}):\n\n${data.map(formatRoad).join("\n---\n")}`,
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
		"road_by_ids",
		{
			description:
				"Gets details and current status for specific TfL managed roads by ID (e.g. A1, A2, A40).",
			inputSchema: {
				ids: z
					.string()
					.describe(
						"Comma-separated road IDs (e.g. 'A1,A2' or 'A40'). Use road_all to see available road IDs.",
					),
			},
		},
		async ({ ids }) => {
			try {
				const data = await tflRequest<Road[]>(
					`/Road/${encodeURIComponent(ids)}`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: data.map(formatRoad).join("\n---\n"),
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
		"road_status",
		{
			description:
				"Gets the current traffic status for specific TfL roads, optionally aggregated over a date range.",
			inputSchema: {
				ids: z.string().describe("Comma-separated road IDs (e.g. 'A1,A2,A40')"),
				startDate: z
					.string()
					.optional()
					.describe(
						"Start date for status aggregation (ISO format, e.g. '2024-03-01')",
					),
				endDate: z
					.string()
					.optional()
					.describe(
						"End date for status aggregation (ISO format, e.g. '2024-03-07')",
					),
			},
		},
		async ({ ids, startDate, endDate }) => {
			try {
				const data = await tflRequest<Road[]>(
					`/Road/${encodeURIComponent(ids)}/Status`,
					{
						"dateRangeNullable.startDate": startDate,
						"dateRangeNullable.endDate": endDate,
					},
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Road status:\n\n${data.map(formatRoad).join("\n---\n")}`,
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
		"road_disruptions",
		{
			description:
				"Gets active road disruptions (roadworks, closures, incidents) for specific roads.",
			inputSchema: {
				ids: z
					.string()
					.describe(
						"Comma-separated road IDs (e.g. 'A1,A2'). Use 'all' for all roads.",
					),
				stripContent: z
					.boolean()
					.optional()
					.describe("If true, strip HTML from description text"),
				severities: z
					.string()
					.optional()
					.describe(
						"Comma-separated severity filter (use road_meta_severities for valid values)",
					),
				categories: z
					.string()
					.optional()
					.describe(
						"Comma-separated category filter (use road_meta_categories for valid values)",
					),
				closures: z
					.boolean()
					.optional()
					.describe("If true, only return road closures"),
			},
		},
		async ({ ids, stripContent, severities, categories, closures }) => {
			try {
				const data = await tflRequest<RoadDisruption[]>(
					`/Road/${encodeURIComponent(ids)}/Disruption`,
					{ stripContent, severities, categories, closures },
				);
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No active disruptions for roads: ${ids}`,
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text" as const,
							text: `Road disruptions for ${ids} (${data.length}):\n\n${data.map(formatDisruption).join("\n---\n")}`,
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
		"road_disruption_by_ids",
		{
			description:
				"Gets details for specific road disruptions by their disruption IDs.",
			inputSchema: {
				disruptionIds: z.string().describe("Comma-separated disruption IDs"),
				stripContent: z
					.boolean()
					.optional()
					.describe("If true, strip HTML from description text"),
			},
		},
		async ({ disruptionIds, stripContent }) => {
			try {
				const data = await tflRequest<RoadDisruption | RoadDisruption[]>(
					`/Road/all/Disruption/${encodeURIComponent(disruptionIds)}`,
					{ stripContent },
				);
				const disruptions = Array.isArray(data) ? data : [data];
				return {
					content: [
						{
							type: "text" as const,
							text: disruptions.map(formatDisruption).join("\n---\n"),
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
		"road_street_disruptions",
		{
			description:
				"Gets a list of disrupted streets across London. If no dates are provided, current disruptions are returned.",
			inputSchema: {
				startDate: z
					.string()
					.optional()
					.describe("Start date filter (ISO format, e.g. '2024-03-01')"),
				endDate: z
					.string()
					.optional()
					.describe("End date filter (ISO format, e.g. '2024-03-07')"),
			},
		},
		async ({ startDate, endDate }) => {
			try {
				const data = await tflRequest<unknown>("/Road/all/Street/Disruption", {
					startDate,
					endDate,
				});
				return {
					content: [
						{
							type: "text" as const,
							text: `Street disruptions:\n\n${JSON.stringify(data, null, 2)}`,
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
		"road_meta_categories",
		{
			description: "Gets the list of valid road disruption category names.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<string[]>("/Road/Meta/Categories");
				return {
					content: [
						{
							type: "text" as const,
							text: `Road disruption categories:\n\n${data.join("\n")}`,
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
		"road_meta_severities",
		{
			description:
				"Gets the list of valid road disruption severity codes (e.g. 'Severe', 'Serious', 'Moderate', 'Minimal').",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<string[]>("/Road/Meta/Severities");
				return {
					content: [
						{
							type: "text" as const,
							text: `Road disruption severities:\n\n${data.join("\n")}`,
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
