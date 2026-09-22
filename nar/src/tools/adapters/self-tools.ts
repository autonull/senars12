import { applyFixTool } from './self/apply-fix.js';
import type { SelfToolsContext, SelfToolsDeps } from './self/context.js';
import { registerRuleTool } from './self/register-rule.js';
import { registerToolTool } from './self/register-tool.js';
import { scaffoldCapabilityTool } from './self/scaffold-capability.js';
import { runScenarioShadowTool, runTestsShadowTool } from './self/shadow-run.js';
import { switchStrategyTool } from './self/switch-strategy.js';
import { tuneKnobTool } from './self/tune-knob.js';
import { ShadowWorktreeManager } from './shadow-worktree.js';

export type { SelfToolsDeps } from './self/context.js';

/** Create self-improvement tools with shadow execution safety */
export function createSelfTools(deps: SelfToolsDeps = {}) {
  const ctx: SelfToolsContext = {
    deps,
    shadowManager: new ShadowWorktreeManager(deps.workspaceRoot || process.cwd()),
    worktreeId: `fix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };

  return {
    register_rule: registerRuleTool(ctx),
    register_tool: registerToolTool(ctx),
    scaffold_capability: scaffoldCapabilityTool(ctx),
    apply_fix: applyFixTool(ctx),
    tune_knob: tuneKnobTool(ctx),
    switch_strategy: switchStrategyTool(ctx),
    run_tests_shadow: runTestsShadowTool(ctx),
    run_scenario_shadow: runScenarioShadowTool(ctx),
  };
}
