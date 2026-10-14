/**
 * Bundle — a composable package of contributions.
 *
 * Replaces:
 *   - the former `PluginContribution` fan-out (plugins.ts) — one descriptor that
 *     declares contributions to all catalogs
 *   - empty `bundles/` directory — the parked idea with the same intent
 *
 * A bundle is a single descriptor that declares contributions to all catalogs.
 * `applyBundle(bundle)` registers everything. `defineApp` = bundle + shell + default surface.
 */

import type { Contribution } from './contribution.js';
import type { Catalog, CatalogDefinition, CatalogEntry } from './catalog.js';
import type { SurfaceDescriptor } from './surface.js';
import type { ViewAdapter } from '../core/view-adapter.js';
import type { FacetDescriptor, FacetKind } from './facet.js';
import type { IntentDescriptor } from './intent.js';
import type { Projector } from './projector.js';
import type { ProtocolEntry } from './protocol.js';
import type { ReasoningBackend } from '../kernel/backends.js';
import type { CapabilityDescriptor } from '../core/capabilities.js';

import { registerSurface } from './surface.js';
import { registerViewAdapter } from '../core/view-adapter.js';
import { registerFacet } from './facet.js';
import { registerIntent } from './intent.js';
import { registerProjector } from './projector.js';
import { registerProtocol } from './protocol.js';
import { registerBackend } from '../kernel/backends.js';
import { registerCapability } from '../core/capabilities.js';
import { registerConfigField } from '../core/config-catalog.js';

/** The kind of contribution in a bundle. */
export type BundleContributionKind =
  | 'surface'
  | 'viewAdapter'
  | 'facet'
  | 'intent'
  | 'projector'
  | 'protocol'
  | 'backend'
  | 'capability'
  | 'configField';

/** A contribution entry in a bundle. */
export interface BundleContribution<K extends BundleContributionKind = BundleContributionKind> {
  readonly kind: K;
  readonly descriptor: unknown;
}

/** Surfaces contribution. */
export interface BundleSurfaces {
  readonly viewport?: readonly SurfaceDescriptor[];
  readonly panel?: readonly SurfaceDescriptor[];
  readonly overlay?: readonly SurfaceDescriptor[];
  readonly inline?: readonly SurfaceDescriptor[];
}

/** View adapters contribution. */
export interface BundleViewAdapters {
  readonly adapters: readonly ViewAdapter[];
}

/** Facets contribution (lenses, layers, filters, modes). */
export interface BundleFacets {
  readonly lenses?: readonly FacetDescriptor[];
  readonly layers?: readonly FacetDescriptor[];
  readonly modes?: readonly FacetDescriptor[];
  readonly filters?: readonly FacetDescriptor[];
}

/** Intents contribution. */
export interface BundleIntents {
  readonly intents: readonly IntentDescriptor[];
}

/** Projectors contribution. */
export interface BundleProjectors {
  readonly projectors: readonly Projector[];
}

/** Protocol contribution. */
export interface BundleProtocol {
  readonly messages: readonly ProtocolEntry[];
}

/** Backends contribution. */
export interface BundleBackends {
  readonly backends: readonly ReasoningBackend[];
}

/** Capabilities contribution. */
export interface BundleCapabilities {
  readonly capabilities: readonly CapabilityDescriptor[];
}

/** Config fields contribution. */
export interface BundleConfigFields {
  readonly fields: readonly ConfigFieldDescriptor[];
}

/** A config field descriptor. */
export interface ConfigFieldDescriptor extends Contribution<Record<string, unknown>> {
  readonly type: 'string' | 'number' | 'boolean' | 'enum';
  readonly default: unknown;
  readonly description?: string;
  readonly enumValues?: readonly string[];
  readonly category?: string;
  /** Whether this field requires a backend restart to take effect. */
  readonly requiresRestart?: boolean;
}

/** Bundle descriptor — the one composition primitive. */
export interface BundleDescriptor {
  /** Unique bundle id. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** Optional description. */
  readonly description?: string;
  /** Surfaces (mountable UI). */
  readonly surfaces?: BundleSurfaces;
  /** View adapters (shape → component). */
  readonly viewAdapters?: BundleViewAdapters;
  /** Facets (modulations: lenses, layers, filters, modes). */
  readonly facets?: BundleFacets;
  /** Intents (commands + signals). */
  readonly intents?: BundleIntents;
  /** Projectors (projection pipeline). */
  readonly projectors?: BundleProjectors;
  /** Protocol messages (wire protocol). */
  readonly protocol?: BundleProtocol;
  /** Reasoning backends. */
  readonly backends?: BundleBackends;
  /** Capabilities. */
  readonly capabilities?: BundleCapabilities;
  /** Config fields. */
  readonly configFields?: BundleConfigFields;
}

/** The bundle registry. */
const bundleRegistry = new Map<string, BundleDescriptor>();

/** Register a bundle. */
export function registerBundle(bundle: BundleDescriptor): void {
  if (bundleRegistry.has(bundle.id)) {
    throw new Error(`Bundle with id "${bundle.id}" already registered`);
  }
  bundleRegistry.set(bundle.id, bundle);
}

/** Get a bundle by id. */
export function bundleFor(id: string): BundleDescriptor | undefined {
  return bundleRegistry.get(id);
}

/** All registered bundles. */
export function getBundles(): readonly BundleDescriptor[] {
  return [...bundleRegistry.values()];
}

/** All bundle ids. */
export function bundleIds(): readonly string[] {
  return [...bundleRegistry.keys()];
}

/** Reset bundle registry (for testing). */
export function resetBundles(): void {
  bundleRegistry.clear();
}

/**
 * Define and register a bundle. Returns the descriptor for composition.
 */
export function defineBundle<K extends string>(
  descriptor: Omit<BundleDescriptor, 'id'> & { readonly id: K }
): BundleDescriptor & { readonly id: K } {
  registerBundle(descriptor);
  return descriptor;
}

/** Apply a bundle to all registries. */
export function applyBundle(bundle: BundleDescriptor): void {
  // Surfaces
  if (bundle.surfaces) {
    for (const placement of ['viewport', 'panel', 'overlay', 'inline'] as const) {
      const surfaces = bundle.surfaces[placement];
      if (surfaces) {
        for (const surface of surfaces) {
          registerSurface({ ...surface, placement });
        }
      }
    }
  }

  // View adapters
  if (bundle.viewAdapters) {
    for (const adapter of bundle.viewAdapters.adapters) {
      registerViewAdapter(adapter);
    }
  }

  // Facets
  if (bundle.facets) {
    if (bundle.facets.lenses) {
      for (const lens of bundle.facets.lenses) registerFacet(lens);
    }
    if (bundle.facets.layers) {
      for (const layer of bundle.facets.layers) registerFacet(layer);
    }
    if (bundle.facets.modes) {
      for (const mode of bundle.facets.modes) registerFacet(mode);
    }
    if (bundle.facets.filters) {
      for (const filter of bundle.facets.filters) registerFacet(filter);
    }
  }

  // Intents
  if (bundle.intents) {
    for (const intent of bundle.intents.intents) {
      registerIntent(intent);
    }
  }

  // Projectors
  if (bundle.projectors) {
    for (const projector of bundle.projectors.projectors) {
      registerProjector(projector);
    }
  }

  // Protocol
  if (bundle.protocol) {
    for (const message of bundle.protocol.messages) {
      registerProtocol(message);
    }
  }

  // Backends
  if (bundle.backends) {
    for (const backend of bundle.backends.backends) {
      registerBackend(backend);
    }
  }

  // Capabilities
  if (bundle.capabilities) {
    for (const capability of bundle.capabilities.capabilities) {
      registerCapability(capability);
    }
  }

  // Config fields
  if (bundle.configFields) {
    for (const field of bundle.configFields.fields) {
      registerConfigField(field);
    }
  }
}
