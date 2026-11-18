/**
 * Deck Inspector — minimal inspector for debugging and visualization.
 *
 * Part of the deck: inspector + 3 views (timeline, provenance, pressure).
 */

import type { Artifact } from '@senars/admit/repertoire.js';
import type { HabitatState, HabitatStepResult } from '@senars/worlds/habitat.js';
import type { Scorecard } from '@senars/worlds/pack.js';

/** Inspector panel. */
export interface InspectorPanel {
  /** Panel ID. */
  id: string;
  /** Panel title. */
  title: string;
  /** Render function. */
  render: (data: unknown) => string;
}

/** Inspector state. */
export interface InspectorState {
  /** Active panels. */
  panels: InspectorPanel[];
  /** Current view. */
  view: 'timeline' | 'provenance' | 'pressure' | 'artifacts' | 'habitat';
  /** Selected item. */
  selected?: string;
  /** Filters. */
  filters: Record<string, unknown>;
}

/** Create inspector. */
export function createInspector(): InspectorState {
  return {
    panels: [
      {
        id: 'timeline',
        title: 'Timeline',
        render: renderTimeline,
      },
      {
        id: 'provenance',
        title: 'Provenance',
        render: renderProvenance,
      },
      {
        id: 'pressure',
        title: 'Pressure',
        render: renderPressure,
      },
      {
        id: 'artifacts',
        title: 'Artifacts',
        render: renderArtifacts,
      },
      {
        id: 'habitat',
        title: 'Habitat',
        render: renderHabitat,
      },
    ],
    view: 'timeline',
    filters: {},
  };
}

/** Switch view. */
export function setView(state: InspectorState, view: InspectorState['view']): void {
  state.view = view;
}

/** Set selected item. */
export function selectItem(state: InspectorState, id: string | undefined): void {
  state.selected = id;
}

/** Set filter. */
export function setFilter(state: InspectorState, key: string, value: unknown): void {
  state.filters[key] = value;
}

/** Render current view. */
export function renderInspector(state: InspectorState, data: unknown): string {
  const panel = state.panels.find(p => p.id === state.view);
  if (!panel) return `Unknown view: ${state.view}`;
  return panel.render(data);
}

/** Timeline view renderer. */
function renderTimeline(data: unknown): string {
  // In a real implementation, render timeline from log events
  return `
╔══════════════════════════════════════════════════════════════╗
║ TIMELINE                                                    ║
╠══════════════════════════════════════════════════════════════╣
║ [timestamp] event-type: description                         ║
║ ...                                                         ║
╚══════════════════════════════════════════════════════════════╝
  `.trim();
}

/** Provenance view renderer. */
function renderProvenance(data: unknown): string {
  return `
╔══════════════════════════════════════════════════════════════╗
║ PROVENANCE                                                  ║
╠══════════════════════════════════════════════════════════════╣
║ Artifact: <id>                                              ║
║ Stamp: <stamp>                                              ║
║ Parents: <parent-ids>                                       ║
║ Derivation: <steps>                                         ║
╚══════════════════════════════════════════════════════════════╝
  `.trim();
}

/** Pressure view renderer. */
function renderPressure(data: unknown): string {
  return `
╔══════════════════════════════════════════════════════════════╗
║ PRESSURE                                                    ║
╠══════════════════════════════════════════════════════════════╣
║ Budget: ████████░░ 80%                                      ║
║ Attention: ██████░░░░ 60%                                   ║
║ Queue: ████████████ 120%                                    ║
╚══════════════════════════════════════════════════════════════╝
  `.trim();
}

/** Artifacts view renderer. */
function renderArtifacts(data: unknown): string {
  return `
╔══════════════════════════════════════════════════════════════╗
║ ARTIFACTS                                                   ║
╠══════════════════════════════════════════════════════════════╣
║ ID           Kind       Status    Truth     Usage           ║
║ ─────────────────────────────────────────────────────────   ║
║ art-1        belief    admitted  %1.00;0.90%  42            ║
║ art-2        skill     admitted  %0.80;0.85%  15            ║
╚══════════════════════════════════════════════════════════════╝
  `.trim();
}

/** Habitat view renderer. */
function renderHabitat(data: unknown): string {
  return `
╔══════════════════════════════════════════════════════════════╗
║ HABITAT                                                     ║
╠══════════════════════════════════════════════════════════════╣
║ State: <habitat-state>                                      ║
║ Step: <n> / <max>                                           ║
║ Reward: <r>                                                 ║
╚══════════════════════════════════════════════════════════════╝
  `.trim();
}

/** Get panel by ID. */
export function getPanel(state: InspectorState, id: string): InspectorPanel | undefined {
  return state.panels.find(p => p.id === id);
}

/** Add custom panel. */
export function addPanel(state: InspectorState, panel: InspectorPanel): void {
  state.panels.push(panel);
}

/** Remove panel. */
export function removePanel(state: InspectorState, id: string): boolean {
  const index = state.panels.findIndex(p => p.id === id);
  if (index === -1) return false;
  state.panels.splice(index, 1);
  return true;
}