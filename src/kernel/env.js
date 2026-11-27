/**
 * Env — deterministic execution environment for the fold.
 *
 * All sources of non-determinism (time, randomness, IDs) are provided
 * through this interface. This enables byte-identical replay by
 * substituting deterministic implementations.
 */
/** Default deterministic RNG implementation (xorshift128+). */
export class DeterministicRNG {
    state;
    constructor(seed = 0x12345678) {
        this.state = new Uint32Array(4);
        this.setSeed(seed);
    }
    setSeed(seed) {
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
    getSeed() {
        return this.state[0] ?? 0;
    }
    next() {
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
    nextInt(max) {
        return Math.floor(this.next() * max);
    }
    nextBytes(length) {
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            bytes[i] = Math.floor(this.next() * 256);
        }
        return bytes;
    }
}
/** Default deterministic clock implementation. */
export class DeterministicClock {
    time;
    constructor(initialTime = 0) {
        this.time = initialTime;
    }
    now() {
        return this.time;
    }
    setTime(ts) {
        this.time = ts;
    }
    advance(ms) {
        this.time = (this.time + ms);
    }
}
/** Default deterministic ID generator. */
export class DeterministicIDGenerator {
    rng;
    counter = 0;
    constructor(rng) {
        this.rng = rng;
    }
    uuid() {
        // RFC4122 v4-style UUID from deterministic RNG
        const bytes = this.rng.nextBytes(16);
        bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
        bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10
        return bytes.reduce((str, b, i) => {
            if (i === 4 || i === 6 || i === 8 || i === 10)
                str += '-';
            return str + b.toString(16).padStart(2, '0');
        }, '');
    }
    short() {
        return `${this.counter++}-${this.rng.nextInt(0x10000).toString(16).padStart(4, '0')}`;
    }
}
/** Create the deterministic sources an environment provides. */
export function createEnvCore(options = {}) {
    const rng = new DeterministicRNG(options.seed ?? 0x12345678);
    const clock = new DeterministicClock(options.initialTime ?? 0);
    const ids = new DeterministicIDGenerator(rng);
    return { rng, clock, ids };
}
/** Create a new Env from deterministic sources and the given parts. */
export function createEnv(config) {
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
export function createReplayEnv(seed, parts, initialTime = 0) {
    return createEnv({ seed, initialTime, ...parts });
}
/** Create a default clock for non-deterministic contexts (e.g., testing). */
export function createDefaultClock() {
    return new DeterministicClock();
}
/** Create a default RNG for non-deterministic contexts (e.g., testing). */
export function createDefaultRNG() {
    return new DeterministicRNG();
}
