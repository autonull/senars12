/**
 * UI Contract Registry — unified factory for all UI contract registries.
 *
 * Consolidates ShapeRegistry, ViewSpecRegistry, ChannelRegistry
 * into a single unified factory with consistent API.
 */

import type { UITerm, UIArtifact, UIProtocolMessage } from '../types';

/** Base registry interface. */
export interface Registry<T> {
  get(id: string): T | undefined;
  set(id: string, value: T): void;
  delete(id: string): boolean;
  has(id: string): boolean;
  keys(): IterableIterator<string>;
  values(): IterableIterator<T>;
  entries(): IterableIterator<[string, T]>;
  size: number;
  clear(): void;
}

/** In-memory registry implementation. */
export class MemoryRegistry<T> implements Registry<T> {
  private map = new Map<string, T>();

  get(id: string): T | undefined {
    return this.map.get(id);
  }

  set(id: string, value: T): void {
    this.map.set(id, value);
  }

  delete(id: string): boolean {
    return this.map.delete(id);
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  keys(): IterableIterator<string> {
    return this.map.keys();
  }

  values(): IterableIterator<T> {
    return this.map.values();
  }

  entries(): IterableIterator<[string, T]> {
    return this.map.entries();
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

/** Shape registry entry. */
export interface ShapeEntry {
  id: string;
  term: UITerm;
  description: string;
  tags: string[];
}

/** View spec registry entry. */
export interface ViewSpecEntry {
  id: string;
  shapeId: string;
  layout: string;
  bindings: Record<string, string>;
}

/** Channel registry entry. */
export interface ChannelEntry {
  id: string;
  name: string;
  type: 'input' | 'output' | 'bidirectional';
  schema: Record<string, unknown>;
}

/** Unified registry factory. */
export class UIContractRegistryFactory {
  private shapes: MemoryRegistry<ShapeEntry>;
  private viewSpecs: MemoryRegistry<ViewSpecEntry>;
  private channels: MemoryRegistry<ChannelEntry>;
  private artifacts: MemoryRegistry<import('../types').UIArtifact>;
  private protocols: MemoryRegistry<import('../types').UIProtocolMessage>;

  constructor() {
    this.shapes = new MemoryRegistry();
    this.viewSpecs = new MemoryRegistry();
    this.channels = new MemoryRegistry();
    this.artifacts = new MemoryRegistry();
    this.protocols = new MemoryRegistry();
  }

  /** Get shape registry. */
  shapeRegistry(): MemoryRegistry<ShapeEntry> {
    return this.shapes;
  }

  /** Get view spec registry. */
  viewSpecRegistry(): MemoryRegistry<ViewSpecEntry> {
    return this.viewSpecs;
  }

  /** Get channel registry. */
  channelRegistry(): MemoryRegistry<ChannelEntry> {
    return this.channels;
  }

  /** Get artifact registry. */
  artifactRegistry(): MemoryRegistry<import('../types').UIArtifact> {
    return this.artifacts;
  }

  /** Get protocol message registry. */
  protocolRegistry(): MemoryRegistry<import('../types').UIProtocolMessage> {
    return this.protocols;
  }

  /** Clear all registries. */
  clear(): void {
    this.shapes.clear();
    this.viewSpecs.clear();
    this.channels.clear();
    this.artifacts.clear();
    this.protocols.clear();
  }

  /** Get total count across all registries. */
  totalCount(): number {
    return this.shapes.size + this.viewSpecs.size + this.channels.size + this.artifacts.size + this.protocols.size;
  }
}

/** Global factory instance. */
let _factory: UIContractRegistryFactory | null = null;

export function getUIContractRegistryFactory(): UIContractRegistryFactory {
  if (!_factory) {
    _factory = new UIContractRegistryFactory();
  }
  return _factory;
}

export function setUIContractRegistryFactory(factory: UIContractRegistryFactory): void {
  _factory = factory;
}