import { describe, expect, it } from 'vitest';
import {
  PANEL_DEFS,
  PANEL_KINDS,
  panelDef,
  panelKindsWhere,
} from '../../src/client/core/panel-defs.js';

const sorted = (kinds: readonly string[]): string[] => [...kinds].sort();

/** The facet sets are the former hardcoded lists — pinning them catches drift. */
const FACETS = {
  defaultDock: {
    left: ['search'],
    right: ['chat', 'lens-designer'],
    bottom: ['split'],
  },
  order: ['search', 'chat', 'lens-designer', 'split'],
  defaultOpen: [],
} as const;

describe('panel definitions', () => {
  it('derives PanelKind from the catalog keys (one source)', () => {
    expect(sorted(PANEL_KINDS)).toEqual(
      sorted(['search', 'chat', 'lens-designer', 'split'])
    );
    expect(PANEL_KINDS).toEqual(Object.keys(PANEL_DEFS.definition));
  });

  it('reads a definition by kind with a non-empty, distinct label', () => {
    for (const kind of PANEL_KINDS) expect(panelDef(kind).label.length).toBeGreaterThan(0);
    const labels = PANEL_KINDS.map((kind) => panelDef(kind).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('selects exactly the expected kinds for each facet', () => {
    expect(sorted(panelKindsWhere((def) => def.defaultDock === 'left'))).toEqual(sorted(FACETS.defaultDock.left));
    expect(sorted(panelKindsWhere((def) => def.defaultDock === 'right'))).toEqual(sorted(FACETS.defaultDock.right));
    expect(sorted(panelKindsWhere((def) => def.defaultDock === 'bottom'))).toEqual(sorted(FACETS.defaultDock.bottom));
    expect(sorted(panelKindsWhere((def) => def.defaultOpen))).toEqual(sorted(FACETS.defaultOpen));
  });

  it('catalog order matches the order facet', () => {
    const byOrder = PANEL_KINDS.slice().sort((a, b) => panelDef(a).order - panelDef(b).order);
    expect(byOrder).toEqual(FACETS.order);
  });
});