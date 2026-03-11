#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import pkg from "../package.json";

import { registerAccidentStatsTools } from "./accident.js";
import { registerAirQualityTools } from "./air-quality.js";
import { registerBikePointTools } from "./bike-point.js";
import { registerCabwiseTools } from "./cabwise.js";
import { registerJourneyTools } from "./journey.js";
import { registerLineTools } from "./line.js";
import { registerModeTools } from "./mode.js";
import { registerOccupancyTools } from "./occupancy.js";

import { registerPlaceTools } from "./place.js";
import { registerRoadTools } from "./road.js";
import { registerSearchTools } from "./search.js";
import { registerStopPointTools } from "./stop-point.js";
import { registerVehicleTools } from "./vehicle.js";

if (!process.env.TFL_API_KEY) {
	console.error(
		"Warning: TFL_API_KEY environment variable is not set. " +
			"Requests will be rate-limited. " +
			"Get a free API key at https://api-portal.tfl.gov.uk/",
	);
}

const server = new McpServer({
	name: "tfl-mcp",
	version: pkg.version,
});

// Register all domain modules
registerAccidentStatsTools(server); // Road accident statistics by year
registerAirQualityTools(server); // London air quality forecasts
registerBikePointTools(server); // Santander Cycles / Boris Bikes
registerCabwiseTools(server); // Licensed taxis and minicabs
registerJourneyTools(server); // Journey planner (all modes)
registerLineTools(server); // Tube/bus/rail line status, routes, arrivals, timetables
registerModeTools(server); // Cross-mode service types and arrivals
registerOccupancyTools(server); // Car parks, bike docks, EV charge connectors
registerPlaceTools(server); // Points of interest, stations, postcode lookup
registerRoadTools(server); // TLRN road status and disruptions
registerSearchTools(server); // Full-text TfL site/data search
registerStopPointTools(server); // Stop points — search, arrivals, disruptions, crowding
registerVehicleTools(server); // Vehicle ULEZ/emissions compliance, vehicle arrivals

async function main(): Promise<void> {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("TfL MCP Server running on stdio");
}

main().catch((error: unknown) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
