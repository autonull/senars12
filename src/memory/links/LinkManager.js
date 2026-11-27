import { getOrInsert } from '@senars/util/collections';
import { LINK } from '../../constants';
import { Layer } from './Layer';
import { EmbeddingLayer } from './EmbeddingLayer';
import { LINK_LAYER } from './types';
const DEFAULT_LAYER = LINK_LAYER.TERM;
export class LinkManager {
    layers = new Map();
    config;
    constructor(config) {
        this.config = {
            defaultCapacity: config?.defaultCapacity ?? LINK.DEFAULT_CAPACITY,
            layers: config?.layers ?? { [DEFAULT_LAYER]: LINK.TERM_LAYER_CAPACITY },
            globalDecayRate: config?.globalDecayRate ?? LINK.DECAY_RATE,
            forgetPolicy: config?.forgetPolicy ?? LINK.FORGET_POLICY,
            clock: config?.clock,
            rng: config?.rng,
        };
        for (const [name, capacity] of Object.entries(this.config.layers)) {
            this.registerLayer(name, capacity);
        }
    }
    getLayer(name) {
        return this.layers.get(name);
    }
    getEmbeddingLayer() {
        const layer = this.layers.get(LINK_LAYER.EMBEDDING);
        return layer instanceof EmbeddingLayer ? layer : undefined;
    }
    registerLayer(name, capacity) {
        return getOrInsert(this.layers, name, () => new Layer(name, capacity, this.config.forgetPolicy, this.config.rng, this.config.clock));
    }
    setLayer(name, layer) {
        this.layers.set(name, layer);
    }
    addLink(sourceTerm, targetTerm, options) {
        const name = options?.layer ?? DEFAULT_LAYER;
        return this.layerFor(name).addLink({
            sourceTerm,
            targetTerm,
            type: options?.type,
            priority: options?.priority,
        });
    }
    getLinks(sourceTerm, options) {
        return (this.layers
            .get(options?.layer ?? DEFAULT_LAYER)
            ?.getLinksByTerm(sourceTerm, {
            type: options?.type,
            minPriority: options?.minPriority,
            maxResults: options?.maxResults,
        }) ?? []);
    }
    removeByTerm(sourceTerm, targetTerm, type) {
        return this.layerFor(DEFAULT_LAYER).removeLink(sourceTerm, targetTerm, type);
    }
    /**
     * Every layer, because {@link applyDecay} already is: a decay pass reaches all
     * of them and a removal reached one, so a term could outlive its decay and stay
     * resident in a layer nothing else was going to ask about.
     */
    removeAllLinksForTerm(term) {
        for (const layer of this.layers.values())
            layer.removeAllLinksForTerm(term);
    }
    getLinkPriority(sourceTerm, targetTerm, layerName = DEFAULT_LAYER) {
        return this.layers.get(layerName)?.getLinkPriority(sourceTerm, targetTerm) ?? 0;
    }
    applyDecay(decayRate) {
        const rate = decayRate ?? this.config.globalDecayRate;
        for (const layer of this.layers.values()) {
            layer.applyDecay(rate);
        }
    }
    getStats() {
        const stats = {};
        for (const [name, layer] of this.layers) {
            const { size, capacity } = layer.getStats();
            stats[name] = { size, capacity };
        }
        return stats;
    }
    layerFor(name) {
        return this.layers.get(name) ?? this.registerLayer(name, this.config.defaultCapacity);
    }
}
