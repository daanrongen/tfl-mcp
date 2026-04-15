import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import pkg from "../../package.json";
import type { TflDisambiguationError, TflError } from "../domain/errors.ts";
import type { TflClient } from "../domain/TflClient.ts";
import { registerAccidentTools } from "./tools/accident.ts";
import { registerAirQualityTools } from "./tools/air-quality.ts";
import { registerBikePointTools } from "./tools/bike-point.ts";
import { registerCabwiseTools } from "./tools/cabwise.ts";
import { registerJourneyTools } from "./tools/journey.ts";
import { registerLineTools } from "./tools/line.ts";
import { registerModeTools } from "./tools/mode.ts";
import { registerOccupancyTools } from "./tools/occupancy.ts";
import { registerPlaceTools } from "./tools/place.ts";
import { registerRoadTools } from "./tools/road.ts";
import { registerSearchTools } from "./tools/search.ts";
import { registerStopPointTools } from "./tools/stop-point.ts";
import { registerVehicleTools } from "./tools/vehicle.ts";

export const createMcpServer = (
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
): McpServer => {
  const server = new McpServer({
    name: "tfl-mcp-server",
    version: pkg.version,
  });

  registerAccidentTools(server, runtime);
  registerAirQualityTools(server, runtime);
  registerBikePointTools(server, runtime);
  registerCabwiseTools(server, runtime);
  registerJourneyTools(server, runtime);
  registerLineTools(server, runtime);
  registerModeTools(server, runtime);
  registerOccupancyTools(server, runtime);
  registerPlaceTools(server, runtime);
  registerRoadTools(server, runtime);
  registerSearchTools(server, runtime);
  registerStopPointTools(server, runtime);
  registerVehicleTools(server, runtime);

  return server;
};
