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
export function createJsonCodec<T>(): Codec<T> {
  return {
    serialize: (value: T) => new TextEncoder().encode(JSON.stringify(value)),
    deserialize: (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes)),
    toString: (value: T) => JSON.stringify(value),
    fromString: (str: string) => JSON.parse(str),
    version: 1,
  };
}

/** Task codec. */
export const TaskCodec: Codec<Task> = createJsonCodec<Task>();

/** Concept codec. */
export const ConceptCodec: Codec<Concept> = createJsonCodec<Concept>();

/** Term codec. */
export const TermCodec: Codec<Term> = createJsonCodec<Term>();

/** Truth codec. */
export const TruthCodec: Codec<Truth> = createJsonCodec<Truth>();

/** Stamp codec. */
export const StampCodec: Codec<Stamp> = createJsonCodec<Stamp>();

/** Belief codec. */
export const BeliefCodec: Codec<Belief> = createJsonCodec<Belief>();

/** Episode codec. */
export const EpisodeCodec: Codec<Episode> = createJsonCodec<Episode>();

/** Codec registry for dynamic codec lookup. */
export class CodecRegistry {
  private readonly codecs = new Map<string, Codec<any>>();

  /** Register a codec by type name. */
  register<T>(typeName: string, codec: Codec<T>): void {
    this.codecs.set(typeName, codec);
  }

  /** Get a codec by type name. */
  get<T>(typeName: string): Codec<T> | undefined {
    return this.codecs.get(typeName);
  }

  /** Check if a codec is registered. */
  has(typeName: string): boolean {
    return this.codecs.has(typeName);
  }

  /** Get all registered type names. */
  getTypeNames(): string[] {
    return Array.from(this.codecs.keys());
  }
}

/** Global codec registry instance. */
export const codecRegistry = new CodecRegistry();

// Register core codecs
codecRegistry.register('Task', TaskCodec);
codecRegistry.register('Concept', ConceptCodec);
codecRegistry.register('Term', TermCodec);
codecRegistry.register('Truth', TruthCodec);
codecRegistry.register('Stamp', StampCodec);
codecRegistry.register('Belief', BeliefCodec);
codecRegistry.register('Episode', EpisodeCodec);