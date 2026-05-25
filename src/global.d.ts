/// <reference types="node" />

export {};

declare global {
  var process: NodeJS.Process;
  var Buffer: typeof globalThis.Buffer;
}