/**
 * The `config-change` producer (§3.6). Emits a `config-change` block whenever
 * a configuration value changes, so the workspace has a visible audit trail of
 * what was adjusted. The diff payload is the same one the artifact viewer
 * renders.
 */

import { generateId } from '@senars/util';
import { $config } from './store.js';
import { projectWorkspace } from './workspace-projection.js';
import { narsBackend } from './nars-backend.js';
import { $workspaceGraph, applyWorkspaceOp } from './workspace-graph.js';
import type { ConfigChangeData, SemanticBlock, WorkspaceOp } from './workspace-graph.js';

let previousConfig: Record<string, unknown> = {};

/** Record the initial config so we can diff against it. */
export function initConfigChangeProducer(): void {
  previousConfig = { ...$config.get() };
  $config.subscribe((next) => {
    for (const key of [...new Set([...Object.keys(previousConfig), ...Object.keys(next)])]) {
      const before = previousConfig[key];
      const after = next[key];
      if (before === after) continue;
      if (before === undefined || after === undefined) continue;
      // Only emit for fields that have a value change (not metadata)
      const beforeVal = (before as Record<string, unknown>)?.value;
      const afterVal = (after as Record<string, unknown>)?.value;
      if (beforeVal === afterVal) continue;
      emitConfigChange(key, String(beforeVal ?? ''), String(afterVal ?? ''));
    }
    previousConfig = { ...next };
  });
}

function emitConfigChange(key: string, before: string, after: string): void {
  const block: SemanticBlock = {
    id: generateId('config-change'),
    kind: 'config-change',
    role: 'system',
    title: `Config: ${key}`,
    text: `${key}: ${before} → ${after}`,
    data: {
      before,
      after,
      language: 'json',
      from: key,
      to: key,
    } satisfies ConfigChangeData,
    status: 'complete',
    createdAt: Date.now(),
    createdBy: 'system',
  };

  const op: WorkspaceOp = { op: 'block.add', block };
  const graph = $workspaceGraph.get();
  $workspaceGraph.set(applyWorkspaceOp(graph, op));
}