import * as v from 'valibot';
import type { MeTTaAtom } from '../types/ast.js';

const MeTTaAtomSchema: v.GenericSchema<MeTTaAtom> = v.lazy(() =>
  v.union([
    v.object({ kind: v.literal(0), value: v.string() }),
    v.object({ kind: v.literal(1), name: v.string() }),
    v.object({ kind: v.literal(2), value: v.number() }),
    v.object({ kind: v.literal(3), value: v.string() }),
    v.object({ kind: v.literal(4), operator: MeTTaAtomSchema, args: v.array(MeTTaAtomSchema) }),
    v.object({ kind: v.literal(5), op: v.string(), args: v.array(MeTTaAtomSchema) }),
  ]) as v.GenericSchema<MeTTaAtom>
);

const IPCMessageSchema = v.union([
  v.object({ type: v.literal('query'), id: v.string(), pattern: MeTTaAtomSchema }),
  v.object({ type: v.literal('result'), id: v.string(), results: v.array(MeTTaAtomSchema) }),
  v.object({ type: v.literal('error'), id: v.string(), error: v.string() }),
]);

export type IPCMessage = v.InferOutput<typeof IPCMessageSchema>;

export function serialize(msg: IPCMessage): Uint8Array {
  const json = JSON.stringify(msg);
  return new TextEncoder().encode(json);
}

export function deserialize(bytes: Uint8Array): IPCMessage {
  const json = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(json);
  return v.parse(IPCMessageSchema, parsed);
}