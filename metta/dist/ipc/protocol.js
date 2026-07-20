import * as v from 'valibot';
const MeTTaAtomSchema = v.lazy(() =>
  v.union([
    v.object({ kind: v.literal(0), value: v.string() }),
    v.object({ kind: v.literal(1), name: v.string() }),
    v.object({ kind: v.literal(2), value: v.number() }),
    v.object({ kind: v.literal(3), value: v.string() }),
    v.object({ kind: v.literal(4), operator: MeTTaAtomSchema, args: v.array(MeTTaAtomSchema) }),
    v.object({ kind: v.literal(5), op: v.string(), args: v.array(MeTTaAtomSchema) }),
  ])
);
const IPCMessageSchema = v.union([
  v.object({ type: v.literal('query'), id: v.string(), pattern: MeTTaAtomSchema }),
  v.object({ type: v.literal('result'), id: v.string(), results: v.array(MeTTaAtomSchema) }),
  v.object({ type: v.literal('error'), id: v.string(), error: v.string() }),
]);
export function serialize(msg) {
  const json = JSON.stringify(msg);
  return new TextEncoder().encode(json);
}
export function deserialize(bytes) {
  const json = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(json);
  return v.parse(IPCMessageSchema, parsed);
}
//# sourceMappingURL=protocol.js.map
