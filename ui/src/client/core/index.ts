export { generateId, makeId, truncate } from '@senars/util';
export { Announcer } from './announcer';
export { BaseComponent } from './base-component';
export { BLOCK_KINDS, BLOCK_DESCRIPTORS, blockDescriptor, type BlockEntry, kindsWhere } from './block-descriptors';
export { blockLabel } from './block-labels';
export { PANEL_KINDS, PANEL_DEFS, panelDef, type PanelEntry, panelKindsWhere } from './panel-defs';
export { RENDERER_IDS, RENDERER_DEFS, rendererDef, type RendererEntry, rendererIdsWhere } from './renderer-defs';
export { GRAPH_LAYERS, GRAPH_LAYER_DEFS, graphLayerDef, type GraphLayer, graphLayerKindsWhere, layerVisible } from './graph-layer-defs';
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
} from './block-payload';
export {
  type WorkspaceEdgeData,
  type WorkspaceNodeData,
  type WorkspaceProjection,
  projectWorkspaceGraph,
} from './graph-projection';
export {
  $capabilities,
  CAPABILITY_CATALOG,
  CAPABILITY_DEFS,
  CAPABILITY_IDS,
  type Capability,
  capabilityDescriptors,
  type CapabilityDescriptor,
  capabilityGate,
  defaultCapabilities,
  setCapability,
} from './capabilities';
export {
  availableComposerModes,
  COMPOSER_MODE_CATALOG,
  COMPOSER_MODE_DEFS,
  COMPOSER_MODE_IDS,
  type ComposerMode,
  type ComposerModeEntry,
  composerModes,
  decomposeForMode,
  DEFAULT_COMPOSER_MODE,
  isComposerMode,
} from './composer-modes';
export type {
  Contribution,
  TaggedContribution,
  BoundContribution,
  AccessibleContribution,
  GatedContribution,
} from './contribution';
export {
  createRegistry,
  createIdRegistry,
  createLabelRegistry,
  type Registry,
  type RegistryOptions,
} from './registry';
export {
  defineContribution,
  createDefineContribution,
  createDefineTagged,
  type DefineContributionOptions,
  type DescribedClass,
} from './define-contribution';
export { artifactViewSpec, tableFromColumns } from './artifacts';
export { matchCommands } from './command-match';
export {
  validateCommandArgs,
  getCommandSchema,
  getAllCommandSchemas,
  COMMAND_SCHEMAS,
  type InferCommandArgs,
} from './command-schemas';
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
} from './config-schema';
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
} from './performance-budget';
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
} from './error-taxonomy';
export { activeCommands, type Command, paletteCommands, registerCommand, registeredCommands, type CommandArgs } from './commands';
export { eventBus } from './events';
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
} from './explain';
export {
  CONVERSATION_LAYOUT_CATALOG,
  CONVERSATION_LAYOUT_DEFS,
  CONVERSATION_LAYOUT_IDS,
  conversationLayoutDef,
  type ConversationLayoutEntry,
  type ConversationLayoutId,
  conversationLayoutIdsWhere,
  type ConversationPositions,
  conversationPositions,
  type Point,
} from './conversation-layout';
export {
  type ReasoningLayoutDescriptor,
  type ReasoningLayoutId,
  REASONING_LAYOUT_CATALOG,
  REASONING_LAYOUT_DEFS,
  REASONING_LAYOUT_IDS,
  reasoningLayoutDef,
  reasoningLayoutIdsWhere,
  type ReasoningPositions,
  reasoningPositions,
} from './reasoning-layout';
export { collectSources, resolveSource, type Source } from './citations';
export {
  $lmProvider,
  applyLmStatus,
  type LmProviderState,
  type ProviderDescriptor,
  providerLabel,
  providerUsable,
  type ProviderKind,
  requestLmProvider,
} from './lm-provider';
export { refreshLmStatus, switchLmProvider } from './lm-transport';
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
} from './embedded-views';
export { type Neighbor, type Neighborhood, neighborhood } from './neighborhood';
export { narsBackend, NAL_VOCABULARY } from './nars-backend';
export { mettaBackend, METTA_VOCABULARY } from './metta-backend';
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
} from './reasoning-backend';
export { FocusTrap } from './focus-trap';
export {
  breadcrumb,
  type Crumb,
  navigationForKey,
  rootOf,
  stepBlock,
  stepPage,
} from './navigation';
export {
  decomposeInput,
  type InputSegment,
  isFaithfulDecomposition,
} from './input-decomposition';
export { type InlineToken, tokenizeInline } from './inline-text';
export { type OverlayEntry, OverlayManager, getOverlayManager, resetOverlayManager } from './overlay-manager';
export { OverlayHost, type OpenOverlayOptions } from './overlay-host';
export {
  overlayDescriptor,
  type OverlayDescriptor,
  overlays,
  registerOverlay,
} from './overlay-registry';
export { defineOverlay, type OverlayClass } from './overlay';
export {
  admittedRoots,
  foldableSections,
  isAdmitted,
  pageOf,
  type SectionNode,
  type SectionTree,
  sectionTree,
} from './sections';
export { type TocEntry, TOC_KINDS_TYPE, tocEntries } from './toc';
export {
  $activeLens,
  $activeRenderer,
  $capabilityFilter,
  $chatMessages,
  $collapsedBlocks,
  $cognitiveEvents,
  $cognitiveMetrics,
  $config,
  $configChanges,
  $connectionState,
  $focusTerm,
  $graphEdges,
  $graphFilter,
  $graphMeta,
  $graphLayer,
  $graphFit,
  $controlMode,
  $reasoningRunning,
  $runTerminations,
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
  // UI.17 focus model
  $focusStack,
  $focus,
  $aspect,
  setAspect,
  $depth,
  setDepth,
  $time,
  setTime,
  // UI.17 attention runtime
  attendFocus,
  tierOf,
  tierToZoom,
  type FocusRef,
  type FocusStack,
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
  type PanelTab,
  panelTabs,
  pushCognitiveEvents,
  clearCognitiveEvents,
  pushConfigChange,
  clearConfigChanges,
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
  togglePanel,
  type TelemetryData,
  type TestApiStorePath,
  type UrlState,
  updateEdgeData,
  updateNodeData,
  type ViewportMode,
} from './store';
export { addAgentMessage, addUserMessage, applyServerMessage } from './store-bindings';

export { connect, disconnect, send } from './ws-client';
export {
  defineSurface,
  SurfaceComponent,
  type SurfaceDescriptor,
  type SurfaceState,
  type SurfaceTestApi,
} from './surface';
export {
  getSurfaces,
  registerSurface,
  surfaceFor,
  surfaceTag,
  type SurfaceBinding,
  type SurfaceSource,
} from './surface-registry';
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
} from './surface-codegen';
export {
  capabilitiesFor,
  registerViewAdapter,
  supportedShapes,
  type ViewAdapter,
  viewAdapterFor,
  viewAdapters,
} from './view-adapter';
export {
  datasetIsEmpty,
  formatCell,
  projectableShapes,
  projectDataset,
} from './view-projection';
export { type Readable, viewSource } from './view-sources';
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
} from './view-spec';
export {
  registerShape,
  getShape,
  getShapes,
  hasShape,
  shapeIds,
  resetShapes,
  CORE_SHAPES,
  registerCoreShapes,
  type ShapeSpec,
  type RegisteredShape,
  shapesForBudget,
  shapesForInteraction,
  shapeTag,
  shapeFidelityRange,
} from './view-spec';
export { ViewHost } from './view-host';
export {
  encodeAddress,
  decodeAddress,
  buildWorkspaceAddress,
  addressEquals,
  type WorkspaceAddress,
  DEFAULT_WORKSPACE_ADDRESS,
} from './workspace-address';
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
} from './workspace-graph';
export { diffWorkspaceGraph } from './workspace-diff';
export {
  blockRefFor,
  childId,
  claimId,
  derivationsFor,
  linkId,
  linkRefFor,
  projectChat,
  projectCognitiveEvents,
  projectDerivationRecords,
  projectReasoning,
  projectWorkspace,
  resolveBlockRef,
  type WorkspaceFragment,
} from './workspace-projection';
export {
  type Segment,
  segmentText,
} from './segmentation';
export { initConfigChangeProducer, mountWorkspaceProjection, syncWorkspaceGraph } from './workspace-bindings';
export {
  validateAllContributions,
  validateContribution,
  type ValidationError,
  type ValidationResult,
} from './contribution-validator';
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
} from './workspace-renderer';
export {
  type ToolSpec,
  type PendingApproval,
  registerTool,
  getTool,
  allTools,
  executeToolCall,
  currentApproval,
  onApprovalChange,
  approveCurrent,
  rejectCurrent,
  promptUserTool,
  registerBuiltinTools,
  callTool,
} from './tool-registry';
export { OverlayHeader } from '../components/overlays/overlay-header';
