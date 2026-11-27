/**
 * Self-Model — the system's model of its own capabilities, state, and performance.
 *
 * Maintains a continuously updated model for meta-reasoning and self-improvement.
 */
import { clamp01 } from '@senars/util/numeric';
/** Self-model aspects. */
export const SELF_MODEL_ASPECTS = [
    'capabilities',
    'knowledge',
    'performance',
    'preferences',
    'goals',
    'limitations',
    'history',
];
/** Default self-model config. */
export const defaultSelfModelConfig = {
    maxHistory: 1000,
    updateInterval: 10,
    confidenceDecay: 0.99,
    autoUpdate: true,
};
/** Self-model manager. */
export class SelfModelManager {
    config;
    model;
    iteration = 0;
    pendingUpdates = {};
    clock;
    constructor(config = {}, options = {}) {
        this.config = { ...defaultSelfModelConfig, ...config };
        this.clock = options.clock ?? { now: () => Date.now(), setTime: () => { }, advance: () => { } };
        this.model = this.createInitialModel();
    }
    /** Create initial self-model. */
    createInitialModel() {
        return {
            capabilities: [],
            knowledge: [],
            performance: {
                overallScore: 0.5,
                dimensions: {},
                trend: 'stable',
                strengths: [],
                weaknesses: [],
                benchmarks: [],
            },
            preferences: [],
            goals: [],
            limitations: [],
            history: [],
            metaConfidence: 0.5,
            lastUpdated: this.clock.now(),
        };
    }
    /** Update from appraisal. */
    updateFromAppraisal(appraisal) {
        this.pendingUpdates.performance = {
            overallScore: appraisal.overallScore,
            dimensions: Object.fromEntries(appraisal.dimensions.map(d => [d.dimension, d.score])),
            trend: this.computePerformanceTrend(appraisal),
            strengths: this.extractStrengths(appraisal),
            weaknesses: this.extractWeaknesses(appraisal),
            benchmarks: this.model.performance.benchmarks,
        };
        this.model.lastUpdated = this.clock.now();
    }
    /** Update capability from outcome. */
    updateCapability(name, success, evidence = {}) {
        let cap = this.model.capabilities.find(c => c.name === name);
        if (!cap) {
            cap = {
                name,
                proficiency: 0.5,
                confidence: 0.5,
                evidence: [],
                lastUpdated: this.clock.now(),
                trend: 'stable',
            };
            this.model.capabilities.push(cap);
        }
        // Update proficiency with exponential moving average
        const alpha = 0.1;
        cap.proficiency = cap.proficiency * (1 - alpha) + (success ? 1 : 0) * alpha;
        cap.confidence = Math.min(1, cap.confidence + 0.05);
        cap.lastUpdated = this.clock.now();
        cap.trend = this.computeCapabilityTrend(cap);
        // Add evidence
        cap.evidence.push({
            source: success ? 'success' : 'failure',
            description: evidence.description ?? (success ? 'Successful execution' : 'Failed execution'),
            weight: evidence.weight ?? 1,
            timestamp: this.clock.now(),
        });
        // Trim evidence
        if (cap.evidence.length > 100) {
            cap.evidence = cap.evidence.slice(-50);
        }
    }
    /** Update knowledge state. */
    updateKnowledge(domain, concepts, gaps) {
        let knowledge = this.model.knowledge.find(k => k.domain === domain);
        if (!knowledge) {
            knowledge = {
                domain,
                coverage: 0,
                certainty: 0,
                concepts: [],
                gaps: [],
                lastUpdated: this.clock.now(),
            };
            this.model.knowledge.push(knowledge);
        }
        knowledge.concepts = Array.from(new Set([...knowledge.concepts, ...concepts]));
        knowledge.gaps = Array.from(new Set([...knowledge.gaps, ...gaps]));
        knowledge.coverage = Math.min(1, knowledge.concepts.length / 100); // Heuristic
        knowledge.certainty = Math.min(1, knowledge.coverage * 1.2);
        knowledge.lastUpdated = this.clock.now();
    }
    /** Add preference. */
    addPreference(preference) {
        const existing = this.model.preferences.find(p => p.type === preference.type && p.target === preference.target);
        if (existing) {
            // Blend with existing
            existing.strength = (existing.strength + preference.strength) / 2;
            existing.confidence = Math.max(existing.confidence, preference.confidence);
        }
        else {
            this.model.preferences.push(preference);
        }
    }
    /** Update goal progress. */
    updateGoalProgress(goalId, progress, status) {
        const goal = this.model.goals.find(g => g.id === goalId);
        if (goal) {
            goal.progress = clamp01(progress);
            if (status)
                goal.status = status;
        }
    }
    /** Add goal. */
    addGoal(goal) {
        if (!this.model.goals.find(g => g.id === goal.id)) {
            this.model.goals.push(goal);
        }
    }
    /** Add limitation. */
    addLimitation(limitation) {
        if (!this.model.limitations.find(l => l.type === limitation.type && l.description === limitation.description)) {
            this.model.limitations.push(limitation);
        }
    }
    /** Record episode. */
    recordEpisode(episode) {
        this.model.history.unshift(episode);
        if (this.model.history.length > this.config.maxHistory) {
            this.model.history = this.model.history.slice(0, this.config.maxHistory);
        }
    }
    /** Get capability assessment. */
    getCapability(name) {
        return this.model.capabilities.find(c => c.name === name);
    }
    /** Get all capabilities. */
    getCapabilities() {
        return [...this.model.capabilities].sort((a, b) => b.proficiency - a.proficiency);
    }
    /** Get knowledge for domain. */
    getKnowledge(domain) {
        return this.model.knowledge.find(k => k.domain === domain);
    }
    /** Get performance profile. */
    getPerformance() {
        return { ...this.model.performance };
    }
    /** Get preferences. */
    getPreferences(type) {
        if (type) {
            return this.model.preferences.filter(p => p.type === type);
        }
        return [...this.model.preferences];
    }
    /** Get goals. */
    getGoals(status) {
        if (status) {
            return this.model.goals.filter(g => g.status === status);
        }
        return [...this.model.goals];
    }
    /** Get limitations. */
    getLimitations(type) {
        if (type) {
            return this.model.limitations.filter(l => l.type === type);
        }
        return [...this.model.limitations];
    }
    /** Get recent history. */
    getHistory(limit = 10) {
        return this.model.history.slice(0, limit);
    }
    /** Get complete self-model. */
    getModel() {
        return { ...this.model };
    }
    /** Compute performance trend. */
    computePerformanceTrend(appraisal) {
        const improving = appraisal.dimensions.filter(d => d.trend === 'improving').length;
        const declining = appraisal.dimensions.filter(d => d.trend === 'declining').length;
        if (improving > declining)
            return 'improving';
        if (declining > improving)
            return 'declining';
        return 'stable';
    }
    /** Extract strengths from appraisal. */
    extractStrengths(appraisal) {
        return appraisal.dimensions
            .filter(d => d.score > 0.7)
            .map(d => d.dimension);
    }
    /** Extract weaknesses from appraisal. */
    extractWeaknesses(appraisal) {
        return appraisal.dimensions
            .filter(d => d.score < 0.4)
            .map(d => d.dimension);
    }
    /** Compute capability trend. */
    computeCapabilityTrend(cap) {
        if (cap.evidence.length < 5)
            return 'stable';
        const recent = cap.evidence.slice(-5);
        const successes = recent.filter(e => e.source === 'success').length;
        const failures = recent.filter(e => e.source === 'failure').length;
        if (successes > failures + 1)
            return 'improving';
        if (failures > successes + 1)
            return 'declining';
        return 'stable';
    }
    /** Decay confidence over time. */
    decayConfidence() {
        const now = this.clock.now();
        const decay = this.config.confidenceDecay;
        for (const cap of this.model.capabilities) {
            const age = now - cap.lastUpdated;
            const days = age / (1000 * 60 * 60 * 24);
            cap.confidence *= Math.pow(decay, days);
        }
        for (const knowledge of this.model.knowledge) {
            const age = now - knowledge.lastUpdated;
            const days = age / (1000 * 60 * 60 * 24);
            knowledge.certainty *= Math.pow(decay, days);
        }
    }
    /** Tick - called each iteration. */
    tick() {
        this.iteration++;
        if (this.config.autoUpdate && this.iteration % this.config.updateInterval === 0) {
            this.decayConfidence();
        }
    }
    /** Serialize model. */
    serialize() {
        return JSON.stringify(this.model, null, 2);
    }
    /** Deserialize model. */
    deserialize(json) {
        this.model = JSON.parse(json);
    }
}
/** Create a self-model manager. */
export function createSelfModelManager(config, options) {
    return new SelfModelManager(config, options);
}
/** Global self-model manager (non-deterministic; prefer {@link createSelfModelManager}). */
export const selfModelManager = createSelfModelManager();
