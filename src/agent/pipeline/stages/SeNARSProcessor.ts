import type {BotContext, Belief, ContextFragment, DerivationResult, LMRuleDef, LMRuleConfigEntry} from '../../BotContext.js';
import {contextFragments} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import type {NAR} from '../../../nar/nar.js';
import type {LMClient} from '../../../nar/lm/types.js';
import {LMRules} from '../../../nar/lm/rules.js';
import type {Task} from '../../../nar/types/core.js';
import {TaskFormatter} from '../../../nar/utils/task-formatter.js';
import {termParser} from '../../../nar/terms/index.js';

const DEFAULT_LM_RULES: LMRuleDef[] = [
  {id: 'lm-analogical-reasoning', context: ['attention', 'relatedBeliefs', 'links'], instruction: 'Find structural similarities, not just surface overlap.'},
  {id: 'lm-hypothesis-generation', context: ['attention', 'relatedBeliefs', 'goals'], instruction: 'Generate testable hypotheses with appropriate confidence.'},
  {id: 'lm-belief-revision', context: ['relatedBeliefs', 'recentDerivations'], instruction: 'Adjust confidence based on consistency with existing beliefs.'},
  {id: 'lm-goal-decomposition', context: ['goals', 'relatedBeliefs', 'links'], instruction: 'Break into achievable subgoals given current capabilities.'},
  {id: 'lm-concept-elaboration', context: ['attention', 'relatedBeliefs', 'links', 'focus'], instruction: 'Include properties, relationships, and implications.'},
  {id: 'lm-temporal-causal', context: ['relatedBeliefs', 'links'], instruction: 'Focus on time-ordered and cause-effect link types.'},
  {id: 'lm-uncertainty-calibration', context: ['relatedBeliefs', 'memoryHealth'], instruction: 'Consider memory reliability and belief consistency.'},
  {id: 'lm-schema-induction', context: ['attention', 'relatedBeliefs', 'links'], instruction: 'Look for recurring structures across related concepts.'},
  {id: 'lm-variable-grounding', context: ['attention', 'focus'], instruction: 'Use active concepts as grounding targets.'},
  {id: 'lm-explanation-generation', context: ['relatedBeliefs', 'links', 'recentDerivations'], instruction: 'Reference supporting beliefs and derivation paths.'},
  {id: 'lm-narsese-translation', context: [], instruction: 'Use standard Narsese operators.'},
  {id: 'lm-meta-reasoning', context: ['memoryHealth', 'attention'], instruction: 'Consider cognitive state and resource allocation.'},
  {id: 'lm-interactive-clarification', context: ['relatedBeliefs', 'questions'], instruction: 'Identify ambiguities and missing information.'},
];

const TERM_RE = String.raw`(?:[A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)*)`;
const TERM_CAP_RE = String.raw`(?:[A-Z][A-Za-z_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)*)`;

const normalizeTerm = (t: string | undefined): string => (t ?? '').trim().replace(/\s+/g, '_');

const DEFAULT_NL_PARSERS = [
  {name: 'universal', match: (t: string) => new RegExp(`^all\\s+${TERM_RE}\\s+are\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^all\\s+(${TERM_RE})\\s+are\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} --> ${normalizeTerm(m[2])}>. :1.0:0.9)` : null; }},
  {name: 'existential', match: (t: string) => new RegExp(`^some\\s+${TERM_RE}\\s+are\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^some\\s+(${TERM_RE})\\s+are\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} --> [${normalizeTerm(m[2])}]>. :0.5:0.5)` : null; }},
  {name: 'property', match: (t: string) => new RegExp(`^${TERM_RE}\\s+are\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+are\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} --> [${normalizeTerm(m[2])}]>. :0.9:0.9)` : null; }},
  {name: 'instance', match: (t: string) => new RegExp(`^${TERM_CAP_RE}\\s+is\\s+a\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_CAP_RE})\\s+is\\s+a\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} --> ${normalizeTerm(m[2])}>.)` : null; }},
  {name: 'similarity', match: (t: string) => new RegExp(`^${TERM_RE}\\s+are\\s+like\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+are\\s+like\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} <-> ${normalizeTerm(m[2])}>. :0.8:0.8)` : null; }},
  {name: 'causal', match: (t: string) => new RegExp(`^${TERM_RE}\\s+causes\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+causes\\s+(${TERM_RE})`, 'i')); return m ? `((<${normalizeTerm(m[1])}> =/> <${normalizeTerm(m[2])}>). :0.8:0.8)` : null; }},
  {name: 'temporal-before', match: (t: string) => new RegExp(`^${TERM_RE}\\s+before\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+before\\s+(${TERM_RE})`, 'i')); return m ? `((<${normalizeTerm(m[1])}> ,/ <${normalizeTerm(m[2])}>). :0.9:0.9)` : null; }},
  {name: 'implication', match: (t: string) => new RegExp(`^if\\s+.+?\\s+then\\s+.+`, 'i').test(t), translate: (t: string) => { const m = t.match(/^if\s+(.+?)\s+then\s+(.+)/i); return m ? `((<${normalizeTerm(m[1])}> ==> <${normalizeTerm(m[2])}>). :0.9:0.9)` : null; }},
  {name: 'negation', match: (t: string) => new RegExp(`^${TERM_RE}\\s+is\\s+not\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+is\\s+not\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} --> [${normalizeTerm(m[2])}]>. :0.0:0.9)` : null; }},
  {name: 'is-a', match: (t: string) => new RegExp(`^${TERM_RE}\\s+is\\s+a\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+is\\s+a\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} --> ${normalizeTerm(m[2])}>.)` : null; }},
  {name: 'has', match: (t: string) => new RegExp(`^${TERM_RE}\\s+has\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+has\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} --> [has_${normalizeTerm(m[2])}]>. :0.9:0.9)` : null; }},
  {name: 'is', match: (t: string) => new RegExp(`^${TERM_RE}\\s+is\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+is\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} --> [${normalizeTerm(m[2])}]>. :0.9:0.9)` : null; }},
  {name: 'implies', match: (t: string) => new RegExp(`^${TERM_RE}\\s+(?:implies|means|leads to)\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+(?:implies|means|leads to)\\s+(${TERM_RE})`, 'i')); return m ? `((<${normalizeTerm(m[1])}> ==> <${normalizeTerm(m[2])}>).)` : null; }},
  {name: 'query-what', match: (t: string) => /^what\s+is\s+/i.test(t), translate: (t: string) => { const m = t.match(/^what\s+is\s+(.+)/i); return m ? `(<${normalizeTerm(m[1])} --> ?1>?)` : null; }},
  {name: 'query-whether', match: (t: string) => /^is\s+(.+?)\s+(?:a\s+)?(.+?)\??$/i.test(t), translate: (t: string) => { const m = t.match(/^is\s+(.+?)\s+(?:a\s+)?(.+?)\??$/i); return m ? `(<${normalizeTerm(m[1])} --> ${normalizeTerm(m[2])}>?)` : null; }},
  {name: 'query-which', match: (t: string) => /^which\s+/i.test(t), translate: (t: string) => { const m = t.match(/^which\s+(.+?)\s+are\s+(.+)/i); return m ? `(<$1 --> ${normalizeTerm(m[2])}>?)` : null; }},
  {name: 'goal', match: (t: string) => /^i\s+(?:want|need)\s+to\s+/i.test(t), translate: (t: string) => { const m = t.match(/^i\s+(?:want|need)\s+to\s+(.+)/i); return m ? `(<${normalizeTerm(m[1])} --> ?1>!)` : null; }},
];

function buildRuleContext(rule: LMRuleDef, nar: NAR, term: string, ctx?: BotContext): string {
  const parts: string[] = ['Consider the current knowledge state:'];
  for (const key of rule.context) {
    if (typeof key === 'function') {
      const s = key(nar, ctx);
      if (s) parts.push(s);
    } else {
      const fn = (contextFragments as Record<string, unknown>)[key];
      if (!fn) continue;
      const paramFn = fn as (t: string) => ContextFragment;
      const fragment = paramFn(term);
      if (fragment) {
        const s = fragment(nar, ctx);
        if (s) parts.push(s);
      }
    }
  }
  parts.push(rule.instruction);
  return parts.filter(Boolean).join('\n');
}

export class SeNARSProcessor implements PipelineStage {
  name = 'SeNARSProcessor';
  priority = 6;
  enabled = (ctx: BotContext) =>
    ctx.capabilities.hasSeNARS &&
    (ctx.turn.reasoningTriggered || ctx.turn.classification.primary === 'narsese');

  private lmRulesInitialized = false;
  private nlTranslationCache = new Map<string, string>();

  private initLMRules(nar: NAR, ctx: BotContext): void {
    if (this.lmRulesInitialized || !ctx.config.lmRules.enabled) return;
    const lmClient = nar.getLMClient?.();
    if (!lmClient) return;

    const lmRules = LMRules.createAll(lmClient);

    for (const rule of lmRules) {
      const entry = ctx.config.lmRules.rules.find(r => r.id === rule.id);
      if (entry?.enabled === false) { rule.disable(); ctx.events.emit('lm-rule:disabled', {ruleId: rule.id}); continue; }

      const ruleDef = DEFAULT_LM_RULES.find(r => r.id === rule.id);
      const fragments = entry?.context ?? ruleDef?.context ?? [];
      const instruction = entry?.instruction ?? ruleDef?.instruction ?? '';

      const originalApply = rule.apply.bind(rule);
      rule.apply = async (primary, secondary, context) => {
        const start = Date.now();
        const termStr = typeof primary === 'object' && 'toString' in primary ? primary.toString() : String(primary);
        const richContext = buildRuleContext({id: rule.id, context: fragments, instruction}, nar, termStr, ctx);
        const enhancedContext = {...context, richContext};
        try {
          const tasks = await originalApply(primary, secondary, enhancedContext);
          ctx.events.emit('lm-rule:executed', {ruleId: rule.id, durationMs: Date.now() - start, tasksGenerated: tasks.length});
          return tasks;
        } catch (error) {
          ctx.events.emit('lm-rule:failed', {ruleId: rule.id, error: String(error), durationMs: Date.now() - start});
          return [];
        }
      };
    }
    this.lmRulesInitialized = true;
  }

  async execute(ctx: BotContext): Promise<void> {
    const nar = ctx.seNARS!;
    this.initLMRules(nar, ctx);

    const text = ctx.turn.input.text.trim();
    const classification = ctx.turn.classification;
    const steps = ctx.turn.reasoningDepthOverride ?? this.adaptiveDepth(text, classification, ctx);

    const isQuery = classification.primary === 'query' || (classification.primary === 'narsese' && text.includes('?'));
    const inputTerm = this.extractInputTerm(text);
    const beforeTerms = new Set(nar.getBeliefs().map(b => b.term.toString()));

    if (ctx.turn.passCount === 1) {
      ctx.events.emit('reasoning:start', {inputType: classification.primary, steps});

      switch (classification.primary) {
        case 'narsese':
          if (text.startsWith('!')) await nar.goal(text.slice(1));
          else if (text.includes('?')) { await nar.question(text); await nar.run(steps); }
          else { await nar.believe(text); await nar.run(steps); }
          break;
        case 'goal':
          await nar.goal(text.slice(1));
          break;
        case 'query':
          await nar.question(text);
          await nar.run(steps);
          break;
        default:
          if (ctx.turn.reasoningTriggered) {
            const narseseInput = this.translateNL(text, ctx);
            if (narseseInput) await nar.believe(narseseInput);
            await nar.run(steps);
          }
          break;
      }
    } else {
      await nar.run(Math.max(1, Math.floor(steps / 2)));
    }

    const all = nar.getBeliefs();
    const genuinelyNew = all.filter(b => {
      const termStr = b.term.toString();
      return !beforeTerms.has(termStr) && termStr !== inputTerm;
    });

    const punct = (t: Task) => TaskFormatter.punct(t);
    const toBelief = (b: Task): Belief => ({term: `${b.term.toString()}${punct(b)}`, truth: b.truth ? {frequency: b.truth.f, confidence: b.truth.c} : undefined});

    const result: DerivationResult = {
      steps: genuinelyNew.length,
      beliefs: all.map(toBelief),
      newBeliefs: genuinelyNew.map(toBelief),
    };

    if (isQuery) {
      const answer = await nar.query.ask(text.replace('?', ''));
      if (answer.confidence > 0 && answer.answer) {
        ctx.turn.queryAnswer = `${answer.answer} :${answer.confidence.toFixed(2)}`;
      }
    }

    ctx.turn.reasoningResult = result;
    ctx.events.emit('reasoning:end', {steps: genuinelyNew.length, newBeliefs: result.newBeliefs});
  }

  private extractInputTerm(text: string): string | null {
    const clean = text.trim();
    if (clean.startsWith('<') && clean.endsWith('.')) return clean.slice(1, -1).trim();
    if (clean.startsWith('<') && clean.endsWith('?')) return clean.slice(1, -1).trim();
    if (clean.startsWith('<') && clean.endsWith('>')) return clean.slice(1, -1).trim();
    return clean;
  }

  private adaptiveDepth(text: string, classification: BotContext['turn']['classification'], ctx: BotContext): number {
    const base = ctx.config.reasoning.maxStepsPerTrigger ?? 3;
    const complexity = this.termComplexity(text);

    switch (classification.primary) {
      case 'query': return Math.min(base + 2, 10);
      case 'narsese': return text.includes('?') ? 5 : Math.max(1, complexity <= 2 ? 1 : base);
      case 'goal': return Math.max(1, base);
      default: return complexity <= 1 ? 1 : base;
    }
  }

  private termComplexity(text: string): number {
    const nesting = (text.match(/\(/g) ?? []).length;
    const operators = (text.match(/-->|<->|==>|<=>|&&|\|\|/g) ?? []).length;
    return nesting + operators;
  }

  private translateNL(text: string, ctx: BotContext): string | null {
    const parsers = ctx.config.nlParsers?.builtIn !== false
      ? [...DEFAULT_NL_PARSERS, ...(ctx.config.nlParsers?.custom ?? [])]
      : (ctx.config.nlParsers?.custom ?? []);
    for (const p of parsers) {
      if (p.match(text)) {
        const r = p.translate(text);
        if (r) return r;
      }
    }
    return this.translateNLWithLM(text, ctx);
  }

  // LM NL translation is async; synchronous path returns null (BOT7 §2.2)
  // For sync NL parsing, use built-in parsers only. LM fallback requires async execution.
  private translateNLWithLM(_text: string, _ctx: BotContext): string | null {
    return null;
  }

  private validateNarsese(text: string): string | null {
    const clean = text.replace(/^`+|`+$/g, '').trim();
    const match = clean.match(/^(<[^>]+>[.!?])\s*$/);
    if (!match?.[1]) return null;
    try {
      termParser.parse(match[1]);
      return match[1];
    } catch {
      return null;
    }
  }

  private toBeliefs(tasks: Task[]): Belief[] {
    return tasks.map(t => ({
      term: t.term.toString(),
      truth: t.truth ? {frequency: t.truth.f, confidence: t.truth.c} : undefined,
    }));
  }
}
