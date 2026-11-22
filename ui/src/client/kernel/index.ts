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
export { connect, disconnect, send, reconnect } from './transport';
export { addAgentMessage, addUserMessage, applyServerMessage } from '../core/store-bindings';
export { mountWorkspaceProjection } from '../core/workspace-bindings';

// ── State (the shared atoms) ─────────────────────────────────────────────────
export { atom, setWsClient } from './state';
export type { Readable, Writable, GraphNodeData } from './state';
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
  // UI.17 focus model
  $focusStack,
  $focus,
  $aspect,
  setAspect,
  $depth,
  setDepth,
  $time,
  setTime,
  type FocusRef,
  type FocusStack,
} from './state';

// ── UI state (lens, layer, viewport, filter) ──────────────────────────────────
export { $activeLens, $graphLayer, $graphFit, $graphShape, $viewportMode, $graphFilter } from '../core/store';
export type { Lens } from '@senars/core';
export type { ViewportMode } from '../core/store';
export { VIEWPORT_MODES } from '../core/store';

// ── Domain: the workspace graph and its projections ──────────────────────────
export {
  applyWorkspaceOp,
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  linksTouching,
} from './domain';
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
} from './domain';
export { diffWorkspaceGraph } from './domain';
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
} from './domain';
export type {
  WorkspaceEdgeData,
  WorkspaceNodeData,
  WorkspaceProjection,
} from './domain';

// ── Backends: the reasoning engines behind one control surface ───────────────
export { narsBackend, NAL_VOCABULARY } from './backends';
export { mettaBackend, METTA_VOCABULARY } from './backends';
export { awaitControl, settleControl } from './backends';
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
} from './backends';

// ── Events ───────────────────────────────────────────────────────────────────
export { eventBus } from './events';

// ── View system: one dataset, many shapes, one host ──────────────────────────
export { ViewHost } from './view';
export { viewSource } from './view';
export { viewAdapterFor, viewAdapters } from './view';
export { artifactViewSpec, tableFromColumns } from './view';
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
} from './view';

// ── Block vocabulary: kinds, labels, payloads ────────────────────────────────
export { blockDescriptor, kindsWhere } from '../core/block-descriptors';
export { blockLabel } from '../core/block-labels';
export { payloadOf } from '../core/block-payload';
export type { BlockEntry as BlockDescriptor } from '../core/block-descriptors';
export type { BlockPayloads, TableData, CodeData, ChartData } from '../core/block-payload';

// ── Capabilities: honest gating ──────────────────────────────────────────────
export { $capabilities, capabilityGate, setCapability } from '../core/capabilities';
export type { Capability } from '../core/capabilities';

// ── Store mutations (graph patches) ──────────────────────────────────────────
export { updateEdgeData, updateNodeData } from '../core/store';

// ── Components + commands ────────────────────────────────────────────────────
export { BaseComponent } from '../core/base-component';
export { activeCommands, registerCommand } from '../core/commands';
export type { Command } from '../core/commands';
export { matchCommands } from '../core/command-match';