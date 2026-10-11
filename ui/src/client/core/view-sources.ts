import type { ViewDataset, ViewSource } from './view-spec.js';

/** A readable the view system can subscribe to — an atom or any get/subscribe pair. */
export interface Readable<T> {
  get(): T;
  subscribe(fn: () => void): () => void;
}

/**
 * Adapt a store atom to the view system's source contract: `get` projects the
 * atom's value into a dataset and `subscribe` forwards its notifications. An
 * optional `loading` readable is forwarded too, so a view can show its loading
 * slot while the data is still arriving. This is how a product surface feeds
 * `<s-view>` without owning a renderer.
 */
export const viewSource = <T>(
  readable: Readable<T>,
  project: (value: T) => ViewDataset,
  loading?: Readable<boolean>
): ViewSource => ({
  get: () => project(readable.get()),
  subscribe: (fn) => {
    const offData = readable.subscribe(fn);
    const offLoading = loading?.subscribe(fn);
    return () => {
      offData();
      offLoading?.();
    };
  },
  ...(loading ? { loading: () => loading.get() } : {}),
});