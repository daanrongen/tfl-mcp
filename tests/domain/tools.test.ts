import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { TflClient } from "../../src/domain/TflClient.ts";
import {
  TflClientTest,
  makeTflClientTest,
} from "../../src/infra/TflClientTest.ts";

describe("line tools data", () => {
  it("line meta modes returns an array of mode names", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ modeName?: string }>>(
          "/Line/Meta/Modes",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result.map((m) => m.modeName)).toContain("tube");
    expect(result.map((m) => m.modeName)).toContain("bus");
  });
});

describe("stop point tools data", () => {
  it("stoppoint meta modes returns mode list", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ modeName?: string; isTflService?: boolean }>
        >("/StopPoint/Meta/Modes");
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
});

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

describe("mode tools data", () => {
  it("active service types returns mode/serviceType pairs", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<
          Array<{ mode?: string; serviceType?: string }>
        >("/Mode/ActiveServiceTypes");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result[0]?.mode).toBe("tube");
    expect(result[0]?.serviceType).toBe("Regular");
  });
});

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
});

describe("bike point tools data", () => {
  it("bike point search returns an array", async () => {
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
});

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
    const nbBikes = result.additionalProperties?.find(
      (p) => p.key === "NbBikes",
    )?.value;
    expect(nbBikes).toBe("5");
  });
});
