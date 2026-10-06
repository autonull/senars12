import { AsyncLocalStorage } from 'node:async_hooks';
import { envStrOr, errMsg } from '@senars/util';
import { withBodyPatch } from './body-patch.js';
import { endpointPath, probeJson, probeReachable } from './probe.js';
import { withThinkingDisabled } from './thinking.js';

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
export const MODEL_PLACEHOLDER = 'local-model';

/** Ceiling for one generation. Uncapped small-model runs wander, and burn GPU time. */
const DEFAULT_MAX_TOKENS = 768;

let resolvedModel: Promise<string> | undefined;

/** llama-server 400s on unknown model ids — resolve the loaded alias and cache successes only. */
const resolveModelId = (origin: string): Promise<string> => {
  if (resolvedModel) return resolvedModel;
  const attempt = (async () => {
    // The one probe in the LM layer that used raw `fetch`: no timeout, so a
    // hung llama-server held the model resolution open forever and the request
    // that triggered it with it. `probeJson` is bounded and fails closed.
    const json = await probeJson<{ data?: Array<{ id?: string }> }>(endpointPath(origin, 'v1/models'));
    const id = json?.data?.[0]?.id;
    if (!id) throw new Error('model probe failed: empty or unreachable model list');
    return id;
  })();
  // Memoize only successes: a probe before llama-server readiness must not
  // cache the placeholder forever (D4 — permanent 400s → breaker trips).
  resolvedModel = attempt.catch((error) => {
    console.warn(`[llamacpp] ${errMsg(error)}; retrying on next request`);
    return MODEL_PLACEHOLDER;
  });
  void resolvedModel.then(
    (id) => {
      if (id === MODEL_PLACEHOLDER) resolvedModel = undefined;
    },
    () => {
      resolvedModel = undefined;
    }
  );
  return resolvedModel;
};

/**
 * Native fetch for llama.cpp's OpenAI-compatible server: passes GBNF `grammar`
 * and JSON response formats straight through to the native backend, and swaps
 * the placeholder model id for the server's loaded alias.
 */
export const createLlamaCppFetch = (opts: LlamaCppFetchOptions = {}): typeof fetch => {
  return withBodyPatch(
    async (body, input) => {
      // Bounded generation: uncapped small-model runs wander (and burn GPU time).
      body.max_tokens ??= DEFAULT_MAX_TOKENS;
      const grammar = grammarScope.getStore();
      if (grammar) body.grammar = grammar;
      if (body.model && body.model !== MODEL_PLACEHOLDER) return;
      const origin =
        typeof input === 'string'
          ? new URL(input).origin
          : input instanceof URL
            ? input.origin
            : '';
      if (origin) body.model = await resolveModelId(origin);
    },
    opts.disableThinking ? withThinkingDisabled(fetch) : fetch
  );
};

/** Probe llama-server's native /health endpoint. */
export const probeLlamaCpp = async (host?: string): Promise<boolean> => {
  const base = (host ?? envStrOr(LLAMACPP_HOST_DEFAULT, 'LM_LLAMACPP_HOST')).replace(
    /\/v1\/?$/,
    ''
  );
  return probeReachable(`${base}/health`);
};
