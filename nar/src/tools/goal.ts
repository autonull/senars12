import type { Term } from '../terms';
import { getTermArgs, isAtomic, isCompound } from '../terms';
import { getFixPatternMapping } from './self-concept.js';
import type { Tool, ToolContext, ToolResult } from './types';
import { errorResult } from './types';

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
  // Parse AST: Inheritance(Product(args...), Atom('^toolName'))
  if (!isCompound(goalTerm) || goalTerm.kind !== 'inheritance') {
    return errorResult(
      'Tool goal must be an Inheritance term (AST form: ^tool(args) -> Inheritance(Product, Atom))'
    );
  }

  const args = getTermArgs(goalTerm);
  if (!args || args.length !== 2) {
    return errorResult('Invalid Inheritance structure for tool goal');
  }

  const subject = args[0]; // Product of arguments
  const predicate = args[1]; // Atom with ^toolName

  if (!subject || !predicate) {
    return errorResult('Invalid Inheritance structure: missing subject or predicate');
  }

  if (!isAtomic(predicate) || !predicate.symbol.startsWith('^')) {
    return errorResult('Tool goal predicate must be an Atom starting with ^');
  }

  const toolName = predicate.symbol.slice(1); // Remove ^ prefix

  // Check if tool exists
  if (!manager.get(toolName)) {
    return errorResult(`Tool '${toolName}' not found`);
  }

  // Extract arguments from Product
  const parsedArgs = extractArgsFromProduct(subject);

  // Semantic resolution: fix_pattern_id → actual codemod strings, etc.
  const resolvedArgs = await resolveSemanticArgs(toolName, parsedArgs);

  return manager.execute(toolName, resolvedArgs, context);
}

/** Extract arguments from a Product term (or single term) into key-value pairs */
function extractArgsFromProduct(subject: Term): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  // Handle Product term with multiple args
  if (isCompound(subject) && subject.kind === 'product') {
    const productArgs = getTermArgs(subject);
    if (productArgs) {
      for (let i = 0; i < productArgs.length; i++) {
        const arg = productArgs[i];
        if (arg) {
          const value = termToValue(arg);
          // If the term is an Inheritance (compact form key:value), extract as key:value
          if (isCompound(arg) && arg.kind === 'inheritance') {
            const inhArgs = getTermArgs(arg);
            if (inhArgs && inhArgs.length === 2) {
              const subj = inhArgs[0];
              const pred = inhArgs[1];
              if (subj && pred && isAtomic(subj) && isAtomic(pred)) {
                // Compact form: subject:predicate means (predicate --> subject)
                // So key = predicate.symbol, value = subject.symbol
                args[pred.symbol] = subj.symbol;
                continue;
              }
            }
          }
          args[`arg${i}`] = value;
        }
      }
    }
    return args;
  }

  // Single argument (non-Product)
  const value = termToValue(subject);
  args.arg0 = value;
  return args;
}

/** Convert a Narsese term to a JavaScript value */
function termToValue(term: Term): unknown {
  if (isAtomic(term)) {
    const symbol = term.symbol;
    // Try to parse as primitive
    if (/^\d+$/.test(symbol)) return parseInt(symbol, 10);
    if (/^\d+\.\d+$/.test(symbol)) return parseFloat(symbol);
    if (symbol === 'true') return true;
    if (symbol === 'false') return false;
    if (symbol.startsWith('"') && symbol.endsWith('"')) return symbol.slice(1, -1);
    if (symbol.startsWith("'") && symbol.endsWith("'")) return symbol.slice(1, -1);
    // Return as concept reference string
    return symbol;
  }

  // For compound terms, return string representation
  return term.toString();
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
