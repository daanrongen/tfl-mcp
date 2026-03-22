import { Data } from "effect";

export class TflError extends Data.TaggedError("TflError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class TflDisambiguationError extends Data.TaggedError("TflDisambiguationError")<{
  readonly result: DisambiguationResult;
}> {}

export type DisambiguationOption = {
  readonly parameterValue: string;
  readonly place: {
    readonly commonName?: string;
    readonly placeType?: string;
    readonly lat?: number;
    readonly lon?: number;
    readonly naptanId?: string;
    readonly icsCode?: string;
  };
  readonly matchQuality: number;
};

export type DisambiguationResult = {
  readonly fromLocationDisambiguation?: {
    readonly matchStatus: string;
    readonly disambiguationOptions?: DisambiguationOption[];
  };
  readonly toLocationDisambiguation?: {
    readonly matchStatus: string;
    readonly disambiguationOptions?: DisambiguationOption[];
  };
};
