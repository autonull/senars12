import type {BotContext, Belief, ContextFragment, DerivationResult, LMRuleDef, LMRuleConfigEntry} from '../../BotContext.js';
import {contextFragments} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import type {NAR} from '../../../nar/nar.js';
import type {LMClient} from '../../../nar/lm/types.js';
import {LMRules} from '../../../nar/lm/rules.js';
import type {Task} from '../../../nar/types/core.js';
import {TaskFormatter} from '../../../nar/utils/task-formatter.js';
import {termParser, atom} from '../../../nar/terms/index.js';
import {NLTranslator} from '../../../nar/nl/translator.js';
import {ResultInterpreter} from '../../../nar/nl/interpreter.js';
import type {NLAnalysis, NLIntent} from '../../../nar/nl/analyzer.js';

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
  {name: 'existential', match: (t: string) => new RegExp(`^some\\s+${TERM_RE}\\s+are\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^some\\s+(${TERM_RE})\\s+are\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} --> ${normalizeTerm(m[2])}>. :0.5:0.5)` : null; }},
  {name: 'property', match: (t: string) => new RegExp(`^${TERM_RE}\\s+are\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+are\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} --> [${normalizeTerm(m[2])}]>. :0.9:0.9)` : null; }},
  {name: 'instance', match: (t: string) => new RegExp(`^${TERM_CAP_RE}\\s+is\\s+a\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_CAP_RE})\\s+is\\s+a\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} --> ${normalizeTerm(m[2])}>.)` : null; }},
  {name: 'similarity', match: (t: string) => new RegExp(`^${TERM_RE}\\s+are\\s+like\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+are\\s+like\\s+(${TERM_RE})`, 'i')); return m ? `(<${normalizeTerm(m[1])} <-> ${normalizeTerm(m[2])}>. :0.8:0.8)` : null; }},
  {name: 'causal', match: (t: string) => new RegExp(`^${TERM_RE}\\s+causes\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+causes\\s+(${TERM_RE})`, 'i')); return m ? `((<${normalizeTerm(m[1])}> =/> <${normalizeTerm(m[2])}>). :0.8:0.8)` : null; }},
  {name: 'temporal-before', match: (t: string) => new RegExp(`^${TERM_RE}\\s+before\\s+${TERM_RE}`, 'i').test(t), translate: (t: string) => { const m = t.match(new RegExp(`^(${TERM_RE})\\s+before\\s+(${TERM_RE})`, 'i')); return m ? `((<${normalizeTerm(m[1])}> ,/ <${normalizeTerm(m[2])}>). :0.9:0.9)` : null; }},
  {name: 'implication', match: (t: string) => /^if\s+.+?\s+then\s+.+/i.test(t), translate: (t: string) => { const m = t.match(/^if\s+(.+?)\s+then\s+(.+)/i); return m ? `((<${normalizeTerm(m[1])}> ==> <${normalizeTerm(m[2])}>). :0.9:0.9)` : null; }},
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
    (ctx.turn.reasoningTriggered || ctx.turn.classification.primary === 'narsese' || ctx.turn.classification.primary === 'query');

  private lmRulesInitialized = false;
  private nlTranslator: NLTranslator | null = null;
  private resultInterpreter = new ResultInterpreter();

  private getTranslator(ctx: BotContext): NLTranslator | null {
    if (!this.nlTranslator && ctx.seNARS?.getProviderRegistry?.()) {
      this.nlTranslator = new NLTranslator(ctx.seNARS.getProviderRegistry()!);
    }
    return this.nlTranslator;
  }

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

    const analysis = (ctx.turn as any).nlAnalysis as NLAnalysis | undefined;
    const text = ctx.turn.input.text.trim();
    const classification = ctx.turn.classification;
    const steps = ctx.turn.reasoningDepthOverride ?? this.adaptiveDepth(text, classification, ctx);

    const beforeTerms = new Set(nar.getBeliefs().map(b => b.term.toString()));

    if (ctx.turn.passCount === 1) {
      ctx.events.emit('reasoning:start', {inputType: classification.primary, steps});

      if (analysis && analysis.intents.length > 0) {
        await this.executeIntents(analysis.intents, nar, ctx, steps);
      } else {
        await this.executeClassification(classification, text, nar, ctx, steps);
      }
    } else {
      await nar.run(Math.max(1, Math.floor(steps / 2)));
    }

    const all = nar.getBeliefs();
    const genuinelyNew = all.filter(b => {
      const termStr = b.term.toString();
      return !beforeTerms.has(termStr);
    });

    const punct = (t: Task) => TaskFormatter.punct(t);
    const toBelief = (b: Task): Belief => ({term: `${b.term.toString()}${punct(b)}`, truth: b.truth ? {frequency: b.truth.f, confidence: b.truth.c} : undefined});

    const result: DerivationResult = {
      steps: genuinelyNew.length,
      beliefs: all.map(toBelief),
      newBeliefs: genuinelyNew.map(toBelief),
    };

    const isQuery = classification.primary === 'query' || analysis?.intents.some(i => i.type === 'query');
    if (isQuery) {
      const queryTerm = this.extractQueryTerm(text, analysis);
      const answer = await nar.query.ask(queryTerm);
      if (answer.confidence > 0 && answer.answer) {
        ctx.turn.queryAnswer = `${answer.answer} :${answer.confidence.toFixed(2)}`;
      }
    }

    ctx.turn.reasoningResult = result;

    const queryTerm = this.extractQueryTerm(text, analysis);
    ctx.turn.finalResponse = this.resultInterpreter.interpret(result, queryTerm, nar);

    ctx.events.emit('reasoning:end', {steps: genuinelyNew.length, newBeliefs: result.newBeliefs});
  }

  private async executeIntents(intents: NLIntent[], nar: NAR, ctx: BotContext, steps: number): Promise<void> {
    const sorted = [...intents].sort((a, b) => a.priority - b.priority);
    const executed = new Set<string>();

    for (const intent of sorted) {
      if (intent.dependsOn) {
        for (const dep of intent.dependsOn) {
          while (!executed.has(dep)) await new Promise(r => setTimeout(r, 10));
        }
      }
      await this.executeIntent(intent, nar, ctx, steps);
      executed.add(intent.type + '-' + intent.priority);
    }
  }

  private async executeIntent(intent: NLIntent, nar: NAR, ctx: BotContext, steps: number): Promise<void> {
    const payload = intent.payload;

    switch (intent.type) {
      case 'believe': {
        const narsese = payload.narsese as string | undefined;
        if (narsese) { await nar.believe(narsese); await nar.run(steps); }
        else if (payload.raw) {
          const translated = await this.translateNL(String(payload.raw), ctx);
          if (translated) { await nar.believe(translated); await nar.run(steps); }
        }
        break;
      }
      case 'query': {
        const narsese = payload.narsese as string | undefined;
        if (narsese) await nar.question(narsese.replace('?', ''));
        else if (payload.raw) await nar.question(String(payload.raw).replace('?', ''));
        await nar.run(steps);
        break;
      }
      case 'goal': {
        const narsese = payload.narsese as string | undefined;
        if (narsese) await nar.goal(narsese);
        else if (payload.raw) await nar.goal(String(payload.raw));
        break;
      }
      case 'focus': {
        const topic = payload.topic ?? payload.raw;
        if (topic) nar.memory.getFocus().boostTopic(String(topic), 2.0, 50);
        break;
      }
      case 'forget': {
        const pattern = payload.pattern ?? payload.raw;
        if (pattern) this.forgetMatching(nar, String(pattern));
        break;
      }
      case 'explain': {
        const term = payload.term ?? payload.raw;
        if (term) {
          const termObj = atom(String(term));
          const concept = nar.getConcept(termObj);
          const topBelief = concept?.beliefBag.peek();
          if (topBelief) {
            ctx.turn.finalResponse = `Explanation for "${term}": based on ${topBelief.term.toString()}`;
          } else {
            ctx.turn.finalResponse = `No belief found to explain for "${term}".`;
          }
        }
        break;
      }
      case 'counterfactual': {
        const term = payload.term ?? payload.raw;
        if (term) {
          const {runCounterfactual} = await import('../../../nar/cognitive/Observer.js');
          ctx.turn.finalResponse = await runCounterfactual(String(term), true, nar, 5);
        }
        break;
      }
      case 'discover': {
        const terms = payload.terms ?? [payload.raw];
        if (terms) this.discoverRelations(nar, Array.isArray(terms) ? terms : [String(terms)]);
        break;
      }
      case 'save':
      case 'recall':
        ctx.turn.finalResponse = 'Episodic memory not available in this context.';
        break;
    }
  }

  private async executeClassification(classification: BotContext['turn']['classification'], text: string, nar: NAR, ctx: BotContext, steps: number): Promise<void> {
    switch (classification.primary) {
      case 'narsese':
        if (text.startsWith('!')) await nar.goal(text.slice(1));
        else if (text.includes('?')) { await nar.question(text); await nar.run(steps); }
        else { await nar.believe(text); await nar.run(steps); }
        break;
      case 'goal':
        await nar.goal(text.startsWith('!') ? text.slice(1) : text);
        break;
      case 'query':
        await nar.question(text.replace('?', ''));
        await nar.run(steps);
        break;
      default:
        if (ctx.turn.reasoningTriggered) {
          const narseseInput = await this.translateNL(text, ctx);
          if (narseseInput) await nar.believe(narseseInput);
          await nar.run(steps);
        }
        break;
    }
  }

  private async translateNL(text: string, ctx: BotContext): Promise<string | null> {
    const parsers = ctx.config.nlParsers?.builtIn !== false
      ? [...DEFAULT_NL_PARSERS, ...(ctx.config.nlParsers?.custom ?? [])]
      : (ctx.config.nlParsers?.custom ?? []);
    for (const p of parsers) {
      if (p.match(text)) {
        const r = p.translate(text);
        if (r) return r;
      }
    }

    const translator = this.getTranslator(ctx);
    if (translator) {
      const result = await translator.translate(text, {input: ctx.turn.input.text});
      if (result) {
        if (typeof result === 'string') return result;
        if (result.beliefs.length > 0) return result.beliefs[0]!.narsese;
      }
    }
    return null;
  }

  private forgetMatching(nar: NAR, pattern: string): void {
    for (const concept of nar.listConcepts()) {
      if (concept.term.toString().toLowerCase().includes(pattern.toLowerCase())) {
        nar.memory.removeConcept(concept.term);
      }
    }
  }

  private discoverRelations(nar: NAR, terms: string[]): void {
    if (terms.length < 2) return;
    const linkManager = nar.memory.getLinkManager();
    for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        const c1 = nar.getConcept(atom(terms[i]!));
        const c2 = nar.getConcept(atom(terms[j]!));
        if (c1 && c2 && !linkManager.getLinks(c1.term).some(l => l.targetTerm.toString() === c2.term.toString())) {
          linkManager.addLink(c1.term, c2.term, {type: 'semantic', priority: 0.5});
        }
      }
    }
  }

  private extractQueryTerm(text: string, analysis?: NLAnalysis): string {
    if (analysis?.concepts.length) return analysis.concepts[0]!;
    const clean = text.replace('?', '').trim();
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
}
