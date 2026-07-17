import * as v from 'valibot';
import type { MeTTaAtom } from '../types/ast.js';
declare const IPCMessageSchema: v.UnionSchema<[v.ObjectSchema<{
    readonly type: v.LiteralSchema<"query", undefined>;
    readonly id: v.StringSchema<undefined>;
    readonly pattern: v.GenericSchema<MeTTaAtom>;
}, undefined>, v.ObjectSchema<{
    readonly type: v.LiteralSchema<"result", undefined>;
    readonly id: v.StringSchema<undefined>;
    readonly results: v.ArraySchema<v.GenericSchema<MeTTaAtom>, undefined>;
}, undefined>, v.ObjectSchema<{
    readonly type: v.LiteralSchema<"error", undefined>;
    readonly id: v.StringSchema<undefined>;
    readonly error: v.StringSchema<undefined>;
}, undefined>], undefined>;
export type IPCMessage = v.InferOutput<typeof IPCMessageSchema>;
export declare function serialize(msg: IPCMessage): Uint8Array;
export declare function deserialize(bytes: Uint8Array): IPCMessage;
export {};
//# sourceMappingURL=protocol.d.ts.map