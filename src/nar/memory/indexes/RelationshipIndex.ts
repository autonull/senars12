import type {Term} from '../../terms';
import type {Concept} from '../concept.js';
import {RELATIONSHIP_INDEX} from '../../constants.js';

const {SUBJECT, PREDICATE, PREMISE, CONCLUSION, SIMILAR} = RELATIONSHIP_INDEX.PREFIXES;

export class RelationshipIndex {
    private inheritanceIndex: Map<string, Set<Concept>>;
    private implicationIndex: Map<string, Set<Concept>>;
    private similarityIndex: Map<string, Set<Concept>>;

    constructor() {
        this.inheritanceIndex = new Map();
        this.implicationIndex = new Map();
        this.similarityIndex = new Map();
    }

    add(term: Term, concept: Concept): void {
        if (term.kind === 'inheritance') {
            const subject = term.args?.[0];
            const predicate = term.args?.[1];

            if (subject) {
                const key = `${SUBJECT}${subject.toString()}`;
                if (!this.inheritanceIndex.has(key)) {
                    this.inheritanceIndex.set(key, new Set());
                }
                this.inheritanceIndex.get(key)!.add(concept);
            }

            if (predicate) {
                const key = `${PREDICATE}${predicate.toString()}`;
                if (!this.inheritanceIndex.has(key)) {
                    this.inheritanceIndex.set(key, new Set());
                }
                this.inheritanceIndex.get(key)!.add(concept);
            }
        } else if (term.kind === 'implication') {
            const premise = term.args?.[0];
            const conclusion = term.args?.[1];

            if (premise) {
                const key = `${PREMISE}${premise.toString()}`;
                if (!this.implicationIndex.has(key)) {
                    this.implicationIndex.set(key, new Set());
                }
                this.implicationIndex.get(key)!.add(concept);
            }

            if (conclusion) {
                const key = `${CONCLUSION}${conclusion.toString()}`;
                if (!this.implicationIndex.has(key)) {
                    this.implicationIndex.set(key, new Set());
                }
                this.implicationIndex.get(key)!.add(concept);
            }
        } else if (term.kind === 'similarity') {
            const key = `${SIMILAR}${term.toString()}`;
            if (!this.similarityIndex.has(key)) {
                this.similarityIndex.set(key, new Set());
            }
            this.similarityIndex.get(key)!.add(concept);
        }
    }

    remove(term: Term, concept: Concept): void {
        if (term.kind === 'inheritance') {
            const subject = term.args?.[0];
            const predicate = term.args?.[1];

            if (subject) {
                const key = `${SUBJECT}${subject.toString()}`;
                const set = this.inheritanceIndex.get(key);
                if (set) {
                    set.delete(concept);
                    if (set.size === 0) this.inheritanceIndex.delete(key);
                }
            }

            if (predicate) {
                const key = `${PREDICATE}${predicate.toString()}`;
                const set = this.inheritanceIndex.get(key);
                if (set) {
                    set.delete(concept);
                    if (set.size === 0) this.inheritanceIndex.delete(key);
                }
            }
        } else if (term.kind === 'implication') {
            const premise = term.args?.[0];
            const conclusion = term.args?.[1];

            if (premise) {
                const key = `${PREMISE}${premise.toString()}`;
                const set = this.implicationIndex.get(key);
                if (set) {
                    set.delete(concept);
                    if (set.size === 0) this.implicationIndex.delete(key);
                }
            }

            if (conclusion) {
                const key = `${CONCLUSION}${conclusion.toString()}`;
                const set = this.implicationIndex.get(key);
                if (set) {
                    set.delete(concept);
                    if (set.size === 0) this.implicationIndex.delete(key);
                }
            }
        } else if (term.kind === 'similarity') {
            const key = `${SIMILAR}${term.toString()}`;
            const set = this.similarityIndex.get(key);
            if (set) {
                set.delete(concept);
                if (set.size === 0) this.similarityIndex.delete(key);
            }
        }
    }

    findByInheritance(subject?: string, predicate?: string): Concept[] {
        const results = new Set<Concept>();

        if (subject) {
            const key = `${SUBJECT}${subject}`;
            const set = this.inheritanceIndex.get(key);
            if (set) {
                for (const concept of set) {
                    results.add(concept);
                }
            }
        }

        if (predicate) {
            const key = `${PREDICATE}${predicate}`;
            const set = this.inheritanceIndex.get(key);
            if (set) {
                for (const concept of set) {
                    results.add(concept);
                }
            }
        }

        return Array.from(results);
    }

    findByImplication(premise?: string, conclusion?: string): Concept[] {
        const results = new Set<Concept>();

        if (premise) {
            const key = `${PREMISE}${premise}`;
            const set = this.implicationIndex.get(key);
            if (set) {
                for (const concept of set) {
                    results.add(concept);
                }
            }
        }

        if (conclusion) {
            const key = `${CONCLUSION}${conclusion}`;
            const set = this.implicationIndex.get(key);
            if (set) {
                for (const concept of set) {
                    results.add(concept);
                }
            }
        }

        return Array.from(results);
    }

    findBySimilarity(term: string): Concept[] {
        const key = `${SIMILAR}${term}`;
        const set = this.similarityIndex.get(key);
        return set ? Array.from(set) : [];
    }

    clear(): void {
        this.inheritanceIndex.clear();
        this.implicationIndex.clear();
        this.similarityIndex.clear();
    }
}
