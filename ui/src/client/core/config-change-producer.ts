/**
 * The `config-change` producer (§3.6). Emits a `config-change` block whenever
 * a configuration value changes, so the workspace has a visible audit trail of
 * what was adjusted. The diff payload is the same one the artifact viewer
 * renders.
 */

import { generateId } from '@senars/util';
import { $config, $workspaceGraph } from './store.js';
import { projectWorkspace } from './workspace-projection.js';
import { narsBackend } from './nars-backend.js';
import { applyWorkspaceOp } from './workspace-graph.js';
import type { ConfigChangeData } from './block-payload.js';
import type { SemanticBlock, WorkspaceOp } from './workspace-graph.js';
import type { UiConfig } from './config-schema.js';

let previousConfig: UiConfig;

/** Record the initial config so we can diff against it. */
export function initConfigChangeProducer(): void {
  previousConfig = $config.get();
  $config.subscribe((next) => {
    const allKeys = new Set([...Object.keys(previousConfig), ...Object.keys(next)]);
    for (const key of allKeys) {
      const before = getNestedValue(previousConfig, key);
      const after = getNestedValue(next, key);
      if (before === after) continue;
      if (before === undefined && after === undefined) continue;
      if (isPrimitive(before) && isPrimitive(after) && String(before) === String(after)) continue;
      emitConfigChange(key, String(before ?? ''), String(after ?? ''));
    }
    previousConfig = next;
  });
}

function getNestedValue(obj: UiConfig, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => (acc as Record<string, unknown>)?.[key], obj);
}

function isPrimitive(value: unknown): boolean {
  return value === null || (typeof value !== 'object' && typeof value !== 'function');
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