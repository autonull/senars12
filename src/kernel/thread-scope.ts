/**
 * ThreadScope (REFACTOR.todo4 Phase A).
 * Per-correlationId slice for ContrastiveMemory and sourceKey filter.
 * Fixes the context-bleed bug where one user's `.react correct` shifts
 * every other user's manifold judgments.
 *
 * Bounded by LRU capacity: correlation ids arrive per inbound message from
 * untrusted transports, so an unbounded map here is a slow memory leak. The
 * least-recently-touched thread is evicted whole — a half-evicted scope would
 * reintroduce exactly the context bleed this class exists to prevent.
 */

import { getOrInsert, LruCache } from '@senars/util';

export interface ThreadScopeState {
  contrastiveMemory?: object;
  sourceKey?: string;
}

const MAX_THREAD_SCOPES = 1024;

export class ThreadScope {
  readonly #scopes = new LruCache<string, ThreadScopeState>(MAX_THREAD_SCOPES);

  /**
   * Get or create a scope for the given correlationId.
   * Returns the same object for the same correlationId, ensuring isolation.
   */
  get(correlationId: string): ThreadScopeState {
    return getOrInsert(this.#scopes, correlationId, (): ThreadScopeState => ({}));
  }

  /**
   * Delete a scope (e.g., on session end).
   */
  delete(correlationId: string): boolean {
    return this.#scopes.delete(correlationId);
  }

  /** Check if a scope exists. */
  has(correlationId: string): boolean {
    return this.#scopes.has(correlationId);
  }

  /** Get all active correlationIds. */
  correlationIds(): string[] {
    return [...this.#scopes.keys()];
  }

  /** Clear all scopes. */
  clear(): void {
    this.#scopes.clear();
  }
}

/** Singleton instance for the process. */
export const threadScope = new ThreadScope();
