/**
 * ExecutionTracker - Shared execution statistics tracking
 */
export class ExecutionTracker {
    constructor() {
        this._calls = 0;
        this._successes = 0;
        this._failures = 0;
        this._totalTime = 0;
    }

    get stats() {
        const {calls, successes, failures} = this;
        return {
            calls,
            successes,
            failures,
            avgTime: calls > 0 ? this._totalTime / calls : 0,
            get successRate() {
                return calls > 0 ? successes / calls : 0;
            }
        };
    }

    get calls() {
        return this._calls;
    }

    get successes() {
        return this._successes;
    }

    get failures() {
        return this._failures;
    }

    get successRate() {
        return this._calls > 0 ? this._successes / this._calls : 0;
    }

    get avgTime() {
        return this._calls > 0 ? this._totalTime / this._calls : 0;
    }

    record(success, durationMs = 0) {
        this._calls++;
        this._successes += success ? 1 : 0;
        this._failures += success ? 0 : 1;
        this._totalTime += durationMs;
    }

    recordSuccess(durationMs = 0) {
        this.record(true, durationMs);
    }

    recordFailure(durationMs = 0) {
        this.record(false, durationMs);
    }

    reset() {
        this._calls = 0;
        this._successes = 0;
        this._failures = 0;
        this._totalTime = 0;
    }
}

/**
 * Extended execution tracker with token counting (for LM operations)
 */
export class LMExecutionTracker extends ExecutionTracker {
    constructor() {
        super();
        this._tokens = 0;
    }

    get stats() {
        return {...super.stats, tokens: this._tokens};
    }

    get tokens() {
        return this._tokens;
    }

    record(success, durationMs = 0, tokens = 0) {
        super.record(success, durationMs);
        this._tokens += tokens;
    }

    reset() {
        super.reset();
        this._tokens = 0;
    }
}
