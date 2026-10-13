/**
 * Projector — a registered projection from client state to a WorkspaceFragment.
 *
 * Replaces the hardcoded producer list in `projectWorkspace` with a registry.
 * A new capability adds a projector entry instead of editing a merge function.
 *
 * The registry uses the same `defineCatalog` pattern as other framework catalogs
 * so the type system catches drift (missing entry = type error).
 */

import { defineCatalog, type Catalog, type CatalogDefinition } from './catalog.js';
import type { WorkspaceFragment } from '../core/workspace-projection.js';

/** Input state available to all projectors. */
export interface ProjectorContext {
  readonly messages: readonly import('@senars/core').ChatMessage[];
  readonly backends: readonly import('../core/reasoning-backend.js').ReasoningBackend[];
  readonly cognitiveEvents?: readonly import('@senars/core').CognitiveEvent[];
  readonly workspaceGraph: import('../core/workspace-graph.js').WorkspaceGraph;
}

/** A projector produces a WorkspaceFragment from the context. */
export interface Projector {
  readonly id: string;
  readonly project: (ctx: ProjectorContext) => WorkspaceFragment;
}

/** Flat catalog entry for a projector. */
export interface ProjectorEntry {
  readonly label: string;
  readonly project: (ctx: ProjectorContext) => WorkspaceFragment;
  readonly [key: string]: unknown;
}

/** The projector catalog definition type. */
export type ProjectorCatalogDefinition = CatalogDefinition<ProjectorEntry>;

/** The compiled projector catalog. */
export type ProjectorCatalog = Catalog<ProjectorCatalogDefinition>;

/** Create a projector catalog from a definition. */
export function defineProjectorCatalog<const Def extends Record<string, ProjectorEntry>>(def: Def): Catalog<CatalogDefinition<ProjectorEntry>> {
  // Use a type assertion since ProjectorEntry satisfies the structural requirements of CatalogEntry
  return defineCatalog(def as any);
}

/** Global projector registry (mutable for boot-time registration). */
const projectorRegistry = new Map<string, Projector>();

/** Register a projector at boot time. */
export function registerProjector(projector: Projector): void {
  projectorRegistry.set(projector.id, projector);
}

/** Get a projector by id. */
export function getProjector(id: string): Projector | undefined {
  return projectorRegistry.get(id);
}

/** All registered projector ids. */
export function projectorIds(): readonly string[] {
  return [...projectorRegistry.keys()];
}

/** All registered projectors. */
export function getProjectors(): readonly Projector[] {
  return [...projectorRegistry.values()];
}

/** Clear the registry (test-only). */
export function clearProjectors(): void {
  projectorRegistry.clear();
}

/** Merge fragments from all registered projectors into a WorkspaceGraph. */
export function mergeProjectorFragments(
  ctx: ProjectorContext,
  projectors?: readonly Projector[]
): import('../core/workspace-graph.js').WorkspaceGraph {
  const projs = projectors ?? getProjectors();
  const fragments = projs.map((p) => p.project(ctx));
  return mergeFragments(fragments);
}

/** Merge multiple fragments into one WorkspaceGraph (copy-on-write). */
export function mergeFragments(
  fragments: readonly WorkspaceFragment[]
): import('../core/workspace-graph.js').WorkspaceGraph {
  const { emptyWorkspaceGraph } = require('../core/workspace-graph.js');
  const graph = emptyWorkspaceGraph();
  for (const fragment of fragments) {
    for (const block of fragment.blocks) graph.blocks.set(block.id, block);
    for (const link of fragment.links) graph.links.set(link.id, link);
    for (const root of fragment.roots) {
      if (!graph.roots.includes(root)) graph.roots.push(root);
    }
  }
  return graph;
}