/**
 * ThreadScope (REFACTOR.todo4 Phase A).
 * Per-correlationId slice for ContrastiveMemory and sourceKey filter.
 * Fixes the context-bleed bug where one user's `.react correct` shifts
 * every other user's manifold judgments.
 */

export interface ThreadScopeState {
  contrastiveMemory?: object;
  sourceKey?: string;
}

/**
 * ThreadScope provides isolated state per correlationId.
 * Single-correlationId path is byte-identical to pre-ThreadScope behavior.
 */
export class ThreadScope {
  readonly #scopes = new Map<string, ThreadScopeState>();

  /**
   * Get or create a scope for the given correlationId.
   * Returns the same object for the same correlationId, ensuring isolation.
   */
  get(correlationId: string): ThreadScopeState {
    let scope = this.#scopes.get(correlationId);
    if (!scope) {
      scope = {};
      this.#scopes.set(correlationId, scope);
    }
    return scope;
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