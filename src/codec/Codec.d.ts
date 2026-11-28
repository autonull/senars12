/**
 * Codec Interface — versioned serialization for all core types.
 *
 * Every core type gets a codec for deterministic, migratable persistence.
 * Codecs are the single serialization path — no inline JSON.stringify calls.
 */
import type { Concept } from '../memory/concept';
import type { Term } from '../terms/index';
import type { Task } from '../types/index';
import type { Truth } from '../kernel/truth';
import type { Stamp } from '../kernel/stamp';
import type { Belief } from '../memory/view';
import type { Episode } from '@senars/types/episodic-memory';
/** Codec interface for any type T. */
export interface Codec<T> {
    /** Serialize value to bytes. */
    serialize(value: T): Uint8Array;
    /** Deserialize bytes to value. */
    deserialize(bytes: Uint8Array): T;
    /** Optional: serialize to human-readable string. */
    toString?(value: T): string;
    /** Optional: deserialize from human-readable string. */
    fromString?(str: string): T;
    /** Schema version for migrations. */
    version: number;
}
/** JSON codec helper — uses JSON for simplicity, can be replaced with CBOR/msgpack. */
export declare function createJsonCodec<T>(): Codec<T>;
/** Task codec. */
export declare const TaskCodec: Codec<Task>;
/** Concept codec. */
export declare const ConceptCodec: Codec<Concept>;
/** Term codec. */
export declare const TermCodec: Codec<Term>;
/** Truth codec. */
export declare const TruthCodec: Codec<Truth>;
/** Stamp codec. */
export declare const StampCodec: Codec<Stamp>;
/** Belief codec. */
export declare const BeliefCodec: Codec<Belief>;
/** Episode codec. */
export declare const EpisodeCodec: Codec<Episode>;
/** Codec registry for dynamic codec lookup. */
export declare class CodecRegistry {
    private readonly codecs;
    /** Register a codec by type name. */
    register<T>(typeName: string, codec: Codec<T>): void;
    /** Get a codec by type name. */
    get<T>(typeName: string): Codec<T> | undefined;
    /** Check if a codec is registered. */
    has(typeName: string): boolean;
    /** Get all registered type names. */
    getTypeNames(): string[];
}
/** Global codec registry instance. */
export declare const codecRegistry: CodecRegistry;
//# sourceMappingURL=Codec.d.ts.map