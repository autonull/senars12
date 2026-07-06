export type { MeTTaAtom } from './types/ast.js';
export type { MeTTaSpace, ImmutableSpace } from './types/space.js';
export { parseMeTTa } from './parser/runtime.js';
export { EGraph, type RewriteRule } from './engine/egraph.js';
export { MeTTaInterpreter } from './engine/interpreter.js';
export type { IPCMessage } from './ipc/protocol.js';
export { serialize, deserialize } from './ipc/protocol.js';
export { SharedMemoryQueue } from './ipc/shared-memory.js';
export { MeTTaRuntime, type MeTTaContext } from './runtime/context.js';
