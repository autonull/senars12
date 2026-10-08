export { Announcer } from './announcer.js';
export { BaseComponent } from './base-component.js';
export { BLOCK_KIND_LABEL } from './block-labels.js';
export { artifactViewSpec, tableFromColumns } from './artifacts.js';
export { matchCommands } from './command-match.js';
export { activeCommands, type Command, registerCommand, registeredCommands } from './commands.js';
export { eventBus } from './events.js';
export { explainModel, type ExplainLink, type ExplainModel } from './explain.js';
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
  $cognitiveMetrics,
  $config,
  $configOpen,
  $connectionState,
  $focusTerm,
  $graphEdges,
  $graphFilter,
  $graphMeta,
  $graphNodes,
  $graphShape,
  $lastSeqId,
  $lensFields,
  $lensLayout,
  $lensRegistry,
  $lensViewport,
  $lmStatus,
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
  setWorkspaceFocus,
  setWorkspaceSelection,
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
export { type Segment, segmentText, type TableData } from './segmentation.js';
export { mountWorkspaceProjection, syncWorkspaceGraph } from './workspace-bindings.js';
export {
  registerRenderer,
  rendererSupports,
  renderersForKind,
  WORKSPACE_INTERACTIONS,
  type RendererSnapshot,
  type WorkspaceContext,
  type WorkspaceInteraction,
  type WorkspaceRenderer,
  type WorkspaceRendererCaps,
  workspaceRenderer,
  workspaceRendererIds,
  workspaceRenderers,
} from './workspace-renderer.js';
