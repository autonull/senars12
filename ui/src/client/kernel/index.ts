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
export { connect, disconnect, send, reconnect } from './transport.js';
export { addAgentMessage, addUserMessage, applyServerMessage } from '../core/store-bindings.js';
export { mountWorkspaceProjection } from '../core/workspace-bindings.js';

// ── State (the shared atoms) ─────────────────────────────────────────────────
export { atom, setWsClient } from './state.js';
export type { Readable, Writable, GraphNodeData } from './state.js';
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
  $lastSeqId,
  $reasoningRunning,
  $runTerminations,
  $streamingDelta,
  $telemetry,
  $workspaceGraph,
  clearCognitiveEvents,
  clearConfigChanges,
  pushCognitiveEvents,
  pushConfigChange,
  pushServerError,
  revealBlock,
  setWorkspaceFocus,
  setWorkspaceSelection,
  $collapsedBlocks,
  $neighborhoodDepth,
  $capabilityFilter,
  toggleCollapsed,
  setCollapsed,
  setNeighborhoodDepth,
  $activeRenderer,
  setActiveRenderer,
  $webllmAvailable,
  $webllmActive,
  $webllmModel,
  type TelemetryData,
  type CognitiveMetricsData,
  type CognitiveMeta,
  type ServerErrorRecord,
  type RevisionEntry,
  type TestApiStorePath,
} from './state.js';

// ── UI state (lens, layer, viewport, filter) ──────────────────────────────────
export { $activeLens, $graphLayer, $graphShape, $viewportMode, $graphFilter } from '../core/store.js';
export type { Lens } from '@senars/core';
export type { ViewportMode } from '../core/store.js';

// ── Domain: the workspace graph and its projections ──────────────────────────
export {
  applyWorkspaceOp,
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  linksTouching,
} from './domain.js';
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
} from './domain.js';
export { diffWorkspaceGraph } from './domain.js';
export {
  blockRefFor,
  derivationsFor,
  linkRefFor,
  projectChat,
  projectCognitiveEvents,
  projectDerivationRecords,
  projectReasoning,
  projectWorkspace,
  projectWorkspaceGraph,
  resolveBlockRef,
} from './domain.js';
export type {
  WorkspaceEdgeData,
  WorkspaceNodeData,
  WorkspaceProjection,
} from './domain.js';

// ── Backends: the reasoning engines behind one control surface ───────────────
export { narsBackend, NAL_VOCABULARY } from './backends.js';
export { mettaBackend, METTA_VOCABULARY } from './backends.js';
export { awaitControl, settleControl } from './backends.js';
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
} from './backends.js';

// ── Events ───────────────────────────────────────────────────────────────────
export { eventBus } from './events.js';

// ── View system: one dataset, many shapes, one host ──────────────────────────
export { ViewHost } from './view.js';
export { viewSource } from './view.js';
export { viewAdapterFor, viewAdapters } from './view.js';
export { artifactViewSpec, tableFromColumns } from './view.js';
export type {
  Shape as ViewShape,
  TableDataset,
  TextDataset,
  TreeNode,
  TreeDataset,
  ViewDataset,
  ViewSelection,
  ViewSource,
  ViewSpec,
} from './view.js';

// ── Block vocabulary: kinds, labels, payloads ────────────────────────────────
export { blockDescriptor, kindsWhere } from '../core/block-descriptors.js';
export { blockLabel } from '../core/block-labels.js';
export { payloadOf } from '../core/block-payload.js';
export type { BlockEntry as BlockDescriptor } from '../core/block-descriptors.js';
export type { BlockPayloads, TableData, CodeData, ChartData } from '../core/block-payload.js';

// ── Capabilities: honest gating ──────────────────────────────────────────────
export { $capabilities, capabilityGate, setCapability } from '../core/capabilities.js';
export type { Capability } from '../core/capabilities.js';

// ── Store mutations (graph patches) ──────────────────────────────────────────
export { updateEdgeData, updateNodeData } from '../core/store.js';

// ── Components + commands ────────────────────────────────────────────────────
export { BaseComponent } from '../core/base-component.js';
export { activeCommands, registerCommand } from '../core/commands.js';
export type { Command } from '../core/commands.js';
export { matchCommands } from '../core/command-match.js';