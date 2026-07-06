import * as v from 'valibot';
import type { MeTTaAtom } from '../types/ast.js';

const MeTTaAtomSchema: v.GenericSchema<MeTTaAtom> = v.lazy(() =>
  v.union([
    v.object({ type: v.literal('symbol'), value: v.string() }),
    v.object({ type: v.literal('variable'), name: v.string() }),
    v.object({ type: v.literal('number'), value: v.number() }),
    v.object({ type: v.literal('expression'), items: v.array(MeTTaAtomSchema) }),
    v.object({ type: v.literal('grounded'), value: v.unknown(), typeHint: v.string() }),
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
