/**
 * Self-tools NAR port — the subset of NAR that SelfToolsDeps needs.
 * Extracted to break context.ts <-> nar.ts cycle.
 */

import type { RLFPLearner } from '../../../rlfp/RLFPLearner';
import type { CognitiveController } from '../../../cognitive/impls/CognitiveController';
import type { RuleProcessor } from '../../../rules/impls/processor';
import type { ToolManager } from '../../impls/tool-registry';
import type { ApprovalService } from '../../../agent/ApprovalService';
import type { NARExecution } from '../../../nar-execution';

export interface SelfToolsNAR {
  getExecution(): NARExecution | undefined;
}

export interface SelfToolsDeps {
  workspaceRoot?: string;
  nar?: SelfToolsNAR;
  rlfpLearner?: RLFPLearner;
  cognitiveController?: CognitiveController;
  toolManager?: ToolManager;
  ruleProcessor?: RuleProcessor;
  approval?: ApprovalService;
}