import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { TflDisambiguationError, TflError } from "../../src/domain/errors.ts";
import { TflClient } from "../../src/domain/TflClient.ts";
import { makeTflClientTest } from "../../src/infra/TflClientTest.ts";

describe("TflError", () => {
  it("has the correct _tag", () => {
    const err = new TflError({ message: "test error" });
    expect(err._tag).toBe("TflError");
    expect(err.message).toBe("test error");
  });

  it("can carry a cause", () => {
    const cause = new Error("underlying");
    const err = new TflError({ message: "wrapped", cause });
    expect(err.cause).toBe(cause);
  });
});

describe("TflDisambiguationError", () => {
  it("has the correct _tag", () => {
    const err = new TflDisambiguationError({ result: {} });
    expect(err._tag).toBe("TflDisambiguationError");
  });

  it("carries disambiguation options", () => {
    const result = {
      fromLocationDisambiguation: {
        matchStatus: "list",
        disambiguationOptions: [
          {
            parameterValue: "1000129",
            place: { commonName: "King's Cross", placeType: "StopPoint" },
            matchQuality: 1000,
          },
        ],
      },
    };
    const err = new TflDisambiguationError({ result });
    expect(err.result.fromLocationDisambiguation?.disambiguationOptions?.[0]?.parameterValue).toBe(
      "1000129",
    );
  });
});

describe("error channel propagation", () => {
  it("TflError propagates correctly via Effect.either", async () => {
    const layer = makeTflClientTest(new Map()); // no handlers → every call fails

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* TflClient;
        return yield* Effect.either(client.request("/Line/Status"));
      }).pipe(Effect.provide(layer)),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(TflError);
      const err = result.left as TflError;
      expect(err.message).toContain("/Line/Status");
    }
  });
});
