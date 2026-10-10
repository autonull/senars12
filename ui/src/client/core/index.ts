export { generateId, makeId, truncate } from '@senars/util';
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
export {
  validateCommandArgs,
  getCommandSchema,
  getAllCommandSchemas,
  COMMAND_SCHEMAS,
  type InferCommandArgs,
} from './command-schemas.js';
export {
  UiConfigSchema,
  DEFAULT_UI_CONFIG,
  type UiConfig,
  type Theme,
  type Density,
  type Motion,
  type NarsConfig,
  type ProviderConfig,
  type BudgetConfig,
  type PanelConfig,
  type LayoutConfig,
  ConfigProfileSchema,
  type ConfigProfile,
  BUILTIN_PROFILES,
  loadConfig,
  saveConfig,
  loadProfiles,
  saveProfiles,
  loadActiveProfile,
  saveActiveProfile,
  applyProfile,
  exportConfig,
  importConfig,
  CONFIG_STORAGE_KEY,
  PROFILES_STORAGE_KEY,
  ACTIVE_PROFILE_KEY,
} from './config-schema.js';
export {
  type PerformanceBudget,
  DEFAULT_PERFORMANCE_BUDGET,
  type PerformanceResult,
  type PerformanceBudgetTracker,
  perfTracker,
  measured,
  batched,
  virtualize,
  decimate,
  AdjacencyIndex,
  MemoCache,
  PERF_MARKS,
  markStart,
  markEnd,
} from './performance-budget.js';
export {
  UiError,
  ConnectionError,
  ReconnectionError,
  ConfigError,
  ConfigValidationError,
  EngineError,
  BudgetExhaustedError,
  GateRejectedError,
  ProjectionError,
  GraphRenderError,
  LayoutError,
  CommandError,
  CommandValidationError,
  StorageError,
  NetworkError,
  UnknownError,
  createError,
  emitError,
  type RecoveryAction,
} from './error-taxonomy.js';
export { activeCommands, type Command, paletteCommands, registerCommand, registeredCommands, type CommandArgs } from './commands.js';
export { eventBus } from './events.js';
export {
  explain,
  type ExplainedCitation,
  type ExplainedEvent,
  type ExplainedLink,
  type ExplainLink,
  type ExplainModel,
  type ExplainSubject,
  explainEventModel,
  explainLinkModel,
  explainModel,
} from './explain.js';
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
export {
  $embeddedViews,
  contradictionTable,
  derivationTree,
  EMBEDDED_VIEW_IDS,
  EMBEDDED_VIEWS,
  embeddedDataset,
  embeddedViewsFor,
  embeddedViewsShown,
  embeddedViewMeta,
  embeddedViewSpec,
  type EmbeddedViewId,
  hasEmbeddedView,
  toggleEmbeddedView,
  topicTable,
} from './embedded-views.js';
export { type Neighbor, type Neighborhood, neighborhood } from './neighborhood.js';
export { narsBackend, NAL_VOCABULARY } from './nars-backend.js';
export { mettaBackend, METTA_VOCABULARY } from './metta-backend.js';
export {
  type BackendCaps,
  type BackendEdge,
  type BackendNode,
  type BackendSnapshot,
  type BackendVocabulary,
  type ControlResult,
  type ReasoningBackend,
  type ReasoningControl,
  type SubmitInput,
} from './reasoning-backend.js';
export { FocusTrap } from './focus-trap.js';
export {
  breadcrumb,
  type Crumb,
  navigationForKey,
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
export { type OverlayEntry, OverlayManager, getOverlayManager, resetOverlayManager } from './overlay-manager.js';
export { OverlayHost, type OpenOverlayOptions } from './overlay-host.js';
export {
  overlayDescriptor,
  type OverlayDescriptor,
  overlays,
  registerOverlay,
} from './overlay-registry.js';
export {
  admittedRoots,
  foldableSections,
  isAdmitted,
  pageOf,
  type SectionNode,
  type SectionTree,
  sectionTree,
} from './sections.js';
export { type TocEntry, TOC_KINDS_TYPE, tocEntries } from './toc.js';
export {
  $activeLens,
  $activeRenderer,
  $capabilityFilter,
  $chatMessages,
  $collapsedBlocks,
  $cognitiveEvents,
  $cognitiveMetrics,
  $config,
  $connectionState,
  $focusTerm,
  $graphEdges,
  $graphFilter,
  $graphMeta,
  $graphLayer,
  $controlMode,
  $reasoningRunning,
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
  pushCognitiveEvents,
  clearCognitiveEvents,
  type RevisionEntry,
  registerLens,
  removeLens,
  revealBlock,
  setActiveLayout,
  setActiveRenderer,
  setConversationLayout,
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
  type SemanticBlock,
  type SemanticLink,
  type SemanticLinkKind,
  type SemanticRole,
  type Uncertainty,
  type WorkspaceGraph,
  type WorkspaceOp,
} from './workspace-graph.js';
export { diffWorkspaceGraph } from './workspace-diff.js';
export {
  blockRefFor,
  childId,
  claimId,
  linkId,
  linkRefFor,
  projectChat,
  projectCognitiveEvents,
  projectDerivationRecords,
  projectReasoning,
  projectWorkspace,
  resolveBlockRef,
  type WorkspaceFragment,
} from './workspace-projection.js';
export {
  type Segment,
  segmentText,
} from './segmentation.js';
export { initConfigChangeProducer, mountWorkspaceProjection, syncWorkspaceGraph } from './workspace-bindings.js';
export {
  validateAllContributions,
  validateContribution,
  type ValidationError,
  type ValidationResult,
} from './contribution-validator.js';
export {
  registerPlugin,
  getPlugin,
  getPlugins,
  applyPlugins,
  resetPlugins,
  type PluginContribution,
} from './plugins.js';
export {
  declareParity,
  registerRenderer,
  rendererHasControl,
  rendererParity,
  rendererParityFor,
  rendererSupports,
  renderersForKind,
  WORKSPACE_CONTROLS,
  WORKSPACE_INTERACTIONS,
  type RendererParity,
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
export {
  type ToolSpec,
  registerTool,
  getTool,
  allTools,
  executeToolCall,
  setApprovalHandler,
  promptUserTool,
  registerBuiltinTools,
  callTool,
  initToolApproval,
} from './tool-registry.js';
export { OverlayHeader } from '../components/overlays/overlay-header.js';
