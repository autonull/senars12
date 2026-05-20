import type {BotContext, LMDirective, DirectiveResult, DirectiveDef} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import type {NAR} from '../../../nar/nar.js';

const BELIEVE_PATTERN = /\[BELIEVE:\s*([^\]]+)\]/gi;
const QUESTION_PATTERN = /\[QUESTION:\s*([^\]]+)\]/gi;
const TOOL_PATTERN = /\[TOOL:\s*(\w+)\s*\(([^)]*)\)\]/gi;
const REASONING_DEPTH_PATTERN = /\[REASONING_DEPTH:\s*(\d+)\]/gi;

const BUILT_IN_PATTERNS: {re: RegExp; type: LMDirective['type']; extract: (m: RegExpMatchArray) => {name?: string; content: string}}[] = [
  {re: BELIEVE_PATTERN, type: 'believe', extract: (m) => ({content: m[1]!.trim()})},
  {re: QUESTION_PATTERN, type: 'question', extract: (m) => ({content: m[1]!.trim()})},
  {re: TOOL_PATTERN, type: 'tool_call', extract: (m) => ({name: m[1]!, content: m[2]!})},
  {re: REASONING_DEPTH_PATTERN, type: 'reasoning_depth', extract: (m) => ({content: m[1]!})},
];

export class DirectiveProcessor implements PipelineStage {
  name = 'DirectiveProcessor';
  priority = 8;
  enabled = (ctx: BotContext) =>
    ctx.capabilities.hasSeNARS &&
    !!ctx.turn.lmResponse &&
    /\[(BELIEVE|QUESTION|TOOL|REASONING_DEPTH):/.test(ctx.turn.lmResponse!);

  async execute(ctx: BotContext): Promise<void> {
    const nar = ctx.seNARS;
    if (!nar) return;

    const response = ctx.turn.lmResponse!;
    const directives = this.extractAll(response, ctx);
    if (!directives.length) return;

    const results: DirectiveResult[] = [];

    for (const d of directives) {
      ctx.events.emit('directive:found', {directive: d});
      const result = d._def?.execute
        ? {directive: d, success: true, result: await d._def.execute(nar, d.content, d.name)}
        : await this.execBuiltIn(nar, d, ctx);
      results.push(result);
      ctx.turn.actions.push({type: d.type as 'believe' | 'question' | 'tool_call' | 'goal', content: d.content, result: result.success ? String(result.result) : result.error});
      ctx.events.emit('directive:execute', {directive: d, success: result.success, result: result.result, error: result.error});

      if (d.type === 'reasoning_depth' && ctx.config.reasoning.lmDriven) {
        ctx.turn.reasoningDepthOverride = parseInt(d.content, 10);
      }

      // Tool-result-aware loop-back: trigger if tool result contains actionable data
      if (d.type === 'tool_call' && result.success) {
        const resultStr = String(result.result);
        if (resultStr && resultStr.length > 0 && !resultStr.includes('undefined')) {
          ctx.turn.needsLoopBack = true;
          ctx.turn.loopBackType = 'tool_result';
          ctx.events.emit('directive:loop-requested', {type: 'tool_result'});
        }
      }
    }

    ctx.turn.directives = directives;
    ctx.turn.directiveResults = results;
    ctx.turn.lmResponse = this.stripAll(response, ctx);

    const loopTypes = directives.filter(d => d._def?.triggersLoopBack !== false && (d.type === 'believe' || d.type === 'question'));
    if (loopTypes.length) {
      const first = loopTypes[0]!;
      ctx.turn.needsLoopBack = true;
      ctx.turn.loopBackType = first.type;
      ctx.events.emit('directive:loop-requested', {type: first.type});
    }
  }

  private extractAll(response: string, ctx: BotContext): LMDirective[] {
    const results: LMDirective[] = [];

    if (ctx.config.directives?.builtIn !== false) {
      for (const p of BUILT_IN_PATTERNS) {
        for (const m of response.matchAll(p.re)) {
          const ext = p.extract(m);
          results.push({type: p.type, name: ext.name ?? '', content: ext.content, raw: m[0]!, _def: undefined});
        }
      }
    }

    for (const def of ctx.config.directives?.custom ?? []) {
      for (const m of response.matchAll(def.pattern)) {
        const ext = def.extract(m);
        results.push({type: def.type, name: ext.name ?? '', content: ext.content, raw: m[0]!, _def: def});
      }
    }

    return results;
  }

  private async execBuiltIn(nar: NAR, d: LMDirective, ctx: BotContext): Promise<DirectiveResult> {
    try {
      switch (d.type) {
        case 'believe': {
          await nar.believe(d.content);
          const derived = await nar.run(3);
          return {directive: d, success: true, result: `${derived} derivations`, derivationSteps: derived};
        }
        case 'question': {
          await nar.question(d.content);
          const derived = await nar.run(5);
          return {directive: d, success: true, result: `${derived} derivations`, derivationSteps: derived};
        }
        case 'tool_call': {
          const tool = nar.tools.get(d.name);
          if (!tool) return {directive: d, success: false, error: `Tool not found: ${d.name}`};
          const args = d.content ? this.parseArgs(d.content) : {};
          const result = await nar.executeTool(d.name, args);
          return {directive: d, success: true, result: result.content};
        }
        case 'reasoning_depth':
          return {directive: d, success: true, result: `Depth set to ${d.content}`};
        default:
          return {directive: d, success: false, error: `Unknown directive: ${d.type}`};
      }
    } catch (e) {
      return {directive: d, success: false, error: String(e)};
    }
  }

  private stripAll(response: string, ctx: BotContext): string {
    let r = response;
    if (ctx.config.directives?.builtIn !== false) {
      r = r.replace(BELIEVE_PATTERN, '').replace(QUESTION_PATTERN, '')
           .replace(TOOL_PATTERN, '').replace(REASONING_DEPTH_PATTERN, '');
    }
    for (const def of ctx.config.directives?.custom ?? []) {
      r = r.replace(def.pattern, '');
    }
    return r.trim();
  }

  private parseArgs(s: string): Record<string, unknown> {
    if (!s.trim()) return {};
    try { return JSON.parse(`{${s}}`); } catch {
      const parts = s.split(',').map(x => x.trim());
      return parts.reduce((a, v, i) => ({...a, [`arg${i}`]: v}), {} as Record<string, unknown>);
    }
  }
}
