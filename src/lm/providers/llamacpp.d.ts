import { AsyncLocalStorage } from 'node:async_hooks';
/** Default llama.cpp server (llama-server) address. */
export declare const LLAMACPP_HOST_DEFAULT = "http://localhost:8080";
/**
 * Request-scoped GBNF grammar for constrained decoding. The llamacpp fetch
 * wrapper injects whatever grammar is active in the current async context into
 * the completion payload; other providers ignore it (prompt-level fallback).
 */
export declare const grammarScope: AsyncLocalStorage<string>;
export declare const runWithGrammar: <T>(grammar: string, fn: () => Promise<T>) => Promise<T>;
export interface LlamaCppFetchOptions {
    /** Inject chat_template_kwargs {thinking:false} (Qwen-family reasoning models). */
    disableThinking?: boolean;
}
/** Placeholder model id; substituted with the server's loaded alias on first request. */
export declare const MODEL_PLACEHOLDER = "local-model";
/**
 * Native fetch for llama.cpp's OpenAI-compatible server: passes GBNF `grammar`
 * and JSON response formats straight through to the native backend, and swaps
 * the placeholder model id for the server's loaded alias.
 */
export declare const createLlamaCppFetch: (opts?: LlamaCppFetchOptions) => typeof fetch;
/** Probe llama-server's native /health endpoint. */
export declare const probeLlamaCpp: (host?: string) => Promise<boolean>;
//# sourceMappingURL=llamacpp.d.ts.map