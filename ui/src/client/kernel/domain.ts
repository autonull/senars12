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
export { projectWorkspaceGraph } from '../core/graph-projection.js';
export type {
  WorkspaceEdgeData,
  WorkspaceNodeData,
  WorkspaceProjection,
} from '../core/graph-projection.js';

// Projector registry + outline
export {
  registerProjector,
  getProjector,
  projectorIds,
  getProjectors,
  clearProjectors,
  mergeProjectorFragments,
  mergeFragments,
  registerBuiltinProjectors,
  chatProjector,
  createReasoningProjector,
  cognitiveEventsProjector,
  derivationRecordsProjector,
  BUILTIN_PROJECTORS,
} from '../core/projectors.js';
export type {
  Projector,
  ProjectorContext,
  ProjectorEntry,
} from '../framework/projector.js';

export {
  outline,
  stepBlock,
  stepPage,
  pageOf,
  breadcrumb,
  navigationForKey,
  isAdmitted,
  admittedRoots,
} from '../core/outline.js';
export type {
  OutlineProjection,
  OutlineEntry,
} from '../core/outline.js';