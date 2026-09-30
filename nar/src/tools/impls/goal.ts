import type { Term } from '../../terms';
import { readOperationTerm } from '../../terms/impls/operation-term.js';
import type { Tool, ToolContext, ToolResult } from '../types';
import { errorResult } from '../types';
import { getFixPatternMapping } from './self-concept.js';

/** Minimal manager surface needed for goal execution. */
export interface ToolExecutor {
  get(name: string): Tool | undefined;
  execute(name: string, args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult>;
}

/** Execute a tool goal from NAR (goals as ^tool_name(args) parsed to Inheritance(Product(args...), Atom('^tool'))) */
export async function executeToolGoal(
  manager: ToolExecutor,
  goalTerm: Term,
  context?: ToolContext
): Promise<ToolResult> {
  const call = readOperationTerm(goalTerm);
  if (!call) {
    return errorResult(
      'Tool goal must be an Inheritance term (AST form: ^tool(args) -> Inheritance(Product, Atom))'
    );
  }

  if (!manager.get(call.name)) {
    return errorResult(`Tool '${call.name}' not found`);
  }

  // Semantic resolution: fix_pattern_id → actual codemod strings, etc.
  const resolvedArgs = await resolveSemanticArgs(call.name, call.args);

  return manager.execute(call.name, resolvedArgs, context);
}

/** Semantic resolution: fix_pattern_id → actual codemod strings, etc. */
async function resolveSemanticArgs(
  toolName: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const resolved: Record<string, unknown> = { ...args };

  // Resolve fix_pattern concept to actual codemod pattern
  if (toolName === 'apply_fix' && args.fixPattern) {
    const mapping = getFixPatternMapping(String(args.fixPattern));
    if (mapping) {
      resolved.pattern = mapping.pattern;
      resolved.replacement = mapping.replacement;
      resolved.lang = mapping.lang ?? 'typescript';
    }
  }

  // Resolve knob concept to actual knob name
  if (toolName === 'tune_knob' && args.knob) {
    const knobMap: Record<string, string> = {
      'knob:maxDerivationsPerStep': 'maxDerivationsPerStep',
      'knob:maxDerivationDepth': 'maxDerivationDepth',
      'knob:maxRulesPerCycle': 'maxRulesPerCycle',
      'knob:callTimeoutMs': 'callTimeoutMs',
      'knob:decayRate': 'decayRate',
      'knob:cpuThrottleMs': 'cpuThrottleMs',
      'knob:maxLoops': 'maxLoops',
      'knob:activationDecayRate': 'activationDecayRate',
      'knob:rankingMaxAdmissions': 'rankingMaxAdmissions',
      'knob:rankingMinScore': 'rankingMinScore',
    };
    resolved.knob = knobMap[String(args.knob)] ?? args.knob;
  }

  // Resolve strategy concept to actual strategy name
  if (toolName === 'switch_strategy' && args.strategy) {
    const strategyMap: Record<string, string> = {
      'strategy:focused': 'focused',
      'strategy:exhaustive': 'exhaustive',
      'strategy:anytime': 'anytime',
      'strategy:sampled': 'sampled',
      'strategy:priority': 'priority',
      'strategy:novelty': 'novelty',
      'strategy:goal-biased': 'goal-biased',
      'strategy:diverse': 'diverse',
    };
    resolved.strategy = strategyMap[String(args.strategy)] ?? args.strategy;
  }

  // Resolve capability template
  if (toolName === 'scaffold_capability' && args.templateId) {
    const templateMap: Record<string, string> = {
      tool_template: 'tool_template',
      rule_template: 'rule_template',
    };
    resolved.templateId = templateMap[String(args.templateId)] ?? args.templateId;
  }

  return resolved;
}
