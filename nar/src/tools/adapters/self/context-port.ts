/**
 * Self-tools NAR port — the subset of NAR that SelfToolsDeps needs.
 * Extracted to break context.ts <-> nar.ts cycle.
 */

import type { RLFPLearner } from '../../../rlfp/RLFPLearner.js';
import type { CognitiveController } from '../../../cognitive/impls/CognitiveController.js';
import type { RuleProcessor } from '../../../rules/impls/processor.js';
import type { ToolManager } from '../../impls/tool-registry.js';
import type { ApprovalService } from '@senars/core';

export interface SelfToolsNAR {
  // Minimal NAR surface needed by self-tools
  // Add methods as needed by the tools
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