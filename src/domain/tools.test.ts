import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { makeTflClientTest, TflClientTest } from "../infra/TflClientTest.ts";
import { TflClient } from "./TflClient.ts";

// ---------------------------------------------------------------------------
// Line tools
// ---------------------------------------------------------------------------

describe("line tools data", () => {
  it("line meta modes returns an array of mode names", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ modeName?: string }>>("/Line/Meta/Modes");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.map((m) => m.modeName)).toContain("tube");
    expect(result.map((m) => m.modeName)).toContain("bus");
  });

  it("line_search returns searchMatches array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{
          input?: string;
          searchMatches?: Array<{ lineId?: string; lineName?: string; modeName?: string }>;
        }>("/Line/Search/victoria");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.searchMatches).toBeDefined();
    expect(result.searchMatches?.length).toBeGreaterThan(0);
    expect(result.searchMatches?.[0]?.lineId).toBe("victoria");
  });

  it("line_lookup by ids returns line array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string; name?: string; modeName?: string }>>(
          "/Line/victoria",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.id).toBe("victoria");
  });

  it("line_lookup by modes returns line array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string; modeName?: string }>>("/Line/Mode/tube");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.modeName).toBe("tube");
  });

  it("line_status by ids returns status array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ id?: string; lineStatuses?: Array<{ statusSeverityDescription?: string }> }>
        >("/Line/victoria/Status");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result[0]?.lineStatuses?.[0]?.statusSeverityDescription).toBe("Good Service");
  });

  it("line_status by modes returns status array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ id?: string; lineStatuses?: Array<{ statusSeverityDescription?: string }> }>
        >("/Line/Mode/tube/Status");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.id).toBe("victoria");
  });

  it("line_status by severity returns matching lines", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string }>>("/Line/Status/10");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.id).toBe("victoria");
  });

  it("line_status by date range returns status array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string }>>(
          "/Line/victoria/Status/2024-01-01T00:00:00/to/2024-01-07T23:59:59",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.id).toBe("victoria");
  });

  it("line_disruptions by ids returns array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<unknown[]>("/Line/victoria/Disruption");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it("line_disruptions by modes returns array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<unknown[]>("/Line/Mode/tube/Disruption");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it("line_routes by modes returns line array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string; modeName?: string }>>(
          "/Line/Mode/tube/Route",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.modeName).toBe("tube");
  });

  it("line_routes by ids returns route sections", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ id?: string; routeSections?: Array<{ originationName?: string }> }>
        >("/Line/victoria/Route");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result[0]?.routeSections?.[0]?.originationName).toBe("Brixton");
  });

  it("line_route_sequence returns stop point sequences", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{
          lineName?: string;
          stopPointSequences?: Array<{
            stopPoint?: Array<{ name?: string }>;
          }>;
        }>("/Line/victoria/Route/Sequence/outbound");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.lineName).toBe("Victoria");
    expect(result.stopPointSequences?.[0]?.stopPoint?.[0]?.name).toBe("Brixton");
  });

  it("line_stop_points returns stops array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string; commonName?: string }>>(
          "/Line/victoria/StopPoints",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.some((s) => s.commonName?.includes("Victoria"))).toBe(true);
  });

  it("line_arrivals returns arrival predictions", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ stationName?: string; destinationName?: string; timeToStation?: number }>
        >("/Line/victoria/Arrivals/940GZZLUVIC");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.stationName).toBe("Victoria");
    expect(result[0]?.timeToStation).toBe(120);
  });

  it("line_timetable returns timetable data", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{ lineId?: string }>("/Line/victoria/Timetable/940GZZLUVIC");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result).toBeDefined();
  });

  it("line_timetable with destination returns timetable data", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{ lineId?: string }>(
          "/Line/victoria/Timetable/940GZZLUVIC/to/940GZZLUBXN",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Stop point tools
// ---------------------------------------------------------------------------

describe("stop point tools data", () => {
  it("stoppoint meta modes returns mode list", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ modeName?: string; isTflService?: boolean }>>(
          "/StopPoint/Meta/Modes",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("isTflService");
  });

  it("stoppoint meta stop types returns string array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<string[]>("/StopPoint/Meta/StopTypes");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain("NaptanMetroStation");
  });

  it("stoppoint_search returns matches array with stop data", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{
          matches?: Array<{ id?: string; commonName?: string }>;
          total?: number;
        }>("/StopPoint/Search");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.matches?.length).toBeGreaterThan(0);
    expect(result.matches?.[0]?.id).toBe("940GZZLUVIC");
  });

  it("stoppoint_by_id returns single stop object", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{ id?: string; commonName?: string }>(
          "/StopPoint/940GZZLUVIC",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.id).toBe("940GZZLUVIC");
    expect(result.commonName).toBe("Victoria Underground Station");
  });

  it("stoppoint_by_geo returns stopPoints array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{ stopPoints?: Array<{ id?: string }> }>("/StopPoint");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.stopPoints).toBeDefined();
    expect(Array.isArray(result.stopPoints)).toBe(true);
  });

  it("stoppoint_lookup by mode returns array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string; stopType?: string }>>(
          "/StopPoint/Mode/tube",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.stopType).toBe("NaptanMetroStation");
  });

  it("stoppoint_lookup by type returns array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string; stopType?: string }>>(
          "/StopPoint/Type/NaptanMetroStation",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.stopType).toBe("NaptanMetroStation");
  });

  it("stoppoint_arrivals returns arrival predictions", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ stationName?: string; destinationName?: string; timeToStation?: number }>
        >("/StopPoint/940GZZLUVIC/Arrivals");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.stationName).toBe("Victoria");
    expect(result[0]?.timeToStation).toBe(180);
  });

  it("stoppoint_arrivals with includeDepartures returns departure board", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{
            stationName?: string;
            lineName?: string;
            scheduledTimeOfDeparture?: string;
          }>
        >("/StopPoint/940GZZLUVIC/ArrivalDepartures");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.stationName).toBe("Victoria");
    expect(result[0]?.scheduledTimeOfDeparture).toBeDefined();
  });

  it("stoppoint_disruptions by ids returns array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<unknown[]>("/StopPoint/940GZZLUVIC/Disruption");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it("stoppoint_disruptions by modes returns array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<unknown[]>("/StopPoint/Mode/tube/Disruption");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it("stoppoint_crowding returns flow data", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{
            naptanId?: string;
            commonName?: string;
            passengerFlows?: Array<{ timeSlice?: string; value?: number }>;
          }>
        >("/StopPoint/940GZZLUVIC/Crowding/victoria");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.commonName).toBe("Victoria");
    expect(result[0]?.passengerFlows?.[0]?.value).toBe(1200);
  });

  it("stoppoint_places (placeTypes) returns places array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string; placeType?: string }>>(
          "/StopPoint/940GZZLUVIC/placeTypes",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.placeType).toBe("CoachStation");
  });

  it("stoppoint_places (CarParks) returns empty array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<unknown[]>("/StopPoint/940GZZLUVIC/CarParks");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it("stoppoint_places (TaxiRanks) returns empty array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<unknown[]>("/StopPoint/940GZZLUVIC/TaxiRanks");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Air quality data
// ---------------------------------------------------------------------------

describe("air quality data", () => {
  it("returns air quality with updatePeriod", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{
          updatePeriod?: string;
          currentForecast?: unknown[];
        }>("/AirQuality");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.updatePeriod).toBe("Hourly");
    expect(Array.isArray(result.currentForecast)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Road tools
// ---------------------------------------------------------------------------

describe("road tools data", () => {
  it("road_lookup all roads returns array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ id?: string; displayName?: string; statusSeverityDescription?: string }>
        >("/Road");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.id).toBe("A1");
    expect(result[0]?.statusSeverityDescription).toBe("No Exceptional Delays");
  });

  it("road_lookup with ids returns specific road", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string; displayName?: string }>>("/Road/A1");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result[0]?.id).toBe("A1");
    expect(result[0]?.displayName).toBe("A1");
  });

  it("road_disruptions all roads returns array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<unknown[]>("/Road/all/Disruption");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it("road_disruptions with ids returns array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<unknown[]>("/Road/A1/Disruption");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Occupancy tools
// ---------------------------------------------------------------------------

describe("occupancy tools data", () => {
  it("car parks returns an array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<unknown[]>("/Occupancy/CarPark");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it("occupancy_car_parks with id returns single car park object", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{
          id?: string;
          name?: string;
          bays?: Array<{ bayType?: string; free?: number }>;
        }>("/Occupancy/CarPark/CarParks_800491");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.id).toBe("CarParks_800491");
    expect(result.bays?.[0]?.bayType).toBe("Standard");
    expect(result.bays?.[0]?.free).toBe(12);
  });

  it("occupancy_charge_connectors all returns array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string; status?: string }>>(
          "/Occupancy/ChargeConnector",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.status).toBe("Available");
  });

  it("occupancy_charge_connectors with ids returns filtered array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ sourceSystemPlaceId?: string; status?: string }>>(
          "/Occupancy/ChargeConnector/CC001",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result[0]?.sourceSystemPlaceId).toBe("CC001");
    expect(result[0]?.status).toBe("Available");
  });

  it("occupancy_bike_points returns occupancy array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ id?: string; name?: string; bikesCount?: number; totalDocks?: number }>
        >("/Occupancy/BikePoints/BikePoints_1");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.name).toBe("River Street, Clerkenwell");
    expect(result[0]?.bikesCount).toBe(5);
    expect(result[0]?.totalDocks).toBe(19);
  });
});

// ---------------------------------------------------------------------------
// Place tools
// ---------------------------------------------------------------------------

describe("place tools data", () => {
  it("place_search returns places array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ id?: string; commonName?: string; placeType?: string }>
        >("/Place/Search");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.commonName).toBe("Victoria");
    expect(result[0]?.placeType).toBe("NaptanMetroStation");
  });

  it("place_by_id returns single place object", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{ id?: string; commonName?: string; lat?: number }>(
          "/Place/victoria-id",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.id).toBe("victoria-id");
    expect(result.commonName).toBe("Victoria");
    expect(result.lat).toBeDefined();
  });

  it("place_by_geo returns places array", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ id?: string; commonName?: string; placeType?: string }>
        >("/Place");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.commonName).toBe("Victoria");
  });

  it("place_by_type returns places array for given type", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string; placeType?: string }>>(
          "/Place/Type/CarPark",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.placeType).toBe("CarPark");
  });
});

// ---------------------------------------------------------------------------
// Search tools
// ---------------------------------------------------------------------------

describe("search tools data", () => {
  it("search general scope returns matches", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{
          query?: string;
          total?: number;
          matches?: Array<{ id?: string; name?: string }>;
        }>("/Search");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.matches).toBeDefined();
    expect(result.matches?.length).toBeGreaterThan(0);
    expect(result.matches?.[0]?.name).toBe("Victoria");
  });

  it("search bus_schedules scope returns schedule matches", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{
          query?: string;
          matches?: Array<{ id?: string; name?: string; url?: string }>;
        }>("/Search/BusSchedules");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.matches).toBeDefined();
    expect(result.matches?.length).toBeGreaterThan(0);
    expect(result.matches?.[0]?.url).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Journey tools
// ---------------------------------------------------------------------------

describe("journey tools data", () => {
  it("journey_plan returns journey options with legs", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{
          journeys?: Array<{
            duration?: number;
            legs?: Array<{ mode?: { name?: string } }>;
          }>;
        }>("/Journey/JourneyResults/Victoria/to/Waterloo");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.journeys).toBeDefined();
    expect(result.journeys?.length).toBeGreaterThan(0);
    expect(result.journeys?.[0]?.duration).toBe(8);
    expect(result.journeys?.[0]?.legs?.[0]?.mode?.name).toBe("tube");
  });
});

// ---------------------------------------------------------------------------
// Bike point tools
// ---------------------------------------------------------------------------

describe("bike point tools data", () => {
  it("bike_point_search without query returns empty array from /BikePoint", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<unknown[]>("/BikePoint");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it("bike_point_search with query returns array from /BikePoint/Search", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<unknown[]>("/BikePoint/Search", {
          query: "waterloo",
        });
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it("bike_point_by_id returns bike point with additionalProperties", async () => {
    const fixtures = new Map<string, unknown>([
      [
        "/BikePoint/BikePoints_1",
        {
          id: "BikePoints_1",
          commonName: "River Street, Clerkenwell",
          lat: 51.52916,
          lon: -0.10981,
          additionalProperties: [
            { key: "NbBikes", value: "5" },
            { key: "NbDocks", value: "19" },
            { key: "NbEmptyDocks", value: "14" },
            { key: "Installed", value: "true" },
            { key: "Locked", value: "false" },
          ],
        },
      ],
    ]);
    const layer = makeTflClientTest(fixtures);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{
          id?: string;
          commonName?: string;
          additionalProperties?: Array<{ key?: string; value?: string }>;
        }>("/BikePoint/BikePoints_1");
      }).pipe(Effect.provide(layer)),
    );
    expect(result.commonName).toBe("River Street, Clerkenwell");
    const nbBikes = result.additionalProperties?.find((p) => p.key === "NbBikes")?.value;
    expect(nbBikes).toBe("5");
  });

  it("bike_point_by_id from default layer returns correct data", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{
          id?: string;
          commonName?: string;
          additionalProperties?: Array<{ key?: string; value?: string }>;
        }>("/BikePoint/BikePoints_1");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.id).toBe("BikePoints_1");
    const nbDocks = result.additionalProperties?.find((p) => p.key === "NbDocks")?.value;
    expect(nbDocks).toBe("19");
  });
});

// ---------------------------------------------------------------------------
// Accident tools
// ---------------------------------------------------------------------------

describe("accident tools data", () => {
  it("accident_stats returns array of accident records", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{
            id?: number;
            severity?: string;
            location?: string;
            casualties?: unknown[];
          }>
        >("/AccidentStats/2023");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.severity).toBe("Slight");
    expect(result[0]?.location).toBe("Oxford Street");
    expect(result[0]?.casualties?.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Cabwise tools
// ---------------------------------------------------------------------------

describe("cabwise tools data", () => {
  it("cabwise_search returns operator list", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{
          Operators?: {
            OperatorList?: Array<{ TradingName?: string; OperatorType?: string }>;
          };
        }>("/Cabwise/search");
      }).pipe(Effect.provide(TflClientTest)),
    );
    const operators = result.Operators?.OperatorList ?? [];
    expect(operators.length).toBeGreaterThan(0);
    expect(operators[0]?.TradingName).toBe("London Cabs Ltd");
    expect(operators[0]?.OperatorType).toBe("BlackCab");
  });
});

// ---------------------------------------------------------------------------
// Mode tools
// ---------------------------------------------------------------------------

describe("mode tools data", () => {
  it("active service types returns mode/serviceType pairs", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ mode?: string; serviceType?: string }>>(
          "/Mode/ActiveServiceTypes",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result[0]?.mode).toBe("tube");
    expect(result[0]?.serviceType).toBe("Regular");
  });

  it("mode_arrivals returns arrival predictions for mode", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{
            stationName?: string;
            lineName?: string;
            destinationName?: string;
            timeToStation?: number;
          }>
        >("/Mode/tube/Arrivals");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.stationName).toBe("Victoria");
    expect(result[0]?.timeToStation).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Vehicle tools
// ---------------------------------------------------------------------------

describe("vehicle tools data", () => {
  it("vehicle ulez compliance returns compliance status", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ vrm?: string; make?: string; model?: string; compliance?: string }>
        >("/Vehicle/UlezCompliance", { vrm: "AB12CDE" });
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result[0]?.vrm).toBe("AB12CDE");
    expect(result[0]?.compliance).toBe("Compliant");
  });

  it("vehicle emission surcharge returns ulez and caz flags", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ vrm?: string; isUlezCompliant?: boolean; isCazCompliant?: boolean }>
        >("/Vehicle/EmissionSurcharge", { vrm: "AB12CDE" });
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result[0]?.vrm).toBe("AB12CDE");
    expect(result[0]?.isUlezCompliant).toBe(true);
    expect(result[0]?.isCazCompliant).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Custom fixture handlers
// ---------------------------------------------------------------------------

describe("custom fixture handlers", () => {
  it("can provide specific line status fixture", async () => {
    const fixtures = new Map<string, unknown>([
      [
        "/Line/victoria/Status",
        [
          {
            id: "victoria",
            name: "Victoria",
            modeName: "tube",
            lineStatuses: [{ statusSeverityDescription: "Good Service" }],
          },
        ],
      ],
    ]);
    const layer = makeTflClientTest(fixtures);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ id?: string; name?: string }>>(
          "/Line/victoria/Status",
        );
      }).pipe(Effect.provide(layer)),
    );
    expect(result[0]?.name).toBe("Victoria");
  });

  it("can provide bike point fixture with availability data", async () => {
    const fixtures = new Map<string, unknown>([
      [
        "/BikePoint/BikePoints_1",
        {
          id: "BikePoints_1",
          commonName: "River Street, Clerkenwell",
          lat: 51.52916,
          lon: -0.10981,
          additionalProperties: [
            { key: "NbBikes", value: "5" },
            { key: "NbDocks", value: "19" },
            { key: "NbEmptyDocks", value: "14" },
          ],
        },
      ],
    ]);
    const layer = makeTflClientTest(fixtures);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{
          id?: string;
          commonName?: string;
          additionalProperties?: Array<{ key?: string; value?: string }>;
        }>("/BikePoint/BikePoints_1");
      }).pipe(Effect.provide(layer)),
    );
    expect(result.commonName).toBe("River Street, Clerkenwell");
    const nbBikes = result.additionalProperties?.find((p) => p.key === "NbBikes")?.value;
    expect(nbBikes).toBe("5");
  });
});
