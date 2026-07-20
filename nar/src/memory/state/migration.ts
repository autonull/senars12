/**
 * Versioned memory state migration.
 *
 * Each serialization version exports an immutable contract (V1, V2, ...).
 * `detectVersion` reads the version field; `loadMemoryState` applies the
 * appropriate migration chain before delegating to the target deserializer.
 */

import type { Memory } from '../memory.js';
import { MEMORY_VERSION, V1 } from './serialization.js';
import type { SerializedMemory } from './serialization.js';

export type MemoryVersion = 1;

const MIGRATIONS: Record<number, (data: SerializedMemory) => SerializedMemory> = {};

export function detectVersion(data: Partial<SerializedMemory>): MemoryVersion {
  return (data.version as MemoryVersion) ?? 1;
}

function migrate(from: number, to: number, data: SerializedMemory): SerializedMemory {
  let current = data;
  for (let v = from; v < to; v++) {
    const step = MIGRATIONS[v];
    if (step) current = step(current);
  }
  return current;
}

export async function loadMemoryState(
  data: Partial<SerializedMemory>,
  memory: Memory
): Promise<void> {
  const target = detectVersion(data);
  if (target !== MEMORY_VERSION) {
    throw new Error(`Unsupported memory version: ${target}`);
  }
  const migrated = migrate(target, MEMORY_VERSION, data as SerializedMemory);
  await V1.deserialize(migrated, memory);
}
