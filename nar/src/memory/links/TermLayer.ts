import type {Term} from '../../terms';
import {termsEqual} from '../../terms';
import {Layer} from './Layer.js';
import type {LinkEntry, LinkType, SerializedLayer} from './types.js';

interface LinkEntryInternal extends LinkEntry {
    data?: Record<string, unknown>;
}

function termToIdKey(term: Term): string {
    if (term.kind === 'atom') {
        return `atom:${term.symbol}`;
    }
    return `${term.kind}:${term.args?.map((a) => termToIdKey(a)).join(',')}`;
}

function createLinkId(source: Term, target: Term, type: LinkType): string {
    return `${termToIdKey(source)}_${termToIdKey(target)}_${type}`;
}

export class TermLayer extends Layer {
    private readonly links: Map<string, LinkEntryInternal>;
    private typeIndex: Map<LinkType, Set<string>>;

    constructor(capacity: number, forgetPolicy: 'priority' | 'lru' | 'fifo' | 'random' = 'priority') {
        super('term', capacity, forgetPolicy);
        this.links = new Map();
        this.typeIndex = new Map();
    }

    static deserialize(
        data: SerializedLayer,
        _termResolver: (id: string) => Term | undefined
    ): TermLayer {
        const layer = new TermLayer(data.capacity);

        for (const _link of data.links) {
            // Skip reconstruction from serialized form for now
            // Would need proper term registry
        }

        return layer;
    }

    override add(
        _sourceHash: number,
        _targetHash: number,
        options?: {
            type?: LinkType;
            priority?: number;
            sourceTerm?: Term;
            targetTerm?: Term;
            data?: Record<string, unknown>;
        }
    ): LinkEntry | null {
        const type = options?.type ?? 'term-link';
        const priority = options?.priority ?? 0.5;
        const sourceTerm = options?.sourceTerm;
        const targetTerm = options?.targetTerm;
        const data = options?.data;

        if (!sourceTerm || !targetTerm) {
            return null;
        }

        const id = createLinkId(sourceTerm, targetTerm, type);

        const entry: LinkEntryInternal = {
            id,
            sourceTerm,
            targetTerm,
            type,
            priority,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            data,
        };

        this.links.set(id, entry);

        if (!this.typeIndex.has(type)) {
            this.typeIndex.set(type, new Set());
        }
        this.typeIndex.get(type)!.add(id);

        const added = this.bag.add(entry);
        return added ? entry : null;
    }

    removeByTerms(source: Term, target: Term, type: LinkType = 'term-link'): boolean {
        const id = createLinkId(source, target, type);
        const entry = this.links.get(id);
        if (!entry) return false;

        this.links.delete(id);
        const typeSet = this.typeIndex.get(type);
        if (typeSet) {
            typeSet.delete(id);
            if (typeSet.size === 0) {
                this.typeIndex.delete(type);
            }
        }

        return this.bag.remove(id);
    }

    override remove(sourceHash: number, targetHash: number, type: LinkType = 'term-link'): boolean {
        const id = `${sourceHash}_${targetHash}_${type}`;
        const entry = this.links.get(id);
        if (!entry) return false;

        this.links.delete(id);
        const typeSet = this.typeIndex.get(type);
        if (typeSet) {
            typeSet.delete(id);
            if (typeSet.size === 0) {
                this.typeIndex.delete(type);
            }
        }

        return this.bag.remove(id);
    }

    override get(
        sourceHash: number,
        options?: {
            type?: LinkType;
            minPriority?: number;
            maxResults?: number;
        }
    ): LinkEntry[] {
        const type = options?.type;
        const minPriority = options?.minPriority ?? 0;
        const maxResults = options?.maxResults ?? Number.POSITIVE_INFINITY;

        const results: LinkEntry[] = [];

        for (const entry of this.links.values()) {
            if (type && entry.type !== type) continue;
            if (entry.priority < minPriority) continue;
            results.push(entry);
            if (results.length >= maxResults) break;
        }

        return results;
    }

    findByType(type: LinkType): LinkEntry[] {
        const typeSet = this.typeIndex.get(type);
        if (!typeSet) return [];

        const results: LinkEntry[] = [];
        for (const id of typeSet) {
            const entry = this.links.get(id);
            if (entry) {
                results.push(entry);
            }
        }

        return results;
    }

    findByTarget(target: Term): LinkEntry[] {
        const results: LinkEntry[] = [];
        for (const entry of this.links.values()) {
            if (termsEqual(entry.targetTerm, target)) {
                results.push(entry);
            }
        }
        return results;
    }

    has(source: Term, target: Term, type: LinkType = 'term-link'): boolean {
        const id = createLinkId(source, target, type);
        return this.links.has(id);
    }

    updatePriority(source: Term, target: Term, type: LinkType, newPriority: number): void {
        const id = createLinkId(source, target, type);
        const entry = this.links.get(id);
        if (entry) {
            entry.priority = newPriority;
        }
    }

    serialize(): SerializedLayer {
        const links: LinkEntry[] = [];
        for (const entry of this.links.values()) {
            links.push(entry);
        }

        return {
            name: this.name,
            capacity: this.capacity,
            links: links.map((entry) => ({
                id: entry.id,
                sourceTerm: entry.sourceTerm.toString(),
                targetTerm: entry.targetTerm.toString(),
                type: entry.type,
                priority: entry.priority,
                createdAt: entry.createdAt,
                lastAccessedAt: entry.lastAccessedAt,
            })),
        };
    }

    override removeAllLinksForTerm(term: Term): void {
        const idsToRemove: string[] = [];

        for (const [id, entry] of this.links) {
            if (termsEqual(entry.sourceTerm, term) || termsEqual(entry.targetTerm, term)) {
                idsToRemove.push(id);
            }
        }

        for (const id of idsToRemove) {
            const entry = this.links.get(id);
            if (entry) {
                this.links.delete(id);
                const typeSet = this.typeIndex.get(entry.type);
                if (typeSet) {
                    typeSet.delete(id);
                    if (typeSet.size === 0) {
                        this.typeIndex.delete(entry.type);
                    }
                }
                this.bag.remove(id);
            }
        }
    }

    override getLinksByTerm(term: Term): LinkEntry[] {
        const results: LinkEntry[] = [];
        for (const entry of this.links.values()) {
            if (termsEqual(entry.sourceTerm, term) || termsEqual(entry.targetTerm, term)) {
                results.push(entry);
            }
        }
        return results;
    }
}
