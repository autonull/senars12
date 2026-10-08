/**
 * The LM provider façade (§0.6/§3.4). One contract over whatever actually runs
 * the model — the engine behind `lm.status`/`lm.switch`, or an in-browser
 * provider — so provider switching is a command rather than a bespoke wire
 * message, and every consumer reads one `$lmProvider` state instead of poking at
 * the wire payload. The engine owns the registry (it reports the providers in
 * `lm.status`); this side owns what it *means*: a requested switch stays pending
 * until a status frame confirms it, and a request the live engine did not honour
 * is reported as stale rather than as a silent no-op. The transport half —
 * `refreshLmStatus`/`switchLmProvider` — is in `store-bindings.ts`, which owns
 * the protocol in both directions; this module stays wire-free.
 */

import { $webllmActive, $webllmAvailable, atom } from './store.js';

/** Where a provider runs: in the engine process, or in this browser. */
export type ProviderKind = 'engine' | 'browser';

export interface ProviderDescriptor {
  readonly id: string;
  readonly label: string;
  readonly kind: ProviderKind;
}

export interface LmProviderState {
  /** The provider the engine reports as active; `'unknown'` before the first status. */
  readonly id: string;
  readonly model?: string;
  /** Whether the active provider answers. */
  readonly available: boolean;
  readonly stats?: Record<string, unknown>;
  readonly providers: readonly ProviderDescriptor[];
  /** A switch asked for but not yet seen in a status frame. */
  readonly pending?: string;
  /** A pending switch the engine answered without honouring (its LM client is fixed at boot). */
  readonly stale?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

const KNOWN_LABELS: Record<string, string> = {
  mock: 'Mock (no model)',
  webllm: 'WebLLM (in browser)',
  llamacpp: 'llama.cpp server',
  'llamacpp-embedded': 'llama.cpp embedded',
  transformers: 'Transformers.js',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  'openai-compatible': 'OpenAI-compatible',
};

/** A readable label for any provider id, including one the engine added later. */
export const providerLabel = (id: string): string =>
  KNOWN_LABELS[id] ?? id.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const providerOf = (value: unknown): ProviderDescriptor | undefined => {
  if (typeof value === 'string') return { id: value, label: providerLabel(value), kind: 'engine' };
  if (!isRecord(value)) return undefined;
  const id = optionalString(value.id);
  if (!id) return undefined;
  return {
    id,
    label: optionalString(value.label) ?? providerLabel(id),
    kind: value.kind === 'browser' ? 'browser' : 'engine',
  };
};

const providerList = (value: unknown): ProviderDescriptor[] =>
  Array.isArray(value)
    ? [
        ...new Map(
          value
            .map(providerOf)
            .filter((p): p is ProviderDescriptor => !!p)
            .map((p) => [p.id, p])
        ).values(),
      ]
    : [];

/** The one provider state every surface reads. */
export const $lmProvider = atom<LmProviderState>({
  id: 'unknown',
  available: false,
  providers: [],
});

/** Whether a provider can run *here*: browser providers need WebGPU. */
export const providerUsable = (provider: ProviderDescriptor): boolean =>
  provider.kind === 'browser' ? $webllmAvailable.get() || $webllmActive.get() : true;

/**
 * Absorb an `lm.status` frame. The active provider is always in the list even
 * when the engine reports an id it did not catalogue, and a pending switch is
 * reconciled: honoured → settled, ignored → stale.
 */
export const applyLmStatus = (data: unknown): void => {
  if (!isRecord(data)) return;
  const id = optionalString(data.provider) ?? 'unknown';
  const providers = providerList(data.providers);
  const known = providers.some((provider) => provider.id === id);
  const current = $lmProvider.get();
  const pending = current.pending;
  $lmProvider.set({
    id,
    model: optionalString(data.model),
    available: data.available === true,
    stats: isRecord(data.stats) ? data.stats : undefined,
    providers: known ? providers : [...providers, { id, label: providerLabel(id), kind: 'engine' }],
    pending: pending === id ? undefined : pending,
    stale: pending !== undefined && pending !== id ? true : undefined,
  });
};

/** Record a switch the client is asking for; the engine settles it in the next status frame. */
export const requestLmProvider = (id: string): void => {
  $lmProvider.set({ ...$lmProvider.get(), pending: id, stale: undefined });
};
