import type {Term} from '../terms';
import type {Concept} from './concept.js';
import {LinkManager} from './links/LinkManager.js';
import type {LinkManagerConfig} from './links/LinkManager.js';
import {LINK} from '../constants.js';

export interface MemoryLinksConfig {
    linkCapacity?: number;
    termLinkCapacity?: number;
    semanticLinkCapacity?: number;
    linkForgetPolicy?: 'priority' | 'lru' | 'fifo' | 'random';
    linkDecayRate?: number;
}

export class MemoryLinks {
    private readonly linkManager: LinkManager;
    private readonly concepts: Map<string, Concept>;

    constructor(config: MemoryLinksConfig = {}) {
        this.linkManager = new LinkManager({
            defaultCapacity: config.linkCapacity ?? LINK.DEFAULT_CAPACITY,
            layers: {
                term: config.termLinkCapacity ?? LINK.TERM_LAYER_CAPACITY,
                semantic: config.semanticLinkCapacity ?? LINK.SEMANTIC_LAYER_CAPACITY,
            },
            forgetPolicy: config.linkForgetPolicy ?? LINK.FORGET_POLICY,
            globalDecayRate: config.linkDecayRate ?? LINK.DECAY_RATE,
        });
        this.concepts = new Map();
    }

    registerConcept(concept: Concept): void {
        this.concepts.set(concept.term.toString(), concept);
    }

    unregisterConcept(term: Term): void {
        this.concepts.delete(term.toString());
    }

    addLink(sourceTerm: Term, targetTerm: Term, priority?: number): void {
        this.linkManager.addLink(sourceTerm, targetTerm, {priority, layer: 'term'});
    }

    getLinks(term: Term) {
        return this.linkManager.getLinks(term, {layer: 'term'});
    }

    getRelatedConcepts(term: Term, limit: number = 10): Concept[] {
        const links = this.linkManager.getLinks(term, {layer: 'term'}).slice(0, limit);
        const results: Concept[] = [];
        for (const link of links) {
            const concept = this.concepts.get(link.targetTerm.toString());
            if (concept) results.push(concept);
        }
        return results;
    }

    removeAllLinksForTerm(term: Term): void {
        this.linkManager.removeAllLinksForTerm(term);
        this.unregisterConcept(term);
    }

    applyDecay(decayRate?: number): void {
        this.linkManager.applyDecay(decayRate);
    }

    getStats() {
        return this.linkManager.getStats();
    }

    getLinkManager(): LinkManager {
        return this.linkManager;
    }
}