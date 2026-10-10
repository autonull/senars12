/**
 * Incremental diff for WorkspaceGraph → WorkspaceOp stream (§P2.1).
 * Compares two graphs and emits the minimal operations to transform old → new.
 */

import type { Ref, SemanticBlock, SemanticLink, WorkspaceGraph, WorkspaceOp } from './workspace-graph.js';

/** Compute the diff between two WorkspaceGraphs as a WorkspaceOp stream. */
export function diffWorkspaceGraph(
  oldGraph: WorkspaceGraph,
  newGraph: WorkspaceGraph,
  baseSeq = 0
): WorkspaceOp[] {
  const ops: WorkspaceOp[] = [];
  let seq = baseSeq;

  // Blocks: added, removed, patched
  const oldBlocks = oldGraph.blocks;
  const newBlocks = newGraph.blocks;

  for (const [id, block] of newBlocks) {
    const oldBlock = oldBlocks.get(id);
    if (!oldBlock) {
      // Added
      ops.push({ op: 'block.add', block, seq: seq++ });
    } else if (blockNeedsPatch(oldBlock, block)) {
      // Patched - compute minimal patch
      const patch = computeBlockPatch(oldBlock, block);
      if (Object.keys(patch).length > 0) {
        ops.push({ op: 'block.patch', id, patch, seq: seq++ });
      }
    }
  }

  for (const id of oldBlocks.keys()) {
    if (!newBlocks.has(id)) {
      ops.push({ op: 'block.remove', id, seq: seq++ });
    }
  }

  // Links: added, removed
  const oldLinks = oldGraph.links;
  const newLinks = newGraph.links;

  for (const [id, link] of newLinks) {
    if (!oldLinks.has(id)) {
      ops.push({ op: 'link.add', link, seq: seq++ });
    }
  }

  for (const id of oldLinks.keys()) {
    if (!newLinks.has(id)) {
      ops.push({ op: 'link.remove', id, seq: seq++ });
    }
  }

  // Roots: if order changed
  if (rootsChanged(oldGraph.roots, newGraph.roots)) {
    ops.push({ op: 'roots.set', roots: newGraph.roots, seq: seq++ });
  }

  return ops;
}

/** Check if a block needs a patch (shallow compare of mutable fields). */
function blockNeedsPatch(oldBlock: SemanticBlock, newBlock: SemanticBlock): boolean {
  // Fields that can change during streaming/updates
  const mutableFields: (keyof SemanticBlock)[] = [
    'text',
    'status',
    'uncertainty',
    'data',
    'artifact',
    'spec',
    'children',
    'sourceRefs',
    'eventRefs',
    'provenanceRefs',
  ];
  return mutableFields.some((field) => oldBlock[field] !== newBlock[field]);
}

/** Compute minimal patch between two blocks. */
function computeBlockPatch(oldBlock: SemanticBlock, newBlock: SemanticBlock): Partial<SemanticBlock> {
  const patch: Partial<SemanticBlock> = {};
  const mutableFields: (keyof SemanticBlock)[] = [
    'text',
    'status',
    'uncertainty',
    'data',
    'artifact',
    'spec',
    'children',
    'sourceRefs',
    'eventRefs',
    'provenanceRefs',
  ];
  for (const field of mutableFields) {
    const newValue = newBlock[field];
    const oldValue = oldBlock[field];
    if (newValue !== oldValue) {
      (patch as Record<string, unknown>)[field] = newValue;
    }
  }
  return patch;
}

/** Check if roots array changed (order or content). */
function rootsChanged(oldRoots: Ref[], newRoots: Ref[]): boolean {
  if (oldRoots.length !== newRoots.length) return true;
  return oldRoots.some((id, i) => id !== newRoots[i]);
}