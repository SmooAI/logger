/* eslint-disable @typescript-eslint/no-explicit-any -- ok */
// src/rotating-file-stream.stub.ts
// everything here is a no‐op or minimal stub so your browser bundle never actually tries
// to do file I/O.

/** no‐op writable “stream” stub */
export function createStream(): any {
  return {
    write: () => {}, // no‐op
    end: () => {}, // no‐op
    // …add any other methods you actually use in Logger.ts
  };
}

/** these types exist so your imports still type‐check */
export type RotatingFileStream = any;
export type Generator = any;
export type Options = any;
