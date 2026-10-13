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