/**
 * The UI kernel — the substrate every SeNARS app is composed from.
 *
 * This is the *only* module a prototype should import from the client. It is
 * deliberately narrow: transport, state, the domain graph, the reasoning
 * backends, the event bus, the view system and the shared block vocabulary.
 * Nothing here renders, lays out, or picks a lens — those are app decisions.
 *
 * The boundary is a discipline, not a mechanism: `core/` still holds both the
 * substrate and the legacy HUD's chrome while the split lands. New apps import
 * from here so the seam is real from day one.
 */

// ── Transport ────────────────────────────────────────────────────────────────
export { connect, disconnect, send } from '../core/ws-client.js';
export { addAgentMessage, addUserMessage, applyServerMessage } from '../core/store-bindings.js';

// ── State (the shared atoms) ─────────────────────────────────────────────────
export { atom } from '../core/store.js';
export {
  $chatMessages,
  $cognitiveEvents,
  $cognitiveMetrics,
  $config,
  $configChanges,
  $connectionState,
  $controlMode,
  $graphEdges,
  $graphMeta,
  $graphNodes,
  $graphShape,
  $lastSeqId,
  $nodeHistory,
  $reasoningRunning,
  $runTerminations,
  $selectedNodeId,
  $selectedNodeIds,
  $streamingDelta,
  $telemetry,
  $view,
  $viewSelection,
  $viewport,
  $workspaceGraph,
  clearCognitiveEvents,
  clearConfigChanges,
  pushCognitiveEvents,
  pushConfigChange,
  pushServerError,
  revealBlock,
  setWorkspaceFocus,
  setWorkspaceSelection,
  updateEdgeData,
  updateNodeData,
} from '../core/store.js';

// ── Domain: the workspace graph and its projections ──────────────────────────
export {
  applyWorkspaceOp,
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  linksTouching,
} from '../core/workspace-graph.js';
export type {
  Artifact,
  BlockKind,
  BlockStatus,
  CreatedBy,
  Ref,
  SemanticBlock,
  SemanticLink,
  SemanticLinkKind,
  SemanticRole,
  Uncertainty,
  WorkspaceGraph,
  WorkspaceOp,
} from '../core/workspace-graph.js';
export { diffWorkspaceGraph } from '../core/workspace-diff.js';
export {
  blockRefFor,
  derivationsFor,
  linkRefFor,
  projectChat,
  projectCognitiveEvents,
  projectDerivationRecords,
  projectReasoning,
  projectWorkspace,
  resolveBlockRef,
} from '../core/workspace-projection.js';
export type {
  WorkspaceEdgeData,
  WorkspaceNodeData,
  WorkspaceProjection,
} from '../core/graph-projection.js';

// ── Backends: the reasoning engines behind one control surface ───────────────
export { narsBackend, NAL_VOCABULARY } from '../core/nars-backend.js';
export { mettaBackend, METTA_VOCABULARY } from '../core/metta-backend.js';
export { awaitControl, settleControl } from '../core/control-channel.js';
export type {
  BackendCaps,
  BackendEdge,
  BackendNode,
  BackendSnapshot,
  BackendVocabulary,
  ControlResult,
  ReasoningBackend,
  ReasoningControl,
  SubmitInput,
} from '../core/reasoning-backend.js';

// ── Events ───────────────────────────────────────────────────────────────────
export { eventBus } from '../core/events.js';

// ── View system: one dataset, many shapes, one host ──────────────────────────
export { ViewHost } from '../core/view-host.js';
export { viewSource } from '../core/view-sources.js';
export { viewAdapterFor, viewAdapters } from '../core/view-adapter.js';
export { artifactViewSpec, tableFromColumns } from '../core/artifacts.js';
export type {
  Shape,
  TableDataset,
  TextDataset,
  TreeNode,
  TreeDataset,
  ViewDataset,
  ViewSelection,
  ViewSource,
  ViewSpec,
} from '../core/view-spec.js';

// ── Block vocabulary: kinds, labels, payloads ────────────────────────────────
export { blockDescriptor, kindsWhere } from '../core/block-descriptors.js';
export { blockLabel } from '../core/block-labels.js';
export { payloadOf } from '../core/block-payload.js';
export type { BlockDescriptor } from '../core/block-descriptors.js';
export type { BlockPayloads, TableData, CodeData, ChartData } from '../core/block-payload.js';

// ── Capabilities: honest gating ──────────────────────────────────────────────
export { $capabilities, capabilityGate, setCapability } from '../core/capabilities.js';
export type { Capability } from '../core/capabilities.js';

// ── Components + commands ────────────────────────────────────────────────────
export { BaseComponent } from '../core/base-component.js';
export { activeCommands, registerCommand } from '../core/commands.js';
export type { Command } from '../core/commands.js';
export { matchCommands } from '../core/command-match.js';
