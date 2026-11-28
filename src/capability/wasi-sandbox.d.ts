import { containsPath } from '@senars/util/fs';
import { SenarsError } from '@senars/errors';
export declare class SandboxTimeoutError extends SenarsError {
    readonly timeoutMs: number;
    constructor(timeoutMs: number);
}
export interface WasiSandboxOptions {
    allowedPaths?: string[];
    env?: Record<string, string>;
    args?: string[];
    timeoutMs?: number;
}
export declare const DEFAULT_SANDBOX_TIMEOUT_MS = 30000;
export declare function sanitizePreopens(paths?: string[]): Record<string, string>;
/** Rejects with {@link SandboxTimeoutError} when the sandbox deadline elapses. */
export declare const withSandboxTimeout: <T>(promise: Promise<T>, timeoutMs: number) => Promise<T>;
export { containsPath };
export declare function assertWasmPathContained(wasmPath: string, allowedPaths?: string[]): void;
export declare function createWasiSandbox(options?: WasiSandboxOptions): Promise<(fn: () => Promise<unknown>) => Promise<unknown>>;
export interface WasmModuleOptions {
    wasmPath: string;
    allowedPaths?: string[];
    env?: Record<string, string>;
    args?: string[];
    timeoutMs?: number;
    imports?: Record<string, unknown>;
}
export interface WasmRunResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}
export declare function createWasmModuleSandbox(options: WasmModuleOptions): Promise<WasmRunResult>;
/**
 * @deprecated Trusted-but-faulty code isolation only — NOT a security boundary.
 * `node:vm` does not isolate untrusted code (shared primordials, known escapes).
 * Use `createWasiSandbox` for untrusted execution.
 */
export declare function createNodeVMSandbox(): <T>(fn: () => Promise<T>) => Promise<T>;
//# sourceMappingURL=wasi-sandbox.d.ts.map