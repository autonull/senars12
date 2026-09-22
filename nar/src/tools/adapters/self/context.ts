import type { CognitiveController } from '../../../cognitive/controller.js';
import type { NAR } from '../../../nar.js';
import type { RLFPLearner } from '../../../rlfp/RLFPLearner.js';
import type { RuleProcessor } from '../../../rules/processor.js';
import type { ToolManager } from '../../tool-registry.js';
import type { ApprovalManager } from '../human-approval.js';
import type { ShadowWorktreeManager } from '../shadow-worktree.js';

export interface SelfToolsDeps {
  workspaceRoot?: string;
  nar?: NAR;
  rlfpLearner?: RLFPLearner;
  cognitiveController?: CognitiveController;
  toolManager?: ToolManager;
  ruleProcessor?: RuleProcessor;
  approvalManager?: ApprovalManager;
}

export interface SelfToolsContext {
  deps: SelfToolsDeps;
  shadowManager: ShadowWorktreeManager;
  worktreeId: string;
}
