import { generateId } from '@senars/util/id';
import { applyFixTool } from './self/apply-fix';
import type { SelfToolsContext, SelfToolsDeps } from './self/context';
import { registerRuleTool } from './self/register-rule';
import { registerToolTool } from './self/register-tool';
import { scaffoldCapabilityTool } from './self/scaffold-capability';
import { runScenarioShadowTool, runTestsShadowTool } from './self/shadow-run';
import { switchStrategyTool } from './self/switch-strategy';
import { tuneKnobTool } from './self/tune-knob';
import { ShadowWorktreeManager } from './shadow-worktree';

export type { SelfToolsDeps } from './self/context';

/** Create self-improvement tools with shadow execution safety */
export function createSelfTools(deps: SelfToolsDeps = {}) {
  const ctx: SelfToolsContext = {
    deps,
    shadowManager: new ShadowWorktreeManager(deps.workspaceRoot || process.cwd()),
    worktreeId: generateId('fix'),
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
