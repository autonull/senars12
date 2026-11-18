/**
 * One place to record how to undo what a component did.
 *
 * Four dialects of teardown existed: an interval disposer parked in an optional
 * field beside its `close()`, a hand-maintained `Array<[event, handler]>` walked
 * on stop, a `process.on('SIGINT')` installed per connection and never removed,
 * and one signal-handler pair per transport branch in a binary that starts
 * exactly one of them. None of them composes. A component that subscribes to two
 * sources and owns one timer has three fields to remember to clear, and the one
 * it forgets is the leak — which is why the registries that did exist were
 * audited one at a time rather than trusted.
 *
 * `DisposalRegistry` is the substrate. Registration is cheap, teardown is one
 * call, and a registration that arrives after disposal runs immediately, so a
 * late subscribe cannot outlive the component it belongs to.
 */

export type Teardown = () => void | Promise<void>;

/** Every undo a component owes, in one list — teardown is a single `disposeAll()`. */
export class DisposalRegistry {
  readonly #teardown: Teardown[] = [];
  #disposed = false;

  /** Teardowns still outstanding — zero once disposed. */
  get size(): number {
    return this.#teardown.length;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  /** Register a teardown. Runs at once if the registry is already disposed. */
  add(teardown: Teardown): void {
    if (this.#disposed) {
      void teardown();
      return;
    }
    this.#teardown.push(teardown);
  }

  /** Register an unsubscribe — what `EventBus.on` and the caches hand back. */
  track(unsubscribe: Teardown | undefined | null): void {
    if (unsubscribe) this.add(unsubscribe);
  }

  /**
   * Run every teardown in reverse registration order, once.
   *
   * A failing teardown does not strand the ones behind it: all of them run, and
   * the first failure surfaces so it is not swallowed.
   *
   * Every synchronous teardown has run by the time this returns, so a sync
   * `shutdown()` can `void` this and still be finished when it returns. That is
   * also where a failure surfaces: thrown at once when no teardown is async,
   * and on the returned promise once one is.
   */
  disposeAll(): Promise<void> {
    if (this.#disposed) return Promise.resolve();
    this.#disposed = true;
    const pending: Promise<void>[] = [];
    let firstFailure: unknown;
    const capture = (error: unknown): void => {
      firstFailure ??= error;
    };

    for (const teardown of this.#teardown.splice(0).reverse()) {
      try {
        const result = teardown();
        if (result) pending.push(Promise.resolve(result).catch(capture));
      } catch (error) {
        capture(error);
      }
    }

    if (pending.length === 0) {
      if (firstFailure !== undefined) throw firstFailure;
      return Promise.resolve();
    }
    return Promise.all(pending).then(() => {
      if (firstFailure !== undefined) throw firstFailure;
    });
  }
}
