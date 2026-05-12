import type {Term} from '../../terms';
import type {LinkEntry, LinkManagerConfig as LinkManagerConfigType, LinkType, SerializedLinkManager} from './types.js';
import {Layer} from './Layer.js';
import {TermLayer} from './TermLayer.js';

export class LinkManager {
private readonly layers: Map<string, Layer>;
private capacityByLayer: Map<string, number>;
private readonly config: LinkManagerConfigType;

constructor(config?: Partial<LinkManagerConfigType>) {
  this.config = {
  defaultCapacity: config?.defaultCapacity ?? 1000,
  layers: config?.layers ?? {term: 1000},
  globalDecayRate: config?.globalDecayRate ?? 0.001,
  forgetPolicy: config?.forgetPolicy ?? 'priority',
  };

  this.layers = new Map();
  this.capacityByLayer = new Map();

  for (const [name, capacity] of Object.entries(this.config.layers)) {
  this.registerLayer(name, capacity);
  }
}

static deserialize(
  data: SerializedLinkManager,
  termResolver: (id: string) => import('../../terms/index.js').Term | undefined
): LinkManager {
  const manager = new LinkManager(data.config);

  for (const layerData of data.layers) {
  const layer = TermLayer.deserialize(layerData, termResolver);
  manager.layers.set(layerData.name, layer);
  }

  return manager;
}

getLayer(name: string): Layer | undefined {
  return this.layers.get(name);
}

registerLayer(name: string, capacity: number): Layer {
  const existing = this.layers.get(name);
  if (existing) {
  return existing;
  }

  const layer = name === 'term' || name === 'semantic'
  ? new TermLayer(capacity, this.config.forgetPolicy)
  : new Layer(name, capacity, this.config.forgetPolicy);

  this.layers.set(name, layer);
  this.capacityByLayer.set(name, capacity);
  return layer;
}

addLink(
  sourceTerm: Term,
  targetTerm: Term,
  options?: {
  layer?: string;
  type?: LinkType;
  priority?: number;
  }
): LinkEntry | null {
  const layerName = options?.layer ?? 'term';
  const layer = this.getLayer(layerName) ?? this.registerLayer(layerName, this.config.defaultCapacity);

  if (layer instanceof TermLayer) {
  return layer.add(0, 0, {
    type: options?.type,
    priority: options?.priority,
    sourceTerm,
    targetTerm,
  });
  }

  return null;
}

getLinks(
  sourceTerm: Term,
  options?: {
  layer?: string;
  type?: LinkType;
  minPriority?: number;
  }
): LinkEntry[] {
  const layerName = options?.layer ?? 'term';
  const layer = this.getLayer(layerName);

  if (!layer) return [];

  if (layer instanceof TermLayer) {
    return layer.getLinksByTerm(sourceTerm);
  }

  return [];
}

removeByTerm(sourceTerm: Term, targetTerm: Term, type?: LinkType): boolean {
  const layer = this.getLayer('term');
  if (layer instanceof TermLayer) {
  return layer.removeByTerms(sourceTerm, targetTerm, type ?? 'term-link');
  }
  return false;
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
  const layerStats = layer.getStats();
  stats[name] = {
    size: layerStats.size,
    capacity: layerStats.capacity,
  };
  }
  return stats;
}

serialize(): SerializedLinkManager {
  const serializedLayers: SerializedLinkManager['layers'] = [];

  for (const layer of this.layers.values()) {
  if (layer instanceof TermLayer) {
    serializedLayers.push(layer.serialize());
  }
  }

  return {
  version: 1,
  layers: serializedLayers,
  config: this.config,
  };
}
}

export type {LinkManagerConfigType as LinkManagerConfig};
