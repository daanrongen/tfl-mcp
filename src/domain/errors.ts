import { Data } from "effect";
import type { DisambiguationResult } from "./models.ts";

export class TflError extends Data.TaggedError("TflError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class TflDisambiguationError extends Data.TaggedError("TflDisambiguationError")<{
  readonly result: DisambiguationResult;
}> {}
