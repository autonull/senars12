/**
 * Bundle/app composition tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  defineBundle,
  registerBundle,
  bundleFor,
  getBundles,
  bundleIds,
  resetBundles,
  applyBundle,
  type BundleDescriptor,
  type BundleSurfaces,
  type BundleViewAdapters,
  type BundleFacets,
  type BundleIntents,
  type BundleProjectors,
  type BundleProtocol,
  type BundleBackends,
  type BundleCapabilities,
  type BundleConfigFields,
  type ConfigFieldDescriptor,
  type CapabilityDescriptor,
} from '../../src/client/framework/bundle.js';
import { resetSurfaces, surfaceRegistry } from '../../src/client/framework/surface.js';
import { resetViewAdapters, viewAdapterRegistry } from '../../src/client/core/view-adapter.js';
import { resetFacets, facetFor } from '../../src/client/framework/facet.js';
import { resetIntents, intentFor } from '../../src/client/framework/intent.js';
import { resetProjectors, getProjector } from '../../src/client/framework/projector.js';
import { resetProtocols, protocolFor } from '../../src/client/framework/protocol.js';
import { resetBackends, backendFor } from '../../src/client/kernel/backends.js';
import { resetCapabilities, capabilityFor } from '../../src/client/core/capabilities.js';
import { resetConfigFields, configFieldFor } from '../../src/client/core/config-catalog.js';
import type { SurfaceDescriptor, Placement } from '../../src/client/framework/surface.js';
import type { ViewAdapter } from '../../src/client/core/view-adapter.js';
import type { FacetDescriptor } from '../../src/client/framework/facet.js';
import type { IntentDescriptor } from '../../src/client/framework/intent.js';
import type { Projector } from '../../src/client/framework/projector.js';
import type { ProtocolEntry } from '../../src/client/framework/protocol.js';
import type { ReasoningBackend } from '../../src/client/kernel/backends.js';

// Test helpers
const createTestSurface = (id: string, placement: Placement = 'viewport'): SurfaceDescriptor => ({
  id,
  label: `Test ${id}`,
  title: `Test ${id}`,
  icon: 'test',
  placement,
  tag: `test-${id}`,
});

const createTestViewAdapter = (): ViewAdapter => ({
  shape: 'test',
  tag: 'test-view',
  component: class extends HTMLElement {},
  budgets: { default: 100, embedded: 50 },
  interactions: { select: true, hover: false },
});

const createTestFacet = (id: string, kind: FacetDescriptor['kind']): FacetDescriptor => ({
  id,
  label: `Test ${kind}`,
  facets: {},
  kind,
  gate: { type: 'none' },
  data: {},
});

const createTestIntent = (id: string): IntentDescriptor => ({
  id,
  title: `Test ${id}`,
  label: `Test ${id}`,
  group: 'Test',
  kind: 'command',
  run: vi.fn(),
  available: () => true,
});

const createTestProjector = (id: string): Projector => ({
  id,
  project: vi.fn().mockReturnValue({ nodes: new Map(), edges: new Map() }),
});

const createTestProtocol = (type: string): ProtocolEntry => ({
  type,
  label: `Test ${type}`,
  direction: 'toServer',
  schema: { safeParse: () => ({ success: true }) } as any,
});

const createTestBackend = (id: string): ReasoningBackend => ({
  id,
  kind: 'test',
  vocab: { nodes: {}, edges: {} },
  caps: {
    canSubmit: true,
    canStep: true,
    canRun: true,
    canRetract: true,
    canRevise: true,
    canAddGoal: true,
    canAdjustBudget: true,
    canAdjustProvider: true,
    canAbort: true,
  },
  snapshot: () => ({ nodes: new Map(), edges: new Map() }),
});

const createTestCapability = (id: string): CapabilityDescriptor => ({
  id: id as any,
  label: `Test ${id}`,
  description: `Test ${id}`,
  default: false,
});

const createTestConfigField = (id: string): ConfigFieldDescriptor => ({
  id,
  label: `Test ${id}`,
  facets: {},
  type: 'string',
  default: 'test',
  description: `Test ${id}`,
  category: 'test',
});

describe('Bundle registry', () => {
  beforeEach(() => {
    resetBundles();
    resetSurfaces();
    resetViewAdapters();
    resetFacets();
    resetIntents();
    resetProjectors();
    resetProtocols();
    resetBackends();
    resetCapabilities();
    resetConfigFields();
  });

  afterEach(() => {
    resetBundles();
  });

  it('registers and retrieves a bundle', () => {
    const bundle: BundleDescriptor = {
      id: 'test-bundle',
      name: 'Test Bundle',
      description: 'A test bundle',
    };

    registerBundle(bundle);
    expect(bundleFor('test-bundle')).toEqual(bundle);
    expect(bundleFor('non-existent')).toBeUndefined();
  });

  it('throws on duplicate bundle id', () => {
    const bundle: BundleDescriptor = {
      id: 'test-bundle',
      name: 'Test Bundle',
    };

    registerBundle(bundle);
    expect(() => registerBundle(bundle)).toThrow('already registered');
  });

  it('lists all bundles', () => {
    const bundle1: BundleDescriptor = { id: 'bundle-1', name: 'Bundle 1' };
    const bundle2: BundleDescriptor = { id: 'bundle-2', name: 'Bundle 2' };

    registerBundle(bundle1);
    registerBundle(bundle2);

    expect(getBundles()).toHaveLength(2);
    expect(bundleIds()).toEqual(['bundle-1', 'bundle-2']);
  });

  it('defines and registers a bundle in one call', () => {
    const bundle = defineBundle({
      id: 'defined-bundle',
      name: 'Defined Bundle',
    });

    expect(bundleFor('defined-bundle')).toEqual(bundle);
  });

  it('resets the registry', () => {
    defineBundle({ id: 'bundle-1', name: 'Bundle 1' });
    resetBundles();
    expect(getBundles()).toHaveLength(0);
  });
});

describe('applyBundle - surfaces', () => {
  beforeEach(() => {
    resetBundles();
    resetSurfaces();
  });

  afterEach(() => {
    resetBundles();
    resetSurfaces();
  });

  it('registers viewport surfaces', () => {
    const bundle: BundleDescriptor = {
      id: 'surface-bundle',
      name: 'Surface Bundle',
      surfaces: {
        viewport: [createTestSurface('surface-1'), createTestSurface('surface-2')],
      },
    };

    applyBundle(bundle);

    expect(surfaceRegistry.get('surface-1')?.placement).toBe('viewport');
    expect(surfaceRegistry.get('surface-2')?.placement).toBe('viewport');
  });

  it('registers panel surfaces', () => {
    const bundle: BundleDescriptor = {
      id: 'panel-bundle',
      name: 'Panel Bundle',
      surfaces: {
        panel: [createTestSurface('panel-1', 'panel')],
      },
    };

    applyBundle(bundle);

    expect(surfaceRegistry.get('panel-1')?.placement).toBe('panel');
  });

  it('registers overlay surfaces', () => {
    const bundle: BundleDescriptor = {
      id: 'overlay-bundle',
      name: 'Overlay Bundle',
      surfaces: {
        overlay: [createTestSurface('overlay-1', 'overlay')],
      },
    };

    applyBundle(bundle);

    expect(surfaceRegistry.get('overlay-1')?.placement).toBe('overlay');
  });

  it('registers inline surfaces', () => {
    const bundle: BundleDescriptor = {
      id: 'inline-bundle',
      name: 'Inline Bundle',
      surfaces: {
        inline: [createTestSurface('inline-1', 'inline')],
      },
    };

    applyBundle(bundle);

    expect(surfaceRegistry.get('inline-1')?.placement).toBe('inline');
  });
});

describe('applyBundle - view adapters', () => {
  beforeEach(() => {
    resetBundles();
    resetViewAdapters();
  });

  afterEach(() => {
    resetBundles();
    resetViewAdapters();
  });

  it('registers view adapters', () => {
    const bundle: BundleDescriptor = {
      id: 'adapter-bundle',
      name: 'Adapter Bundle',
      viewAdapters: {
        adapters: [createTestViewAdapter()],
      },
    };

    applyBundle(bundle);

    // View adapters are registered in the core registry
    expect(viewAdapterRegistry.size).toBeGreaterThan(0);
  });
});

describe('applyBundle - facets', () => {
  beforeEach(() => {
    resetBundles();
    resetFacets();
  });

  afterEach(() => {
    resetBundles();
    resetFacets();
  });

  it('registers lens facets', () => {
    const bundle: BundleDescriptor = {
      id: 'facet-bundle',
      name: 'Facet Bundle',
      facets: {
        lenses: [createTestFacet('lens-1', 'lens')],
      },
    };

    applyBundle(bundle);

    expect(facetFor('lens-1')?.kind).toBe('lens');
  });

  it('registers layer facets', () => {
    const bundle: BundleDescriptor = {
      id: 'layer-bundle',
      name: 'Layer Bundle',
      facets: {
        layers: [createTestFacet('layer-1', 'layer')],
      },
    };

    applyBundle(bundle);

    expect(facetFor('layer-1')?.kind).toBe('layer');
  });

  it('registers mode facets', () => {
    const bundle: BundleDescriptor = {
      id: 'mode-bundle',
      name: 'Mode Bundle',
      facets: {
        modes: [createTestFacet('mode-1', 'mode')],
      },
    };

    applyBundle(bundle);

    expect(facetFor('mode-1')?.kind).toBe('mode');
  });

  it('registers filter facets', () => {
    const bundle: BundleDescriptor = {
      id: 'filter-bundle',
      name: 'Filter Bundle',
      facets: {
        filters: [createTestFacet('filter-1', 'filter')],
      },
    };

    applyBundle(bundle);

    expect(facetFor('filter-1')?.kind).toBe('filter');
  });
});

describe('applyBundle - intents', () => {
  beforeEach(() => {
    resetBundles();
    resetIntents();
  });

  afterEach(() => {
    resetBundles();
    resetIntents();
  });

  it('registers intents', () => {
    const bundle: BundleDescriptor = {
      id: 'intent-bundle',
      name: 'Intent Bundle',
      intents: {
        intents: [createTestIntent('intent-1'), createTestIntent('intent-2')],
      },
    };

    applyBundle(bundle);

    expect(intentFor('intent-1')).toBeDefined();
    expect(intentFor('intent-2')).toBeDefined();
  });
});

describe('applyBundle - projectors', () => {
  beforeEach(() => {
    resetBundles();
    resetProjectors();
  });

  afterEach(() => {
    resetBundles();
    resetProjectors();
  });

  it('registers projectors', () => {
    const bundle: BundleDescriptor = {
      id: 'projector-bundle',
      name: 'Projector Bundle',
      projectors: {
        projectors: [createTestProjector('projector-1')],
      },
    };

    applyBundle(bundle);

    expect(getProjector('projector-1')).toBeDefined();
  });
});

describe('applyBundle - protocol', () => {
  beforeEach(() => {
    resetBundles();
    resetProtocols();
  });

  afterEach(() => {
    resetBundles();
    resetProtocols();
  });

  it('registers protocol entries', () => {
    const bundle: BundleDescriptor = {
      id: 'protocol-bundle',
      name: 'Protocol Bundle',
      protocol: {
        messages: [createTestProtocol('test.message')],
      },
    };

    applyBundle(bundle);

    expect(protocolFor('test.message')).toBeDefined();
  });
});

describe('applyBundle - backends', () => {
  beforeEach(() => {
    resetBundles();
    resetBackends();
  });

  afterEach(() => {
    resetBundles();
    resetBackends();
  });

  it('registers backends', () => {
    const bundle: BundleDescriptor = {
      id: 'backend-bundle',
      name: 'Backend Bundle',
      backends: {
        backends: [createTestBackend('test-backend')],
      },
    };

    applyBundle(bundle);

    expect(backendFor('test-backend')).toBeDefined();
  });
});

describe('applyBundle - capabilities', () => {
  beforeEach(() => {
    resetBundles();
    resetCapabilities();
  });

  afterEach(() => {
    resetBundles();
    resetCapabilities();
  });

  it('registers capabilities', () => {
    const bundle: BundleDescriptor = {
      id: 'capability-bundle',
      name: 'Capability Bundle',
      capabilities: {
        capabilities: [createTestCapability('test-capability')],
      },
    };

    applyBundle(bundle);

    expect(capabilityFor('test-capability')).toBeDefined();
  });
});

describe('applyBundle - config fields', () => {
  beforeEach(() => {
    resetBundles();
    resetConfigFields();
  });

  afterEach(() => {
    resetBundles();
    resetConfigFields();
  });

  it('registers config fields', () => {
    const bundle: BundleDescriptor = {
      id: 'config-bundle',
      name: 'Config Bundle',
      configFields: {
        fields: [createTestConfigField('test.field')],
      },
    };

    applyBundle(bundle);

    expect(configFieldFor('test.field')).toBeDefined();
  });
});

describe('applyBundle - full bundle', () => {
  beforeEach(() => {
    resetBundles();
    resetSurfaces();
    resetViewAdapters();
    resetFacets();
    resetIntents();
    resetProjectors();
    resetProtocols();
    resetBackends();
    resetCapabilities();
    resetConfigFields();
  });

  afterEach(() => {
    resetBundles();
    resetSurfaces();
    resetViewAdapters();
    resetFacets();
    resetIntents();
    resetProjectors();
    resetProtocols();
    resetBackends();
    resetCapabilities();
    resetConfigFields();
  });

  it('applies a complete bundle with all contribution types', () => {
    const bundle: BundleDescriptor = {
      id: 'full-bundle',
      name: 'Full Bundle',
      surfaces: {
        viewport: [createTestSurface('surface-1')],
        panel: [createTestSurface('panel-1', 'panel')],
      },
      viewAdapters: {
        adapters: [createTestViewAdapter()],
      },
      facets: {
        lenses: [createTestFacet('lens-1', 'lens')],
        layers: [createTestFacet('layer-1', 'layer')],
      },
      intents: {
        intents: [createTestIntent('intent-1')],
      },
      projectors: {
        projectors: [createTestProjector('projector-1')],
      },
      protocol: {
        messages: [createTestProtocol('test.message')],
      },
      backends: {
        backends: [createTestBackend('backend-1')],
      },
      capabilities: {
        capabilities: [createTestCapability('capability-1')],
      },
      configFields: {
        fields: [createTestConfigField('test.field')],
      },
    };

    applyBundle(bundle);

    // Verify all contributions were registered
    expect(surfaceRegistry.get('surface-1')).toBeDefined();
    expect(surfaceRegistry.get('panel-1')).toBeDefined();

    expect(facetFor('lens-1')).toBeDefined();
    expect(facetFor('layer-1')).toBeDefined();

    expect(intentFor('intent-1')).toBeDefined();

    expect(getProjector('projector-1')).toBeDefined();

    expect(protocolFor('test.message')).toBeDefined();

    expect(backendFor('backend-1')).toBeDefined();

    expect(capabilityFor('capability-1')).toBeDefined();

    expect(configFieldFor('test.field')).toBeDefined();
  });
});