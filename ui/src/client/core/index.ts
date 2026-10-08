export { Announcer } from './announcer.js';
export { BaseComponent } from './base-component.js';
export { BLOCK_KIND_LABEL } from './block-labels.js';
export {
  type ArtifactKind,
  type ArtifactPayload,
  type BlockPayloads,
  type ChartData,
  type CitationData,
  type CodeData,
  type ConfigChangeData,
  type ImageData,
  type ListData,
  payloadOf,
  type PayloadOf,
  type TableData,
} from './block-payload.js';
export {
  type WorkspaceEdgeData,
  type WorkspaceNodeData,
  type WorkspaceProjection,
  projectWorkspaceGraph,
} from './graph-projection.js';
export {
  $capabilities,
  CAPABILITY_CATALOG,
  CAPABILITY_IDS,
  type Capability,
  capabilityDescriptors,
  type CapabilityDescriptor,
  capabilityGate,
  defaultCapabilities,
  setCapability,
} from './capabilities.js';
export {
  availableComposerModes,
  COMPOSER_MODE_CATALOG,
  COMPOSER_MODE_IDS,
  type ComposerMode,
  type ComposerModeDescriptor,
  composerModes,
  decomposeForMode,
  DEFAULT_COMPOSER_MODE,
  isComposerMode,
} from './composer-modes.js';
export { artifactViewSpec, tableFromColumns } from './artifacts.js';
export { matchCommands } from './command-match.js';
export { activeCommands, type Command, paletteCommands, registerCommand, registeredCommands } from './commands.js';
export { eventBus } from './events.js';
export { explainModel, type ExplainLink, type ExplainModel } from './explain.js';
export { GRAPH_LAYERS, type GraphLayer, layerVisible } from './graph-layer.js';
export {
  CONVERSATION_LAYOUT_CATALOG,
  CONVERSATION_LAYOUT_IDS,
  type ConversationLayoutDescriptor,
  type ConversationLayoutId,
  type ConversationPositions,
  conversationPositions,
  type Point,
} from './conversation-layout.js';
export {
  type ReasoningLayoutDescriptor,
  type ReasoningLayoutId,
  REASONING_LAYOUT_CATALOG,
  REASONING_LAYOUT_IDS,
  type ReasoningPositions,
  reasoningPositions,
} from './reasoning-layout.js';
export { collectSources, resolveSource, type Source } from './citations.js';
export {
  $lmProvider,
  applyLmStatus,
  type LmProviderState,
  type ProviderDescriptor,
  providerLabel,
  providerUsable,
  type ProviderKind,
  requestLmProvider,
} from './lm-provider.js';
export { refreshLmStatus, switchLmProvider } from './lm-transport.js';
export { type Neighbor, type Neighborhood, neighborhood } from './neighborhood.js';
export { FocusTrap } from './focus-trap.js';
export {
  breadcrumb,
  type Crumb,
  navigationForKey,
  parentMap,
  rootOf,
  stepBlock,
  stepPage,
} from './navigation.js';
export {
  decomposeInput,
  type InputSegment,
  isFaithfulDecomposition,
} from './input-decomposition.js';
export { type InlineToken, tokenizeInline } from './inline-text.js';
export { type OverlayEntry, OverlayManager } from './overlay-manager.js';
export { OverlayHost, type OpenOverlayOptions } from './overlay-host.js';
export {
  overlayDescriptor,
  type OverlayDescriptor,
  overlays,
  registerOverlay,
} from './overlay-registry.js';
export { type TocEntry, TOC_KINDS_TYPE, tocEntries } from './toc.js';
export {
  $activeLens,
  $activeRenderer,
  $capabilityFilter,
  $chatMessages,
  $collapsedBlocks,
  $cognitiveMetrics,
  $config,
  $connectionState,
  $focusTerm,
  $graphEdges,
  $graphFilter,
  $graphMeta,
  $graphLayer,
  $graphNodes,
  $graphShape,
  $conversationLayout,
  $lastSeqId,
  $layoutScope,
  $lensFields,
  $lensLayout,
  $lensLayer,
  $lensRegistry,
  $lensViewport,
  $nodeHistory,
  $panels,
  $selectedEdgeId,
  $selectedNodeId,
  $selectedNodeIds,
  $streamingDelta,
  $telemetry,
  $urlState,
  $view,
  $viewport,
  $viewportMode,
  $viewSelection,
  $webllmActive,
  $webllmAvailable,
  $webllmModel,
  $workingMemory,
  $workspaceGraph,
  type CognitiveMeta,
  type CognitiveMetricsData,
  evaluateLens,
  exposeTestApi,
  getActiveLensModulation,
  getItems,
  getLensIds,
  getLensSpec,
  hydrateFromUrl,
  mountTestApi,
  type PanelState,
  type RevisionEntry,
  registerLens,
  removeLens,
  setActiveLayout,
  setWorkspaceFocus,
  setWorkspaceSelection,
  setGraphLayer,
  toggleCollapsed,
  type TelemetryData,
  type TestApiStorePath,
  type UrlState,
  updateEdgeData,
  updateNodeData,
  type ViewportMode,
} from './store.js';
export { addUserMessage, applyServerMessage } from './store-bindings.js';
export { dispatchCommand } from './commands.js';
export { connect, disconnect, send } from './ws-client.js';
export {
  defineSurface,
  SurfaceComponent,
  type SurfaceDescriptor,
  type SurfaceState,
  type SurfaceTestApi,
} from './surface.js';
export {
  getSurfaces,
  registerSurface,
  surfaceFor,
  surfaceTag,
  type SurfaceBinding,
  type SurfaceSource,
} from './surface-registry.js';
export {
  generateSurfaces,
  surfaceA11y,
  surfaceDoc,
  surfaceGalleryCell,
  surfaceStory,
  type SurfaceArtifacts,
  type SurfaceA11yTarget,
  type SurfaceDoc,
  type SurfaceGalleryCell,
  type SurfaceStory,
} from './surface-codegen.js';
export {
  capabilitiesFor,
  registerViewAdapter,
  supportedShapes,
  type ViewAdapter,
  viewAdapterFor,
  viewAdapters,
} from './view-adapter.js';
export {
  datasetIsEmpty,
  formatCell,
  projectableShapes,
  projectDataset,
} from './view-projection.js';
export { type Readable, viewSource } from './view-sources.js';
export type {
  Budget,
  ColumnSpec,
  DatasetKind,
  Disclosure,
  Interaction,
  SeriesDatum,
  SeriesDataset,
  Shape,
  ShapeCaps,
  TableDataset,
  TextDataset,
  TreeNode,
  TreeDataset,
  ViewDataset,
  ViewSelection,
  ViewSource,
  ViewSpec,
} from './view-spec.js';
export { ViewHost } from './view-host.js';
export {
  applyWorkspaceOp,
  applyWorkspaceOps,
  type Artifact,
  type BlockKind,
  type BlockStatus,
  type CreatedBy,
  emptyWorkspaceGraph,
  linksTouching,
  type Ref,
  rootBlocks,
  type SemanticBlock,
  type SemanticLink,
  type SemanticLinkKind,
  type SemanticRole,
  type Uncertainty,
  type WorkspaceGraph,
  type WorkspaceOp,
} from './workspace-graph.js';
export {
  childId,
  claimId,
  linkId,
  projectChat,
  projectGraph,
  projectWorkspace,
  turnId,
  type WorkspaceFragment,
} from './workspace-projection.js';
export {
  type Segment,
  segmentText,
} from './segmentation.js';
export { mountWorkspaceProjection, syncWorkspaceGraph } from './workspace-bindings.js';
export {
  registerRenderer,
  rendererHasControl,
  rendererSupports,
  renderersForKind,
  WORKSPACE_CONTROLS,
  WORKSPACE_INTERACTIONS,
  type RendererSnapshot,
  type WorkspaceContext,
  type WorkspaceControl,
  type WorkspaceInteraction,
  type WorkspaceRenderer,
  type WorkspaceRendererCaps,
  workspaceRenderer,
  workspaceRendererIds,
  workspaceRenderers,
} from './workspace-renderer.js';
