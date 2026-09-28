import type { Term } from '../../terms';
import { Layer } from './Layer.js';
import { EmbeddingLayer } from './EmbeddingLayer.js';
import type { LinkEntry, LinkManagerConfig, LinkType } from './types.js';

const DEFAULT_LAYER = 'term';

export class LinkManager {
  private readonly layers = new Map<string, Layer>();
  private readonly config: LinkManagerConfig;

  constructor(config?: Partial<LinkManagerConfig>) {
    this.config = {
      defaultCapacity: config?.defaultCapacity ?? 1000,
      layers: config?.layers ?? { [DEFAULT_LAYER]: 1000 },
      globalDecayRate: config?.globalDecayRate ?? 0.001,
      forgetPolicy: config?.forgetPolicy ?? 'priority',
    };

    for (const [name, capacity] of Object.entries(this.config.layers)) {
      this.registerLayer(name, capacity);
    }
  }

  getLayer(name: string): Layer | undefined {
    return this.layers.get(name);
  }

  getEmbeddingLayer(): EmbeddingLayer | undefined {
    const layer = this.layers.get('embedding');
    return layer instanceof EmbeddingLayer ? layer : undefined;
  }

  registerLayer(name: string, capacity: number): Layer {
    const existing = this.layers.get(name);
    if (existing) return existing;
    const layer = new Layer(name, capacity, this.config.forgetPolicy);
    this.layers.set(name, layer);
    return layer;
  }

  setLayer(name: string, layer: Layer): void {
    this.layers.set(name, layer);
  }

  addLink(
    sourceTerm: Term,
    targetTerm: Term,
    options?: { layer?: string; type?: LinkType; priority?: number }
  ): LinkEntry | null {
    const name = options?.layer ?? DEFAULT_LAYER;
    return this.layerFor(name).addLink({
      sourceTerm,
      targetTerm,
      type: options?.type,
      priority: options?.priority,
    });
  }

  getLinks(
    sourceTerm: Term,
    options?: { layer?: string; type?: LinkType; minPriority?: number }
  ): LinkEntry[] {
    return this.layers
      .get(options?.layer ?? DEFAULT_LAYER)
      ?.getLinksByTerm(sourceTerm, { type: options?.type, minPriority: options?.minPriority }) ?? [];
  }

  removeByTerm(sourceTerm: Term, targetTerm: Term, type?: LinkType): boolean {
    return this.layerFor(DEFAULT_LAYER).removeLink(sourceTerm, targetTerm, type);
  }

  removeAllLinksForTerm(term: Term): void {
    this.layerFor(DEFAULT_LAYER).removeAllLinksForTerm(term);
  }

  getLinkPriority(sourceTerm: Term, targetTerm: Term, layerName = DEFAULT_LAYER): number {
    return this.layers.get(layerName)?.getLinkPriority(sourceTerm, targetTerm) ?? 0;
  }

  applyDecay(decayRate?: number): void {
    const rate = decayRate ?? this.config.globalDecayRate;
    for (const layer of this.layers.values()) {
      layer.applyDecay(rate);
    }
  }

  getStats(): Record<string, { size: number; capacity: number }> {
    const stats: Record<string, { size: number; capacity: number }> = {};
    for (const [name, layer] of this.layers) {
      const { size, capacity } = layer.getStats();
      stats[name] = { size, capacity };
    }
    return stats;
  }

  private layerFor(name: string): Layer {
    return this.layers.get(name) ?? this.registerLayer(name, this.config.defaultCapacity);
  }
}

export type { LinkManagerConfig };
