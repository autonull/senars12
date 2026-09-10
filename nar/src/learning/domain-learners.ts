import type { RewardDomain } from '@senars/kernel/schemas';
import type { FocusBag } from '../focus/FocusBag.js';
import type { SelfRewardGate } from '../kernel/KernelRewardGate.js';
import type { LearningEvent, Reflex } from '../reflex/Reflex.js';

export type LearnerDomain = RewardDomain | 'external-reflex';

export interface DomainLearningEvent {
    domain: LearnerDomain;
    reward: number;
    focusId?: string;
    key?: string;
}

export class CrossDomainError extends Error {
    constructor(learner: string, expected: string, got: string) {
        super(`${learner} declares domain ${expected} but received ${got}`);
        this.name = 'CrossDomainError';
    }
}

export abstract class DomainLearner {
    abstract readonly domain: LearnerDomain;
    abstract readonly risk: 'low' | 'medium' | 'high';

    protected guard(event: DomainLearningEvent): void {
        if (event.domain !== this.domain) throw new CrossDomainError(this.constructor.name, this.domain, event.domain);
    }

    abstract learn(event: DomainLearningEvent): void;
}

export class ReflexLearner extends DomainLearner {
    readonly domain: LearnerDomain = 'external-reflex';
    readonly risk = 'low' as const;
    constructor(private readonly reflex: Reflex) { super(); }

    learn(event: DomainLearningEvent): void {
        this.guard(event);
        this.reflex.learn({ reward: event.reward } as LearningEvent);
    }
}

export class SchedulerAdapter extends DomainLearner {
    readonly domain: LearnerDomain = 'self-scheduler';
    readonly risk = 'low' as const;
    constructor(private readonly focusBag: FocusBag, private readonly learningRate = 0.05) { super(); }

    learn(event: DomainLearningEvent): void {
        this.guard(event);
        if (!event.focusId) return;
        const current = this.focusBag.getFocusWeights().get(event.focusId) ?? 0;
        const next = Math.max(0, Math.min(1, current + this.learningRate * Math.max(-1, Math.min(1, event.reward))));
        this.focusBag.rebalanceWeights(new Map([[event.focusId, next]]));
    }
}

export class PreferenceRanker extends DomainLearner {
    readonly domain: LearnerDomain = 'self-explanation-rank';
    readonly risk = 'low' as const;
    private scores = new Map<string, { total: number; n: number }>();

    learn(event: DomainLearningEvent): void {
        this.guard(event);
        if (!event.key) return;
        const prev = this.scores.get(event.key) ?? { total: 0, n: 0 };
        this.scores.set(event.key, { total: prev.total + event.reward, n: prev.n + 1 });
    }

    rank(): string[] {
        return [...this.scores.entries()]
            .sort((a, b) => (b[1].total / b[1].n) - (a[1].total / a[1].n))
            .map(([key]) => key);
    }
}

export class ConfigOptimizer extends DomainLearner {
    readonly domain: LearnerDomain = 'self-config-proposal';
    readonly risk = 'medium' as const;
    constructor(private readonly proposals: SelfRewardGate) { super(); }

    learn(event: DomainLearningEvent): void {
        this.guard(event);
    }

    suggestKnob(knob: string, value: number) {
        return this.proposals.submit('knob-tune', { knob, value }, 'self-config-proposal');
    }
}

export class PatchSelector extends DomainLearner {
    readonly domain: LearnerDomain = 'self-patch-score';
    readonly risk = 'high' as const;
    constructor(private readonly proposals: SelfRewardGate) { super(); }

    learn(event: DomainLearningEvent): void {
        this.guard(event);
    }

    scorePatch(diffRef: string, score: number) {
        return this.proposals.submit('patch-apply', { diffRef, score }, 'self-patch-score');
    }
}

export class LearnerRegistry {
    private readonly learners = new Map<LearnerDomain, DomainLearner>();

    register(learner: DomainLearner): void {
        this.learners.set(learner.domain, learner);
    }

    dispatch(event: DomainLearningEvent): void {
        const learner = this.learners.get(event.domain);
        if (!learner) throw new CrossDomainError('LearnerRegistry', 'registered domain', event.domain);
        learner.learn(event);
    }

    get(domain: LearnerDomain): DomainLearner | undefined {
        return this.learners.get(domain);
    }
}
