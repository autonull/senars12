/**
 * Env — deterministic execution environment for the fold.
 *
 * All sources of non-determinism (time, randomness, IDs) are provided
 * through this interface. This enables byte-identical replay by
 * substituting deterministic implementations.
 */
import type { UUID, TimestampMs } from '../generated/schemas';
import type { OracleRegistry } from '../oracles/oracle';
import type { FacultyRegistry } from '../faculties/specs';
/** Re-export TimestampMs for consumers. */
export type { TimestampMs } from '../generated/schemas';
/** Random number generator interface. */
export interface RNG {
    /** Next random float in [0, 1). */
    next(): number;
    /** Next random integer in [0, max). */
    nextInt(max: number): number;
    /** Next random bytes. */
    nextBytes(length: number): Uint8Array;
    /** Set seed for deterministic replay. */
    setSeed(seed: number): void;
    /** Get current seed. */
    getSeed(): number;
}
/** Clock interface. */
export interface Clock {
    /** Current timestamp in milliseconds. */
    now(): TimestampMs;
    /** Set fixed time for testing/replay. */
    setTime(ts: TimestampMs): void;
    /** Advance time by ms. */
    advance(ms: number): void;
}
/** ID generator interface. */
export interface IDGenerator {
    /** Generate a new UUID. */
    uuid(): UUID;
    /** Generate a short ID. */
    short(): string;
}
/** Oracle provider for the environment. */
export interface EnvOracleRegistry extends OracleRegistry {
}
/** Faculty provider for the environment. */
export interface EnvFacultyRegistry extends FacultyRegistry {
}
/** Complete environment for the fold. */
export interface Env {
    /** Random number generator. */
    rng: RNG;
    /** Clock. */
    clock: Clock;
    /** ID generator. */
    ids: IDGenerator;
    /** Oracle registry. */
    oracles: EnvOracleRegistry;
    /** Faculty registry. */
    faculties: EnvFacultyRegistry;
}
/** The deterministic sources an environment provides. */
export interface EnvCore {
    /** Random number generator. */
    rng: RNG;
    /** Clock. */
    clock: Clock;
    /** ID generator. */
    ids: IDGenerator;
}
/** Configuration for creating an Env. */
export interface EnvConfig extends Partial<EnvCore> {
    /** Initial RNG seed. */
    seed?: number;
    /** Initial clock time. */
    initialTime?: TimestampMs;
    /** Oracle registry. */
    oracles: EnvOracleRegistry;
    /** Faculty registry. */
    faculties: EnvFacultyRegistry;
}
/** Default deterministic RNG implementation (xorshift128+). */
export declare class DeterministicRNG implements RNG {
    private state;
    constructor(seed?: number);
    setSeed(seed: number): void;
    getSeed(): number;
    next(): number;
    nextInt(max: number): number;
    nextBytes(length: number): Uint8Array;
}
/** Default deterministic clock implementation. */
export declare class DeterministicClock implements Clock {
    private time;
    constructor(initialTime?: TimestampMs);
    now(): TimestampMs;
    setTime(ts: TimestampMs): void;
    advance(ms: number): void;
}
/** Default deterministic ID generator. */
export declare class DeterministicIDGenerator implements IDGenerator {
    private rng;
    private counter;
    constructor(rng: RNG);
    uuid(): UUID;
    short(): string;
}
/** Create the deterministic sources an environment provides. */
export declare function createEnvCore(options?: {
    seed?: number;
    initialTime?: TimestampMs;
}): EnvCore;
/** Create a new Env from deterministic sources and the given parts. */
export declare function createEnv(config: EnvConfig): Env;
/** Create an Env for replay (fixed seed, fixed time). */
export declare function createReplayEnv(seed: number, parts: Pick<EnvConfig, 'oracles' | 'faculties'>, initialTime?: TimestampMs): Env;
/** Create a default clock for non-deterministic contexts (e.g., testing). */
export declare function createDefaultClock(): Clock;
/** Create a default RNG for non-deterministic contexts (e.g., testing). */
export declare function createDefaultRNG(): RNG;
//# sourceMappingURL=env.d.ts.map