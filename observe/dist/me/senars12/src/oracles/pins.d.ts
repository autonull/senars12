/**
 * Oracle Pins — deterministic pinning for oracle outputs.
 *
 * Pins capture the exact output of non-deterministic operations so that replay is byte-identical.
 * This is a simplified version that integrates with the log/pins.ts implementation.
 */
import type { UUID, TimestampMs } from '../generated/schemas';
import type { OracleOperation } from './oracle';
/** A pinned value for deterministic replay. */
export interface OraclePin<T = unknown> {
    /** Unique pin ID. */
    id: UUID;
    /** Operation type that was pinned. */
    operation: OracleOperation;
    /** Input hash that produced this output. */
    queryDigest: string;
    /** Provider that fulfilled the call. */
    provider: string;
    /** Model/engine version. */
    version?: string;
    /** Context for pinning/replay. */
    context?: Record<string, unknown>;
    /** The pinned output value. */
    output: T;
    /** When this pin was created. */
    ts: TimestampMs;
    /** Schema version of the output. */
    schemaVersion: number;
}
/** Pin store configuration. */
export interface OraclePinStoreConfig {
    /** Directory for pin files. */
    dir: string;
    /** Maximum pins per file. */
    maxPinsPerFile: number;
    /** Whether to compress pins. */
    compress: boolean;
}
/** Default pin store configuration. */
export declare const defaultOraclePinStoreConfig: OraclePinStoreConfig;
/**
 * Pin store for deterministic replay of oracle calls.
 */
export declare class OraclePinStore {
    private config;
    private index;
    private currentFile;
    private currentCount;
    private currentFd;
    private initialized;
    constructor(config?: Partial<OraclePinStoreConfig>);
    /** Initialize the pin store. */
    open(): Promise<void>;
    /** Load existing pins into index. */
    private loadIndex;
    /** Open current write file. */
    private openCurrentFile;
    /** Compute query digest from args only. */
    hashInput(args: unknown[]): string;
    /** Get or create a pin for an operation. */
    getOrPin<T>(operation: OracleOperation, args: unknown[], provider: string, version: string | undefined, context: Record<string, unknown> | undefined, compute: () => Promise<T>): Promise<T>;
    /** Store a pin. */
    pin<T>(operation: OracleOperation, queryDigest: string, provider: string, version: string | undefined, context: Record<string, unknown> | undefined, output: T): Promise<UUID>;
    /** Check if a pin exists. */
    hasPin(operation: OracleOperation, args: unknown[], provider: string, version?: string, context?: Record<string, unknown>): boolean;
    /** Get a pinned value without computing. */
    getPin<T>(operation: OracleOperation, args: unknown[], provider: string, version?: string, context?: Record<string, unknown>): Promise<T | null>;
    /** Get all pins for an operation. */
    getPinsForOperation<T>(operation: OracleOperation): Promise<OraclePin<T>[]>;
    /** Close the pin store. */
    close(): Promise<void>;
    /** Get statistics. */
    getStats(): {
        pins: number;
        files: number;
        operations: Set<OracleOperation>;
    };
}
/** Create a pin store. */
export declare function createOraclePinStore(config?: Partial<OraclePinStoreConfig>): OraclePinStore;
/**
 * Pinning decorator for class methods.
 * Usage: @oraclePin('operation-name', 'provider', 'version', context) async method(...args) { ... }
 */
export declare function oraclePin(operation: OracleOperation, provider: string, version?: string, context?: Record<string, unknown>): (target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<unknown>>) => TypedPropertyDescriptor<(...args: unknown[]) => Promise<unknown>>;
/** Higher-order function to pin a function. */
export declare function withOraclePin<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, operation: OracleOperation, provider: string, version: string | undefined, context: Record<string, unknown> | undefined, store: OraclePinStore): T;
/**
 * Replay-pinned function: during replay, returns pinned value; during live, computes and pins.
 */
export declare function createReplayOraclePinned<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, operation: OracleOperation, provider: string, version: string | undefined, context: Record<string, unknown> | undefined, store: OraclePinStore, isReplay: boolean): T;
//# sourceMappingURL=pins.d.ts.map