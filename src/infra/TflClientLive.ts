import { Effect, Layer, Option } from "effect";
import { TflApiKeyConfig } from "../config.ts";
import { TflClient } from "../domain/TflClient.ts";
import {
  type DisambiguationResult,
  TflDisambiguationError,
  TflError,
} from "../domain/errors.ts";

const TFL_API_BASE = "https://api.tfl.gov.uk";
const USER_AGENT = "tfl-mcp/1.0";

/** Sentinel thrown inside the fetch promise to surface disambiguation responses. */
class DisambiguationSentinel {
  readonly _tag = "DisambiguationSentinel" as const;
  constructor(readonly result: DisambiguationResult) {}
}

export const TflClientLive = Layer.effect(
  TflClient,
  Effect.gen(function* () {
    const apiKeyOption = yield* Effect.orDie(TflApiKeyConfig);
    const apiKey = Option.getOrElse(apiKeyOption, () => "");

    if (!apiKey) {
      yield* Effect.logWarning(
        "TFL_API_KEY is not set — requests will be rate-limited. Get a free key at https://api-portal.tfl.gov.uk/",
      );
    }

    return {
      request: <T>(
        path: string,
        params: Record<string, string | number | boolean | undefined> = {},
      ) =>
        Effect.tryPromise({
          try: async () => {
            const url = new URL(`${TFL_API_BASE}${path}`);

            if (apiKey) {
              url.searchParams.set("app_key", apiKey);
            }

            for (const [key, value] of Object.entries(params)) {
              if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, String(value));
              }
            }

            const response = await fetch(url.toString(), {
              headers: {
                "User-Agent": USER_AGENT,
                Accept: "application/json",
              },
            });

            if (response.status === 300) {
              const raw = await response.text().catch(() => "{}");
              let result: DisambiguationResult = {};
              try {
                result = JSON.parse(raw) as DisambiguationResult;
              } catch {
                // ignore — empty object is the safe fallback
              }
              throw new DisambiguationSentinel(result);
            }

            if (!response.ok) {
              const body = await response.text().catch(() => "");
              throw new Error(
                `TfL API error ${response.status}: ${response.statusText}. ${body}`,
              );
            }

            return response.json() as Promise<T>;
          },
          catch: (e) => {
            if (e instanceof DisambiguationSentinel) {
              return new TflDisambiguationError({ result: e.result });
            }
            return new TflError({
              message:
                e instanceof Error ? e.message : `TfL request failed: ${path}`,
              cause: e,
            });
          },
        }),
    };
  }),
);
