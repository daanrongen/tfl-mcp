import { Effect, Layer } from "effect";
import { TflClient } from "../domain/TflClient.ts";
import { TflError } from "../domain/errors.ts";

/**
 * In-memory test adapter for TflClient.
 * Handlers map path prefixes to fixture data. When no handler matches,
 * the request fails with TflError so tests can verify error paths.
 */
export type TflTestHandlers = Map<string, unknown>;

export const makeTflClientTest = (handlers: TflTestHandlers = new Map()) =>
  Layer.succeed(TflClient, {
    request: <T>(path: string) => {
      for (const [prefix, data] of handlers) {
        if (path.startsWith(prefix)) {
          return Effect.succeed(data as T);
        }
      }
      return Effect.fail(
        new TflError({ message: `No test handler for path: ${path}` }),
      );
    },
  });

/** Default test layer with common fixture responses. */
export const TflClientTest = makeTflClientTest(
  new Map<string, unknown>([
    ["/Line/Meta/Modes", [{ modeName: "tube" }, { modeName: "bus" }]],
    ["/AirQuality", { updatePeriod: "Hourly", currentForecast: [] }],
    ["/BikePoint/Search", []],
    ["/BikePoint", []],
    ["/Journey/Meta/Modes", [{ mode: "tube", isTflService: true }]],
    ["/Mode/ActiveServiceTypes", [{ mode: "tube", serviceType: "Regular" }]],
    ["/StopPoint/Meta/Modes", [{ modeName: "tube", isTflService: true }]],
    ["/StopPoint/Meta/StopTypes", ["NaptanMetroStation"]],
    ["/Search", { matches: [] }],
    ["/Occupancy/CarPark", []],
  ]),
);
