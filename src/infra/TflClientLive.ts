import { Effect, Layer, Option } from "effect";
import { TflApiKeyConfig } from "../config.ts";
import { type DisambiguationResult, TflDisambiguationError, TflError } from "../domain/errors.ts";
import { TflClient } from "../domain/TflClient.ts";

const TFL_API_BASE = "https://api.tfl.gov.uk";
const USER_AGENT = "tfl-mcp/1.0";

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
        Effect.gen(function* () {
          const url = new URL(`${TFL_API_BASE}${path}`);

          if (apiKey) {
            url.searchParams.set("app_key", apiKey);
          }

          for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== "") {
              url.searchParams.set(key, String(value));
            }
          }

          const response = yield* Effect.tryPromise({
            try: () =>
              fetch(url.toString(), {
                headers: {
                  "User-Agent": USER_AGENT,
                  Accept: "application/json",
                },
              }),
            catch: (e) =>
              new TflError({
                message: e instanceof Error ? e.message : `TfL request failed: ${path}`,
                cause: e,
              }),
          });

          if (response.status === 300) {
            const raw = yield* Effect.tryPromise({
              try: () => response.text(),
              catch: () =>
                new TflError({
                  message: "Failed to read disambiguation response",
                  cause: undefined,
                }),
            }).pipe(Effect.orElse(() => Effect.succeed("{}")));
            let result: DisambiguationResult = {};
            try {
              result = JSON.parse(raw) as DisambiguationResult;
            } catch {
              // ignore — empty object is the safe fallback
            }
            return yield* Effect.fail(new TflDisambiguationError({ result }));
          }

          if (!response.ok) {
            const body = yield* Effect.tryPromise({
              try: () => response.text(),
              catch: () =>
                new TflError({ message: "Failed to read error response body", cause: undefined }),
            }).pipe(Effect.orElse(() => Effect.succeed("")));
            return yield* Effect.fail(
              new TflError({
                message: `TfL API error ${response.status}: ${response.statusText}. ${body}`,
                cause: undefined,
              }),
            );
          }

          return yield* Effect.tryPromise({
            try: () => response.json() as Promise<T>,
            catch: (e) =>
              new TflError({
                message: e instanceof Error ? e.message : `TfL JSON parse failed: ${path}`,
                cause: e,
              }),
          });
        }),
    };
  }),
);
