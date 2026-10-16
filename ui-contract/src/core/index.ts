/**
 * Core — the neutral workspace renderer contract and view system.
 */

export {
  type Id,
  type ItemPatch,
  type Patch,
  type WorkspaceRendererCaps,
  type RendererSnapshot,
  type WorkspaceContext,
  type Projection,
  type Timeline,
  type Presence,
  type PeerPresence,
  type IntentRef,
  type RendererContext,
  type WorkspaceRenderer,
  type Cell,
  type RendererParity,
  WORKSPACE_INTERACTIONS,
  WORKSPACE_CONTROLS,
  type WorkspaceInteraction,
  type WorkspaceControl,
  registerRenderer,
  declareParity,
  rendererParity,
  rendererParityFor,
  workspaceRenderers,
  workspaceRendererIds,
  workspaceRenderer,
  renderersForKind,
  rendererSupports,
  rendererHasControl,
} from './workspace-renderer.js';

export {
  encodeAddress,
  decodeAddress,
  buildWorkspaceAddress,
  addressEquals,
  type WorkspaceAddress,
  DEFAULT_WORKSPACE_ADDRESS,
} from './workspace-address.js';

export {
  registerViewAdapter,
  capabilitiesFor,
  supportedShapes,
  type ViewAdapter,
  viewAdapterFor,
  viewAdapters,
} from './view-adapter.js';

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
} from './shape-registry.js';

export {
  type Shape,
  type Budget,
  type Disclosure,
  type Interaction,
  type ViewSpec,
  type ViewDataset,
  type DatasetKind,
  type ViewSource,
  type ViewSelection,
  type ViewStates,
  type ViewStateSpec,
  type SeriesDatum,
  type SeriesDataset,
  type ColumnSpec,
  type TableDataset,
  type TextDataset,
  type TreeNode,
  type TreeDataset,
  type CodeDataset,
  type DiffLine,
  type DiffDataset,
  type ShapeCaps,
  BUDGETS,
  DISCLOSURES,
  INTERACTIONS,
  SHAPES,
  isShape,
} from './view-spec.js';

// ViewHost stays in ui (platform-specific DOM component)

// Workspace graph types
export {
  type Ref,
  type BlockKind,
  type SemanticRole,
  type BlockStatus,
  type CreatedBy,
  type Uncertainty,
  type Artifact,
  type SemanticBlock,
  type SemanticLinkKind,
  type SemanticLink,
  type WorkspaceGraph,
  type WorkspaceOp,
  emptyWorkspaceGraph,
  applyWorkspaceOp,
  applyWorkspaceOps,
  linksTouching,
} from './workspace-graph.js';

export {
  type Neighbor,
  type Neighborhood,
  neighborhood,
} from './neighborhood.js';
export {
  createRegistry,
  createIdRegistry,
  createLabelRegistry,
  type Registry,
  type RegistryOptions,
} from './registry.js';
