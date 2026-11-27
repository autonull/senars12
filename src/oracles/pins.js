/**
 * Oracle Pins — deterministic pinning for oracle outputs.
 *
 * Pins capture the exact output of non-deterministic operations so that replay is byte-identical.
 * This is a simplified version that integrates with the log/pins.ts implementation.
 */
import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { createLogger } from '../util/logger';
const logger = createLogger({ scope: 'oracles:pins' });
/** Default pin store configuration. */
export const defaultOraclePinStoreConfig = {
    dir: join(process.cwd(), 'data', 'oracle-pins'),
    maxPinsPerFile: 10000,
    compress: false,
};
/** Compute query digest from args. */
function computeQueryDigest(args) {
    const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
}
/** Generate full pin key from components. */
function generatePinKey(operation, args, provider, version, context) {
    const queryDigest = computeQueryDigest(args);
    const serialized = `${operation}:${queryDigest}:${provider}:${version ?? ''}:${JSON.stringify(context ?? {})}`;
    return { queryDigest, key: serialized };
}
/** Serialize pin key components to a string for index lookup. */
function serializeIndexKey(operation, queryDigest, provider, version, context) {
    return `${operation}:${queryDigest}:${provider}:${version ?? ''}:${JSON.stringify(context ?? {})}`;
}
/**
 * Pin store for deterministic replay of oracle calls.
 */
export class OraclePinStore {
    config;
    index = new Map();
    currentFile = 0;
    currentCount = 0;
    currentFd = null;
    initialized = false;
    constructor(config = {}) {
        this.config = { ...defaultOraclePinStoreConfig, ...config };
    }
    /** Initialize the pin store. */
    async open() {
        if (this.initialized)
            return;
        await fs.mkdir(this.config.dir, { recursive: true });
        await this.loadIndex();
        await this.openCurrentFile();
        this.initialized = true;
    }
    /** Load existing pins into index. */
    async loadIndex() {
        try {
            const files = await fs.readdir(this.config.dir);
            const pinFiles = files.filter(f => f.startsWith('pins-') && f.endsWith('.jsonl')).sort();
            for (const file of pinFiles) {
                const path = join(this.config.dir, file);
                const content = await fs.readFile(path, 'utf-8');
                const lines = content.trim().split('\n').filter(l => l);
                let offset = 0;
                for (const line of lines) {
                    try {
                        const pin = JSON.parse(line);
                        const key = serializeIndexKey(pin.operation, pin.queryDigest, pin.provider, pin.version, pin.context);
                        this.index.set(key, {
                            id: pin.id,
                            operation: pin.operation,
                            queryDigest: pin.queryDigest,
                            provider: pin.provider,
                            version: pin.version,
                            context: pin.context,
                            file,
                            offset,
                        });
                        offset += Buffer.byteLength(line + '\n', 'utf-8');
                        this.currentCount++;
                    }
                    catch {
                        // Skip malformed
                    }
                }
            }
            this.currentFile = pinFiles.length;
        }
        catch {
            // No existing pins
        }
    }
    /** Open current write file. */
    async openCurrentFile() {
        const fileName = `pins-${this.currentFile.toString().padStart(4, '0')}.jsonl`;
        const path = join(this.config.dir, fileName);
        this.currentFd = await fs.open(path, 'a');
    }
    /** Compute query digest from args only. */
    hashInput(args) {
        const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        return createHash('sha256').update(json).digest('hex').substring(0, 32);
    }
    /** Get or create a pin for an operation. */
    async getOrPin(operation, args, provider, version, context, compute) {
        await this.open();
        const queryDigest = this.hashInput(args);
        const key = serializeIndexKey(operation, queryDigest, provider, version, context);
        // Check index
        const existing = this.index.get(key);
        if (existing) {
            // Load from file
            const path = join(this.config.dir, existing.file);
            const content = await fs.readFile(path, 'utf-8');
            const lines = content.trim().split('\n');
            for (const line of lines) {
                const pin = JSON.parse(line);
                if (pin.queryDigest === queryDigest && pin.operation === operation && pin.provider === provider && pin.version === version && JSON.stringify(pin.context ?? {}) === JSON.stringify(context ?? {})) {
                    return pin.output;
                }
            }
        }
        // Compute and pin
        const output = await compute();
        await this.pin(operation, queryDigest, provider, version, context, output);
        return output;
    }
    /** Store a pin. */
    async pin(operation, queryDigest, provider, version, context, output) {
        await this.open();
        if (this.currentFd === null)
            await this.openCurrentFile();
        const id = crypto.randomUUID();
        const pin = {
            id,
            operation,
            queryDigest,
            provider,
            version,
            context,
            output,
            ts: Date.now(),
            schemaVersion: 1,
        };
        const line = JSON.stringify(pin) + '\n';
        const buffer = Buffer.from(line, 'utf-8');
        await this.currentFd.write(buffer);
        this.currentCount++;
        const key = serializeIndexKey(operation, queryDigest, provider, version, context);
        this.index.set(key, {
            id,
            operation,
            queryDigest,
            provider,
            version,
            context,
            file: `pins-${this.currentFile.toString().padStart(4, '0')}.jsonl`,
            offset: 0,
        });
        if (this.currentCount >= this.config.maxPinsPerFile) {
            await this.currentFd.close();
            this.currentFile++;
            this.currentCount = 0;
            await this.openCurrentFile();
        }
        return id;
    }
    /** Check if a pin exists. */
    hasPin(operation, args, provider, version, context) {
        const queryDigest = this.hashInput(args);
        const key = serializeIndexKey(operation, queryDigest, provider, version, context);
        return this.index.has(key);
    }
    /** Get a pinned value without computing. */
    async getPin(operation, args, provider, version, context) {
        const queryDigest = this.hashInput(args);
        const key = serializeIndexKey(operation, queryDigest, provider, version, context);
        const existing = this.index.get(key);
        if (!existing)
            return null;
        const path = join(this.config.dir, existing.file);
        const content = await fs.readFile(path, 'utf-8');
        for (const line of content.trim().split('\n')) {
            const pin = JSON.parse(line);
            if (pin.queryDigest === queryDigest && pin.operation === operation && pin.provider === provider && pin.version === version && JSON.stringify(pin.context ?? {}) === JSON.stringify(context ?? {})) {
                return pin.output;
            }
        }
        return null;
    }
    /** Get all pins for an operation. */
    async getPinsForOperation(operation) {
        const results = [];
        for (const [key, entry] of this.index) {
            if (entry.operation === operation) {
                const path = join(this.config.dir, entry.file);
                const content = await fs.readFile(path, 'utf-8');
                for (const line of content.trim().split('\n')) {
                    const pin = JSON.parse(line);
                    if (pin.operation === operation) {
                        results.push(pin);
                    }
                }
            }
        }
        return results;
    }
    /** Close the pin store. */
    async close() {
        if (this.currentFd !== null) {
            await this.currentFd.close();
            this.currentFd = null;
        }
    }
    /** Get statistics. */
    getStats() {
        const operations = new Set();
        for (const entry of this.index.values()) {
            operations.add(entry.operation);
        }
        return {
            pins: this.index.size,
            files: this.currentFile + 1,
            operations,
        };
    }
}
/** Create a pin store. */
export function createOraclePinStore(config) {
    return new OraclePinStore(config);
}
/**
 * Pinning decorator for class methods.
 * Usage: @oraclePin('operation-name', 'provider', 'version', context) async method(...args) { ... }
 */
export function oraclePin(operation, provider, version, context) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const store = createOraclePinStore();
        let initialized = false;
        descriptor.value = async function (...args) {
            if (!initialized) {
                await store.open();
                initialized = true;
            }
            return store.getOrPin(operation, args, provider, version, context, () => originalMethod.apply(this, args));
        };
        return descriptor;
    };
}
/** Higher-order function to pin a function. */
export function withOraclePin(fn, operation, provider, version, context, store) {
    return (async (...args) => {
        return store.getOrPin(operation, args, provider, version, context, () => fn(...args));
    });
}
/**
 * Replay-pinned function: during replay, returns pinned value; during live, computes and pins.
 */
export function createReplayOraclePinned(fn, operation, provider, version, context, store, isReplay) {
    return (async (...args) => {
        if (isReplay) {
            const pinned = await store.getPin(operation, args, provider, version, context);
            if (pinned !== null)
                return pinned;
            logger.warn(`[OraclePin] No pin found for ${operation} during replay, computing`);
        }
        return store.getOrPin(operation, args, provider, version, context, () => fn(...args));
    });
}
