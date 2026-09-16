import { AsyncLocalStorage } from 'node:async_hooks';

/** Default llama.cpp server (llama-server) address. */
export const LLAMACPP_HOST_DEFAULT = 'http://localhost:8080';

/**
 * Request-scoped GBNF grammar for constrained decoding. The llamacpp fetch
 * wrapper injects whatever grammar is active in the current async context into
 * the completion payload; other providers ignore it (prompt-level fallback).
 */
export const grammarScope = new AsyncLocalStorage<string>();

export const runWithGrammar = <T>(grammar: string, fn: () => Promise<T>): Promise<T> =>
  grammarScope.run(grammar, fn);

export interface LlamaCppFetchOptions {
  /** Inject chat_template_kwargs {thinking:false} (Qwen-family reasoning models). */
  disableThinking?: boolean;
}

/** Placeholder model id; substituted with the server's loaded alias on first request. */
const MODEL_PLACEHOLDER = 'local-model';

let resolvedModel: Promise<string> | undefined;

/** llama-server 400s on unknown model ids — resolve the loaded alias once and cache. */
const resolveModelId = (origin: string): Promise<string> => {
  resolvedModel ??= (async () => {
    try {
      const res = await fetch(`${origin}/v1/models`);
      if (!res.ok) return MODEL_PLACEHOLDER;
      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      return json.data?.[0]?.id ?? MODEL_PLACEHOLDER;
    } catch {
      return MODEL_PLACEHOLDER;
    }
  })();
  return resolvedModel;
};

/**
 * Native fetch for llama.cpp's OpenAI-compatible server: passes GBNF `grammar`
 * and JSON response formats straight through to the native backend, and swaps
 * the placeholder model id for the server's loaded alias.
 */
export const createLlamaCppFetch =
  (opts: LlamaCppFetchOptions = {}): typeof fetch =>
  async (input, init) => {
    const grammar = grammarScope.getStore();
    if (typeof init?.body !== 'string') return fetch(input, init);
    try {
      const body = JSON.parse(init.body);
      // Bounded generation: uncapped small-model runs wander (and burn GPU time).
      body.max_tokens ??= 768;
      if (opts.disableThinking && body.messages && !body.chat_template_kwargs) {
        body.chat_template_kwargs = { enable_thinking: false };
      }
      if (grammar) body.grammar = grammar;
      if (!body.model || body.model === MODEL_PLACEHOLDER) {
        const origin =
          typeof input === 'string' ? new URL(input).origin : input instanceof URL ? input.origin : '';
        if (origin) body.model = await resolveModelId(origin);
      }
      init = { ...init, body: JSON.stringify(body) };
    } catch {
      /* non-JSON body: pass through untouched */
    }
    return fetch(input, init);
  };

/** Probe llama-server's native /health endpoint. */
export const probeLlamaCpp = async (host?: string): Promise<boolean> => {
  const base = (host ?? process.env.LM_LLAMACPP_HOST ?? LLAMACPP_HOST_DEFAULT).replace(/\/v1\/?$/, '');
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const res = await fetch(`${base}/health`, { signal: ctl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
};
