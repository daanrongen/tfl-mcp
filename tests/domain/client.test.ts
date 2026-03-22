import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { TflClient } from "../../src/domain/TflClient.ts";
import { TflError } from "../../src/domain/errors.ts";
import {
  TflClientTest,
  makeTflClientTest,
} from "../../src/infra/TflClientTest.ts";

describe("TflClient", () => {
  it("returns fixture data for a known path prefix", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ modeName?: string }>>(
          "/Line/Meta/Modes",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("modeName");
  });

  it("fails with TflError for an unknown path", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* Effect.either(client.request("/Unknown/Path"));
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(TflError);
    }
  });

  it("supports custom handlers via makeTflClientTest", async () => {
    const handlers = new Map<string, unknown>([
      ["/Custom/Path", { value: 42 }],
    ]);
    const layer = makeTflClientTest(handlers);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{ value: number }>("/Custom/Path");
      }).pipe(Effect.provide(layer)),
    );
    expect(result.value).toBe(42);
  });

  it("returns air quality fixture data", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<{ updatePeriod?: string }>("/AirQuality");
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(result).toHaveProperty("updatePeriod");
  });

  it("returns journey modes fixture data", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* client.request<Array<{ mode?: string }>>(
          "/Journey/Meta/Modes",
        );
      }).pipe(Effect.provide(TflClientTest)),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("mode");
  });
});
