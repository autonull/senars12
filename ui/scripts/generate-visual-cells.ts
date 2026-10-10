#!/usr/bin/env tsx
/**
 * Generate base visual cells from the surface registry.
 * Run with: pnpm --dir ui generate:visual-cells
 * Outputs to stdout (redirect to ui/tests/visual/generated-cells.ts)
 * Hand-curated cells in matrix.ts override/extend these.
 * 
 * This script defines surfaces statically to avoid importing Lit components
 * which require a browser environment. The surface definitions mirror those
 * in the source files.
 */

import type { VisualCell } from '../tests/visual/matrix.js';

interface SurfaceDescriptor {
  id: string;
  title: string;
  group?: string;
  tag?: string;
  bindings?: Record<string, unknown>;
}

/** Known surfaces — mirrors the defineSurface() calls in source files. */
const SURFACES: SurfaceDescriptor[] = [
  { id: 'view', title: 'View', group: 'Views' },
  { id: 'notebook', title: 'Notebook', group: 'workspace' },
  { id: 'overlay-settings', title: 'Configuration', group: 'overlay' },
  { id: 'overlay-palette', title: 'Command palette', group: 'overlay' },
  { id: 'overlay-telemetry', title: 'Telemetry', group: 'overlay' },
  { id: 'overlay-timeline', title: 'Timeline', group: 'overlay' },
  { id: 'overlay-toc', title: 'Table of contents', group: 'overlay' },
  { id: 'overlay-provider', title: 'Provider', group: 'overlay' },
  { id: 'overlay-explain', title: 'Explanation', group: 'overlay' },
  { id: 'overlay-artifact', title: 'Artifact', group: 'overlay' },
  { id: 'overlay-related', title: 'Related', group: 'overlay' },
  { id: 'overlay-block-menu', title: 'Block actions', group: 'overlay' },
  { id: 'overlay-tool-approval', title: 'Tool approval', group: 'overlay' },
  { id: 'overlay-nodes', title: 'Concepts', group: 'overlay' },
  { id: 'overlay-events', title: 'Event Log', group: 'overlay' },
  { id: 'overlay-chat', title: 'Conversation', group: 'overlay' },
  // 'overlay-inspector' is covered by hand-curated 'selection-node-detail' with proper prepare
  { id: 'contradiction-badge', title: 'Contradiction badge', group: 'component', tag: 'contradiction-badge' },
];

/** Map surface group to visual cell group. */
const GROUP_MAP: Record<string, string> = {
  Views: 'Views',
  workspace: 'Renderers',
  overlay: 'Overlays',
  component: 'Components',
};

/** Extra cell properties for known surfaces. */
const SURFACE_OVERRIDES: Partial<Record<string, Partial<VisualCell>>> = {
  view: { surface: 'view:graph', hash: '#panels=none' },
  notebook: { surface: 'renderer:notebook', hash: '#panels=none&renderer=notebook' },
  // Overlays (IDs match hand-curated cells: overlay-<surface-id>)
  'overlay-settings': { surface: 'overlay:settings', hash: '#panels=none' },
  'overlay-palette': { surface: 'overlay:palette', hash: '#panels=none' },
  'overlay-telemetry': { surface: 'overlay:telemetry', hash: '#panels=none' },
  'overlay-timeline': { surface: 'overlay:timeline', hash: '#panels=none' },
  'overlay-toc': { surface: 'overlay:toc', hash: '#panels=none' },
  'overlay-provider': { surface: 'overlay:provider', hash: '#panels=none' },
  'overlay-explain': { surface: 'overlay:explain', hash: '#panels=none' },
  'overlay-artifact': { surface: 'overlay:artifact', hash: '#panels=none' },
  'overlay-related': { surface: 'overlay:related', hash: '#panels=none' },
  'overlay-block-menu': { surface: 'overlay:block-menu', hash: '#panels=none' },
  'overlay-tool-approval': { surface: 'overlay:tool-approval', hash: '#panels=none' },
  'overlay-nodes': { surface: 'overlay:nodes', hash: '#panels=none' },
  'overlay-events': { surface: 'overlay:events', hash: '#panels=none' },
  'overlay-chat': { surface: 'overlay:chat', hash: '#panels=none' },
  // 'overlay-inspector' covered by hand-curated 'selection-node-detail'
  'contradiction-badge': { surface: 'component:contradiction-badge' },
};

/** Convert a SurfaceDescriptor to a base VisualCell. */
function surfaceToCell(descriptor: SurfaceDescriptor): VisualCell {
  const group = GROUP_MAP[descriptor.group ?? ''] ?? descriptor.group ?? 'Surfaces';
  const override = SURFACE_OVERRIDES[descriptor.id] ?? {};

  return {
    id: descriptor.id,
    group,
    title: descriptor.title,
    surface: override.surface ?? `surface:${descriptor.id}`,
    hash: override.hash,
    ...override,
  };
}

/** Main generation function. */
function main(): void {
  const cells = SURFACES.map(surfaceToCell);

  const output = `/**
 * Generated visual cells from surface registry.
 * DO NOT EDIT DIRECTLY — run \`pnpm --dir ui generate:visual-cells\` to regenerate.
 * Hand-curated cells in matrix.ts override/extend these.
 */
import type { VisualCell } from './matrix.js';

export const GENERATED_VISUAL_CELLS: VisualCell[] = ${JSON.stringify(cells, null, 2)};
`;

  console.log(output);
}

main();