import { Context, type Effect } from "effect";
import type { TflDisambiguationError, TflError } from "./errors.ts";

export interface TflClientService {
  readonly request: <T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ) => Effect.Effect<T, TflError | TflDisambiguationError>;
}

export class TflClient extends Context.Tag("TflClient")<
  TflClient,
  TflClientService
>() {}
