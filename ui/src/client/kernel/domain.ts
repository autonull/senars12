export {
  applyWorkspaceOp,
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  linksTouching,
} from '../core/workspace-graph';
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
} from '../core/workspace-graph';
export { diffWorkspaceGraph } from '../core/workspace-diff';
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
} from '../core/workspace-projection';
export { projectWorkspaceGraph } from '../core/graph-projection';
export type {
  WorkspaceEdgeData,
  WorkspaceNodeData,
  WorkspaceProjection,
} from '../core/graph-projection';

// Projector registry + outline
export {
  registerProjector,
  getProjector,
  projectorIds,
  getProjectors,
  resetProjectors,
  mergeProjectorFragments,
  mergeFragments,
  registerBuiltinProjectors,
  chatProjector,
  createReasoningProjector,
  cognitiveEventsProjector,
  derivationRecordsProjector,
  BUILTIN_PROJECTORS,
} from '../core/projectors';
export type {
  Projector,
  ProjectorContext,
  ProjectorEntry,
} from '../framework/projector';

export {
  outline,
  stepBlock,
  stepPage,
  pageOf,
  breadcrumb,
  navigationForKey,
  isAdmitted,
  admittedRoots,
} from '../core/outline';
export type {
  OutlineProjection,
  OutlineEntry,
} from '../core/outline';