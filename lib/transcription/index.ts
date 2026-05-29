/**
 * Public entrypoint for the transcription pipeline.
 *
 * `PARSER_VERSION` is bumped whenever the parser or derivation changes in a way
 * that should invalidate cached renders (it's part of the render cache key).
 */

export const PARSER_VERSION = 1;

export * from "./types";
export { parseOcrec, HeaderError } from "./parse-jsonl";
export { derive } from "./derive";
export type { DeriveOptions } from "./derive";
export { generateOcrec, generateOcrecGzip, noteNameToMidi } from "./fake-events";
export type { SongSpec, SongNote, SongOptions } from "./fake-events";
export { SONGS, getSong, SONG_NAMES } from "./songs";
export { canonicalizeParams, paramsHash } from "./params-hash";
