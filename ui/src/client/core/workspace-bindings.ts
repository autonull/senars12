/**
 * The live seam between client state and the workspace substrate (§0.2). The
 * pure projection in `workspace-projection.ts` turns the chat log and the
 * attached reasoning backend's substrate — the latter itself produced by the
 * existing bridge/`GRAPH_REDUCERS` path — into `WorkspaceOps`-equivalent
 * content; this binding keeps `$workspaceGraph` in step with them, so the
 * workspace renders the real session without re-owning the graph's event
 * behavior. Session state (`focus`/`selection`/`timeCursor`) is carried across
 * re-projections because it is not event-sourced.
 */

import { narsBackend } from './nars-backend.js';
import { mettaBackend } from './metta-backend.js';
import { $chatMessages, $graphEdges, $graphNodes, $workspaceGraph, $config } from './store.js';
import { projectWorkspace } from './workspace-projection.js';
import { initConfigChangeProducer } from './config-change-producer.js';
import { registerBuiltinTools, initToolApproval } from './tool-registry.js';
import type { WorkspaceGraph } from './workspace-graph.js';

/** Re-project current client state into `$workspaceGraph`, preserving session state. */
export function syncWorkspaceGraph(): WorkspaceGraph {
  const previous = $workspaceGraph.get();
  const next = projectWorkspace({ messages: $chatMessages.get(), backends: [narsBackend, mettaBackend] });
  next.focus = previous.focus;
  next.selection = previous.selection;
  next.timeCursor = previous.timeCursor;
  $workspaceGraph.set(next);
  return next;
}

/** Keep `$workspaceGraph` in sync with chat and the engine graph; returns an unsubscribe. */
export function mountWorkspaceProjection(): () => void {
  // Initialize built-in tools and approval flow
  registerBuiltinTools();
  initToolApproval();

  // Initialize config change tracking after config is hydrated from server
  const configUnsub = $config.subscribe(() => {
    // Config is hydrated; start tracking changes
    initConfigChangeProducer();
    configUnsub();
  });

  const unsubscribers = [
    $chatMessages.subscribe(syncWorkspaceGraph),
    $graphNodes.subscribe(syncWorkspaceGraph),
    $graphEdges.subscribe(syncWorkspaceGraph),
  ];
  syncWorkspaceGraph();
  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}
