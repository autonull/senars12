import type { MeTTaAtom } from '../types/ast.js';

export type IPCMessage =
  | { type: 'query'; id: string; pattern: MeTTaAtom }
  | { type: 'result'; id: string; results: MeTTaAtom[] }
  | { type: 'error'; id: string; error: string };

export function serialize(msg: IPCMessage): Uint8Array {
  const json = JSON.stringify(msg);
  return new TextEncoder().encode(json);
}

export function deserialize(bytes: Uint8Array): IPCMessage {
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as IPCMessage;
}
