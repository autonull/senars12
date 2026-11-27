import { stopwatch } from '@senars/util/async';
import { toolError } from '@senars/types/engine';
import { toSkillFeedback } from '@senars/feedback';
import { DefaultToolFeedbackObserver } from '@senars/feedback';
export class ToolRegistry {
    #tools = new Map();
    #feedbackObserver;
    #delegate;
    #local;
    constructor(feedbackObserver, delegate) {
        this.#feedbackObserver = feedbackObserver ?? new DefaultToolFeedbackObserver();
        this.#delegate = delegate;
    }
    /** Set the delegate registry (e.g., nar's ToolManager) after construction. */
    setDelegate(delegate) {
        this.#delegate = delegate;
        for (const spec of this.#tools.values()) {
            if (!delegate.get(spec.name)) {
                delegate.register(spec);
            }
        }
        this.#tools.clear();
    }
    target() {
        return this.#delegate ?? this.#localDelegate();
    }
    /**
     * This registry as its own delegate, built once. `target()` used to rebuild the
     * whole nine-method object — nine closures over `this` — on every call, and
     * `target()` sits on the per-tool-invocation path.
     */
    #localDelegate() {
        this.#local ??= {
            register: (spec) => void this.#tools.set(spec.name, spec),
            unregister: (name) => void this.#tools.delete(name),
            get: (name) => this.#tools.get(name),
            list: () => [...this.#tools.values()],
            execute: (name, args, context) => this.executeLocal(name, args, context),
            getFeedback: (name) => {
                const fb = this.#feedbackObserver.getFeedback(name);
                return fb ? toSkillFeedback(fb) : undefined;
            },
            getAllFeedback: () => this.#feedbackObserver.getAllFeedback().map(toSkillFeedback),
            getRecentResults: (limit) => this.#feedbackObserver.getFeedbackString(limit),
            clear: () => {
                this.#tools.clear();
                this.#feedbackObserver.resetFeedback();
            },
        };
        return this.#local;
    }
    register(spec) {
        this.target().register(spec);
    }
    unregister(name) {
        this.target().unregister(name);
    }
    get(name) {
        return this.target().get(name);
    }
    list() {
        return this.target().list();
    }
    async execute(name, args, context) {
        if (context?.signal?.aborted) {
            return toolError('Execution aborted');
        }
        return this.target().execute(name, args, context);
    }
    async executeLocal(name, args, context) {
        const tool = this.#tools.get(name);
        if (!tool)
            return toolError(`Unknown tool: ${name}`);
        const elapsed = stopwatch();
        try {
            const result = await tool.execute(args, context);
            this.#feedbackObserver.recordCall(name, result, elapsed());
            return result;
        }
        catch (err) {
            const result = toolError(err);
            this.#feedbackObserver.recordCall(name, result, elapsed());
            return result;
        }
    }
    getFeedback(name) {
        return this.target().getFeedback(name);
    }
    getAllFeedback() {
        return this.target().getAllFeedback();
    }
    getRecentResults(limit) {
        return this.target().getRecentResults(limit);
    }
    clear() {
        this.target().clear();
    }
}
