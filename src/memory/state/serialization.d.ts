/**
 * Memory serialization.
 *
 * Full round-trip: Narsese terms, truth, budget priority, concept priorities,
 * and stamps. Restored stamp IDs re-seed the atomic counter (see
 * observeStampId), so newly minted stamps never collide with reloaded ones.
 *
 * No version migration is kept: there are no persisted dumps in the wild yet,
 * so the format is versioned (version 1) but has a single reader/writer.
 */
import { type TaskRecord } from '../../task/record';
import type { ConceptWriter } from '../ports';
export interface SerializedMemory {
    version: number;
    timestamp: number;
    concepts: SerializedConcept[];
    statistics: {
        totalConcepts: number;
        totalTasks: number;
    };
}
export interface SerializedConcept {
    term: string;
    priority: number;
    beliefs: TaskRecord[];
    goals: TaskRecord[];
    questions: TaskRecord[];
}
export declare const MEMORY_VERSION = 1;
/** Schema-pinned, versioned persistence format for the memory dump (StateCodec, TODO20 X7). */
export declare const encodeMemoryState: (memory: ConceptWriter) => string;
/** Inverse of encodeMemoryState; accepts legacy bare SerializedMemory files. */
export declare const decodeMemoryState: (text: string) => SerializedMemory;
export declare function serialize(memory: ConceptWriter): SerializedMemory;
export declare function deserialize(data: SerializedMemory, memory: ConceptWriter): Promise<void>;
export declare function validate(data: Partial<SerializedMemory>): boolean;
export declare function repair(data: Partial<SerializedMemory>): SerializedMemory | null;
//# sourceMappingURL=serialization.d.ts.map