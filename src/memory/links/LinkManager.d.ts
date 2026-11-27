import type { Term } from '../../terms';
import { Layer } from './Layer';
import { EmbeddingLayer } from './EmbeddingLayer';
import { type LinkEntry, type LinkManagerConfig, type LinkType } from './types';
export declare class LinkManager {
    private readonly layers;
    private readonly config;
    constructor(config?: Partial<LinkManagerConfig>);
    getLayer(name: string): Layer | undefined;
    getEmbeddingLayer(): EmbeddingLayer | undefined;
    registerLayer(name: string, capacity: number): Layer;
    setLayer(name: string, layer: Layer): void;
    addLink(sourceTerm: Term, targetTerm: Term, options?: {
        layer?: string;
        type?: LinkType;
        priority?: number;
    }): LinkEntry | null;
    getLinks(sourceTerm: Term, options?: {
        layer?: string;
        type?: LinkType;
        minPriority?: number;
        maxResults?: number;
    }): LinkEntry[];
    removeByTerm(sourceTerm: Term, targetTerm: Term, type?: LinkType): boolean;
    /**
     * Every layer, because {@link applyDecay} already is: a decay pass reaches all
     * of them and a removal reached one, so a term could outlive its decay and stay
     * resident in a layer nothing else was going to ask about.
     */
    removeAllLinksForTerm(term: Term): void;
    getLinkPriority(sourceTerm: Term, targetTerm: Term, layerName?: string): number;
    applyDecay(decayRate?: number): void;
    getStats(): Record<string, {
        size: number;
        capacity: number;
    }>;
    private layerFor;
}
export type { LinkManagerConfig };
//# sourceMappingURL=LinkManager.d.ts.map