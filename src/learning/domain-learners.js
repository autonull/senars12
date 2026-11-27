import { accumulate } from '@senars/util/collections';
import { clamp01, clampSigned } from '@senars/util/numeric';
import { SenarsError } from '@senars/errors';
export class CrossDomainError extends SenarsError {
    constructor(learner, expected, got) {
        super(`${learner} declares domain ${expected} but received ${got}`, 'CROSS_DOMAIN', {
            learner,
            expected,
            got,
        });
    }
}
export class DomainLearner {
    guard(event) {
        if (event.domain !== this.domain)
            throw new CrossDomainError(this.constructor.name, this.domain, event.domain);
    }
}
export class ReflexLearner extends DomainLearner {
    reflex;
    domain = 'external-reflex';
    risk = 'low';
    constructor(reflex) {
        super();
        this.reflex = reflex;
    }
    learn(event) {
        this.guard(event);
        this.reflex.learn({ reward: event.reward });
    }
}
export class SchedulerAdapter extends DomainLearner {
    focusBag;
    learningRate;
    domain = 'self-scheduler';
    risk = 'low';
    constructor(focusBag, learningRate = 0.05) {
        super();
        this.focusBag = focusBag;
        this.learningRate = learningRate;
    }
    learn(event) {
        this.guard(event);
        if (!event.focusId)
            return;
        const current = this.focusBag.getFocusWeights().get(event.focusId) ?? 0;
        const next = clamp01(current + this.learningRate * clampSigned(event.reward));
        this.focusBag.rebalanceWeights(new Map([[event.focusId, next]]));
    }
}
export class PreferenceRanker extends DomainLearner {
    domain = 'self-explanation-rank';
    risk = 'low';
    scores = new Map();
    learn(event) {
        this.guard(event);
        if (!event.key)
            return;
        const prev = { total: 0, n: 0 };
        accumulate(this.scores, event.key, () => prev, (running) => {
            running.total += event.reward;
            running.n += 1;
        });
    }
    rank() {
        return [...this.scores.entries()]
            .sort((a, b) => b[1].total / b[1].n - a[1].total / a[1].n)
            .map(([key]) => key);
    }
}
export class ConfigOptimizer extends DomainLearner {
    proposals;
    domain = 'self-config-proposal';
    risk = 'medium';
    constructor(proposals) {
        super();
        this.proposals = proposals;
    }
    learn(event) {
        this.guard(event);
    }
    suggestKnob(knob, value) {
        return this.proposals.submit('knob-tune', { knob, value }, 'self-config-proposal');
    }
}
export class PatchSelector extends DomainLearner {
    proposals;
    domain = 'self-patch-score';
    risk = 'high';
    constructor(proposals) {
        super();
        this.proposals = proposals;
    }
    learn(event) {
        this.guard(event);
    }
    scorePatch(diffRef, score) {
        return this.proposals.submit('patch-apply', { diffRef, score }, 'self-patch-score');
    }
}
import { FunctionRegistry } from '../util/registry';
export class LearnerRegistry extends FunctionRegistry {
    constructor() {
        super((learner) => learner.domain);
    }
    register(learner) {
        super.register(learner);
    }
    dispatch(event) {
        const learner = this.get(event.domain);
        if (!learner)
            throw new CrossDomainError('LearnerRegistry', 'registered domain', event.domain);
        learner.learn(event);
    }
    get(domain) {
        return super.get(domain);
    }
}
