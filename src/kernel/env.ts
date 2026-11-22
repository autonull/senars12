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
export interface EnvOracleRegistry extends OracleRegistry {}

/** Faculty provider for the environment. */
export interface EnvFacultyRegistry extends FacultyRegistry {}

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
export class DeterministicRNG implements RNG {
  private state: Uint32Array;

  constructor(seed = 0x12345678) {
    this.state = new Uint32Array(4);
    this.setSeed(seed);
  }

  setSeed(seed: number): void {
    // 32-bit seed expansion (Math.imul keeps every step exact in JS numbers).
    let s = (seed >>> 0) || 0x9e3779b9;
    for (let i = 0; i < 4; i++) {
      s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b) + i) >>> 0;
      this.state[i] = s;
    }
    if (this.state[0] === 0 && this.state[1] === 0 && this.state[2] === 0 && this.state[3] === 0) {
      this.state[0] = 1;
    }
  }

  getSeed(): number {
    return this.state[0] ?? 0;
  }

  next(): number {
    const s0 = this.state[0] ?? 0;
    const s1 = this.state[1] ?? 0;
    const s2 = this.state[2] ?? 0;
    const s3 = this.state[3] ?? 0;
    const t = s0 ^ (s0 << 11);
    this.state[0] = s1;
    this.state[1] = s2;
    this.state[2] = s3;
    this.state[3] = (s3 ^ (s3 >>> 19)) ^ (t ^ (t >>> 8));
    return ((this.state[3] ?? 0) >>> 0) / 0x100000000;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  nextBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(this.next() * 256);
    }
    return bytes;
  }
}

/** Default deterministic clock implementation. */
export class DeterministicClock implements Clock {
  private time: TimestampMs;

  constructor(initialTime: TimestampMs = 0 as TimestampMs) {
    this.time = initialTime;
  }

  now(): TimestampMs {
    return this.time;
  }

  setTime(ts: TimestampMs): void {
    this.time = ts;
  }

  advance(ms: number): void {
    this.time = (this.time + ms) as TimestampMs;
  }
}

/** Default deterministic ID generator. */
export class DeterministicIDGenerator implements IDGenerator {
  private rng: RNG;
  private counter = 0;

  constructor(rng: RNG) {
    this.rng = rng;
  }

  uuid(): UUID {
    // RFC4122 v4-style UUID from deterministic RNG
    const bytes = this.rng.nextBytes(16);
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10
    return bytes.reduce((str, b, i) => {
      if (i === 4 || i === 6 || i === 8 || i === 10) str += '-';
      return str + b.toString(16).padStart(2, '0');
    }, '') as UUID;
  }

  short(): string {
    return `${this.counter++}-${this.rng.nextInt(0x10000).toString(16).padStart(4, '0')}`;
  }
}

/** Create the deterministic sources an environment provides. */
export function createEnvCore(options: { seed?: number; initialTime?: TimestampMs } = {}): EnvCore {
  const rng = new DeterministicRNG(options.seed ?? 0x12345678);
  const clock = new DeterministicClock(options.initialTime ?? (0 as TimestampMs));
  const ids = new DeterministicIDGenerator(rng);
  return { rng, clock, ids };
}

/** Create a new Env from deterministic sources and the given parts. */
export function createEnv(config: EnvConfig): Env {
  const core = config.rng && config.clock && config.ids
    ? { rng: config.rng, clock: config.clock, ids: config.ids }
    : createEnvCore({ seed: config.seed, initialTime: config.initialTime });
  return {
    ...core,
    oracles: config.oracles,
    faculties: config.faculties,
  };
}

/** Create an Env for replay (fixed seed, fixed time). */
export function createReplayEnv(
  seed: number,
  parts: Pick<EnvConfig, 'oracles' | 'faculties'>,
  initialTime: TimestampMs = 0 as TimestampMs
): Env {
  return createEnv({ seed, initialTime, ...parts });
}

/** Create a default clock for non-deterministic contexts (e.g., testing). */
export function createDefaultClock(): Clock {
  return new DeterministicClock();
}

/** Create a default RNG for non-deterministic contexts (e.g., testing). */
export function createDefaultRNG(): RNG {
  return new DeterministicRNG();
}