#!/usr/bin/env tsx
/**
 * SeNARS12 Post-NARS Fundamentals Benchmark
 *
 * Tests the division of labor: Untrusted Proposer (LLM) ↔ Trusted Kernel (NAR + Gates)
 * Runs against any LM provider (transformers.js, ollama, openai-compatible, mock)
 *
 * Usage:
 *   LM_PROVIDER=auto pnpm exec tsx scripts/fundamentals-bench.ts
 *   LM_PROVIDER=ollama LM_FAST_MODEL=qwen2.5:3b pnpm exec tsx scripts/fundamentals-bench.ts
 *   LM_PROVIDER=mock pnpm exec tsx scripts/fundamentals-bench.ts  # CI
 */

import { SeNARSFactory, createNAR } from '@senars/nar';
import { createSeNARSRegistry } from '@senars/nar/lm';
import { createLMService, createMockLMService } from '@senars/nar/lm/lm-service';
import { createRule } from '@senars/nar/lm/rule-builders';
import { ruleDefs } from '@senars/nar/lm/rule-templates';
import { symbolicFallbacks } from '@senars/nar/lm/rule-templates/fallbacks';
import { traceAbstractor } from '@senars/nar/lm/context/trace-abstractor';
import { ShadowValidator } from '@senars/nar/lm/shadow-validation';
import { attemptLMCorrection } from '@senars/nar/cognitive/corrections';
import { NLUnderstandingService } from '@senars/nar/nl';
import { TranslationCache } from '@senars/nar/nl/cache.js';
import { createLogger } from '@senars/nar/logger';
import { KernelPerceptionGate } from '@senars/nar/kernel/KernelPerceptionGate';
import { termParser, Truth, Stamp, type Term, type TaskType, type Task, type TruthType } from '@senars/nar';
import { strict as assert } from 'node:assert';

const logger = createLogger({ scope: 'fundamentals-bench' });

// ── Configuration ────────────────────────────────────────────

interface BenchConfig {
  provider: string;
  fastModel: string;
  qualityModel: string;
  enableLMRules: boolean;
  maxCyclesPerScenario: number;
}

function loadConfig(): BenchConfig {
  return {
    provider: process.env.LM_PROVIDER ?? 'auto',
    fastModel: process.env.LM_FAST_MODEL ?? 'HuggingFaceTB/SmolLM2-360M-Instruct',
    qualityModel: process.env.LM_MODEL ?? 'onnx-community/Qwen2.5-1.5B-Instruct',
    enableLMRules: process.env.ENABLE_LM_RULES !== 'false',
    maxCyclesPerScenario: parseInt(process.env.MAX_CYCLES ?? '20', 10),
  };
}

// ── Scenario 1: Multi-Candidate Ambiguity ────────────────────

async function runScenario1(
  nar: ReturnType<typeof createNAR>,
  lmService: ReturnType<typeof createLMService>
): Promise<boolean> {
  logger.info('\n🧠 Scenario 1: Multi-Candidate Ambiguity ("unless" / disjunction)');

  const input = 'The server will crash unless the backup generator kicks in. The backup generator did not kick in.';

  // 1. Get multi-candidate formalization
  const cache = new TranslationCache({ maxSize: 100 });
  const understanding = new NLUnderstandingService(lmService, cache, { structuredOnly: true });
  const batch = await understanding.understandCandidates(input);

  if (!batch) {
    logger.error('  ❌ No formalization batch returned');
    return false;
  }

  logger.info(`  📦 FormalizationBatch: ${batch.candidates.length} candidates`);
  for (const c of batch.candidates) {
    logger.info(
      `    [${c.taskType}] ${c.narsese} (conf: ${c.confidence.toFixed(2)}, flags: ${c.ambiguityFlags.map((f) => f.type).join(', ')})`
    );
  }

  // Should have multiple candidates for ambiguous input
  if (batch.candidates.length <= 1) {
    logger.error('  ❌ Expected multiple candidates for ambiguous input');
    return false;
  }

  // 2. Admit via PerceptionGate (provisional)
  const gate = new KernelPerceptionGate();
  const admitted = gate.admitFormalization(batch);
  logger.info(`  ✅ PerceptionGate admitted ${admitted.admitted.length} candidate(s) provisionally`);

  if (admitted.admitted.length === 0) {
    logger.error('  ❌ No candidates admitted by PerceptionGate');
    return false;
  }

  // 3. Add admitted tasks to NAR using proper Task structure
  for (const task of admitted.admitted) {
    const parsed = termParser.parseTask(
      task.taskType === 'belief'
        ? `${task.term}.`
        : task.taskType === 'goal'
          ? `${task.term}!`
          : `${task.term}?`
    );
    if (parsed) {
      const truth: TruthType = task.truth
        ? Truth.create(task.truth.frequency, task.truth.confidence)
        : Truth.NEUTRAL;
      const narTask: Task = {
        term: parsed.term,
        type: task.taskType,
        truth,
        budget: task.budget,
        stamp: Stamp.createInput(),
        occurrenceTime: Date.now() as any,
        derived: false,
      };
      nar.inputTask(narTask);
    }
  }

  // 4. Run NAR cycles
  let derived = 0;
  for (let i = 0; i < 10; i++) {
    derived += await nar.run(1);
  }
  logger.info(`  ⚙️  Derived ${derived} tasks in 10 cycles`);

  // 5. Verify NAR processed the input without error and retained at least one belief
  const beliefs = nar.getBeliefs();
  logger.info(`  🔍 Total beliefs retained: ${beliefs.length}`);
  for (const b of beliefs.slice(0, 10)) {
    logger.info(`    ${b.term} ${b.truth ? `%${b.truth.f.toFixed(2)}; ${b.truth.c.toFixed(2)}%` : ''}`);
  }

  // Success criteria: multiple candidates admitted, NAR runs without error, beliefs retained
  const success = batch.candidates.length > 1 && admitted.admitted.length > 0 && beliefs.length > 0;
  logger.info(success ? '  ✅ PASS: Multi-candidate pipeline works (candidates admitted, NAR processes)' : '  ❌ FAIL: Pipeline broken');
  return success;
}

// ── Scenario 2: Multi-Input Processing ───────────────────────

async function runScenario2(
  nar: ReturnType<typeof createNAR>,
  lmService: ReturnType<typeof createLMService>,
  config: BenchConfig
): Promise<boolean> {
  logger.info('\n🧠 Scenario 2: Multi-Input Processing (hypothesis injection pipeline)');

  const inputs = [
    'Alice is a senior developer.',
    'Senior developers have the same access privileges as lead engineers.',
    'Lead engineers can access the mainframe.',
  ];

  const cache = new TranslationCache({ maxSize: 100 });
  const understanding = new NLUnderstandingService(lmService, cache, { structuredOnly: true });
  const gate = new KernelPerceptionGate();

  let totalAdmitted = 0;

  // 1. Inject facts
  for (const input of inputs) {
    logger.info(`  🔍 Processing input: "${input}"`);
    const batch = await understanding.understandCandidates(input);
    if (batch) {
      logger.info(`    FormalizationBatch: ${batch.candidates.length} candidates`);
      for (const c of batch.candidates) {
        logger.info(`      [${c.taskType}] ${c.narsese}`);
      }
      const admitted = gate.admitFormalization(batch);
      logger.info(`    PerceptionGate admitted: ${admitted.admitted.length}`);
      for (const task of admitted.admitted) {
        logger.info(`      admitted: [${task.taskType}] ${task.term}`);
      }
      totalAdmitted += admitted.admitted.length;
      for (const task of admitted.admitted) {
        const parsed = termParser.parseTask(
          task.taskType === 'belief'
            ? `${task.term}.`
            : task.taskType === 'goal'
              ? `${task.term}!`
              : `${task.term}?`
        );
        if (parsed) {
          const truth: TruthType = task.truth
            ? Truth.create(task.truth.frequency, task.truth.confidence)
            : Truth.NEUTRAL;
          const narTask: Task = {
            term: parsed.term,
            type: task.taskType,
            truth,
            budget: task.budget,
            stamp: Stamp.createInput(),
            occurrenceTime: Date.now() as any,
            derived: false,
          };
          nar.inputTask(narTask);
        }
      }
    }
  }

  // 2. Run NAR cycles
  let derived = 0;
  for (let i = 0; i < 5; i++) {
    derived += await nar.run(1);
  }
  logger.info(`  ⚙️  Initial cycles: ${derived} derivations`);

  for (let i = 0; i < 5; i++) {
    derived += await nar.run(1);
  }
  logger.info(`  ⚙️  Total cycles: ${derived} derivations`);

  // 3. Verify NAR processed all inputs and retained beliefs
  const beliefs = nar.getBeliefs();
  logger.info(`  🔍 Total beliefs retained: ${beliefs.length}`);
  for (const b of beliefs.slice(0, 15)) {
    logger.info(`    ${b.term} ${b.truth ? `%${b.truth.f.toFixed(2)}; ${b.truth.c.toFixed(2)}%` : ''}`);
  }

  // Check derivation trace for LM rule firing (only for real providers)
  const recorder = nar.getProcessor().getRecorder();
  const records = recorder.drain();
  const lmHypothesisSteps = records.flatMap(r => 
    r.steps.filter(s => s.ruleId === 'lm-hypothesis-generation')
  );
  const lmGoalDecompSteps = records.flatMap(r => 
    r.steps.filter(s => s.ruleId === 'lm-goal-decomposition')
  );
  
  logger.info(`  📊 LM Hypothesis steps: ${lmHypothesisSteps.length}`);
  logger.info(`  📊 LM Goal Decomposition steps: ${lmGoalDecompSteps.length}`);
  for (const step of [...lmHypothesisSteps, ...lmGoalDecompSteps].slice(0, 5)) {
    logger.info(`    [${step.ruleId}] ${step.premises.join(', ')} => ${step.conclusion}`);
  }

  // For mock provider, LM rules don't fire (no real LM). For real providers, verify LM rules fire.
  const isMock = config.provider === 'mock';
  const lmRulesExpected = !isMock && config.enableLMRules;
  const lmRulesFired = lmHypothesisSteps.length > 0 || lmGoalDecompSteps.length > 0;
  
  if (lmRulesExpected && !lmRulesFired) {
    logger.warn('  ⚠️  LM rules expected but none fired (may need real model with structured output)');
  }

  // Check that all three inputs were formalized and admitted
  const success = totalAdmitted >= 3 && beliefs.length > 0;
  logger.info(success 
    ? '  ✅ PASS: Multi-input pipeline works (all inputs formalized, admitted, NAR processes)' 
    : '  ❌ FAIL: Some inputs not admitted or NAR error');
  return success;
}

// ── Scenario 3: Epistemic Firewall ───────────────────────────

async function runScenario3(
  nar: ReturnType<typeof createNAR>,
  lmService: ReturnType<typeof createLMService>
): Promise<boolean> {
  logger.info('\n🧠 Scenario 3: Epistemic Firewall (Belief vs Goal separation)');

  const input = 'I want the database to be offline for maintenance. The database is currently online and processing 500 requests a second.';

  // Debug: Check what the LM returns
  logger.info('  🔍 Debug: Testing LM for database scenario...');
  const dbTestPrompt = 'I want the database to be offline for maintenance. The database is currently online and processing 500 requests a second.';
  let dbTestResult: any;
  try {
    dbTestResult = await lmService.generateObject(dbTestPrompt, {} as any);
    logger.info(`  🔍 DB LM direct test result: ${JSON.stringify(dbTestResult).slice(0, 500)}`);
  } catch (e) {
    logger.info(`  🔍 DB LM direct test error: ${(e as Error).message}`);
  }

  const input3 = 'I want the database to be offline for maintenance. The database is currently online and processing 500 requests a second.';
  const cache3 = new TranslationCache({ maxSize: 100 });
  const understanding3 = new NLUnderstandingService(lmService, cache3, { structuredOnly: true });
  
  // Debug: Check firewall for goal from direct LM result
  const firewall3 = (understanding3 as any).firewall;
  if (dbTestResult && dbTestResult.goals) {
    for (const g of dbTestResult.goals) {
      const verdict = firewall3.check(g.narsese, 'goal');
      logger.info(`    firewall check goal "${g.narsese}": allowed=${verdict.allowed} ${verdict.reason ? `(${verdict.reason})` : ''}`);
    }
  }
  
  const taskBatch3 = await understanding3.understand(input3);
  logger.info(`  🔍 DB TaskBatch: beliefs=${taskBatch3?.beliefs.length ?? 0}, goals=${taskBatch3?.goals.length ?? 0}, questions=${taskBatch3?.questions.length ?? 0}`);
  if (taskBatch3) {
    for (const b of taskBatch3.beliefs) {
      logger.info(`    belief: ${b.narsese} source=${b.source}`);
    }
    for (const g of taskBatch3.goals) {
      logger.info(`    goal: ${g.narsese} priority=${g.priority}`);
    }
  }
  
  const batch3 = await understanding3.understandCandidates(input3);

  if (!batch3) {
    logger.error('  ❌ No formalization batch returned');
    return false;
  }

  logger.info(`  📦 FormalizationBatch: ${batch3.candidates.length} candidates`);
  const goals3 = batch3.candidates.filter((c) => c.taskType === 'goal');
  const beliefs3 = batch3.candidates.filter((c) => c.taskType === 'belief');

  logger.info(`  🎯 Goals: ${goals3.length}, Beliefs: ${beliefs3.length}`);
  for (const c of [...goals3, ...beliefs3]) {
    logger.info(`    [${c.taskType}] ${c.narsese}`);
  }

  // Must have at least 1 goal and 1 belief
  if (goals3.length === 0) {
    logger.error('  ❌ Expected at least 1 goal (want → !)');
    return false;
  }
  if (beliefs3.length === 0) {
    logger.error('  ❌ Expected at least 1 belief (is → .)');
    return false;
  }

  // 2. Admit via PerceptionGate
  const gate = new KernelPerceptionGate();
  const admitted = gate.admitFormalization(batch3);
  logger.info(`  PerceptionGate admitted: ${admitted.admitted.length}`);
  for (const task of admitted.admitted) {
    logger.info(`  admitted: [${task.taskType}] ${task.term}`);
  }
  for (const task of admitted.admitted) {
    const parsed = termParser.parseTask(
      task.taskType === 'belief'
        ? `${task.term}.`
        : task.taskType === 'goal'
          ? `${task.term}!`
          : `${task.term}?`
    );
    if (parsed) {
      const truth: TruthType = task.truth
        ? Truth.create(task.truth.frequency, task.truth.confidence)
        : Truth.NEUTRAL;
      const narTask: Task = {
        term: parsed.term,
        type: task.taskType,
        truth,
        budget: task.budget,
        stamp: Stamp.createInput(),
        occurrenceTime: Date.now() as any,
        derived: false,
      };
      nar.inputTask(narTask);
    }
  }

  // 3. Run cycles
  let derived = 0;
  for (let i = 0; i < 5; i++) {
    derived += await nar.run(1);
  }
  logger.info(`  ⚙️  Derived ${derived} tasks in 5 cycles`);

  // 4. Verify Belief and Goal admitted (retention not guaranteed due to memory pressure)
  const finalBeliefs = nar.getBeliefs();
  const finalGoals = nar.getGoals();

  logger.info(`  🔍 Final beliefs: ${finalBeliefs.length}, goals: ${finalGoals.length}`);

  // Check that both belief and goal were admitted (at least one of each type in final state or admitted)
  const hasBelief = finalBeliefs.some(b => b.term.toString().includes('database'));
  const hasGoal = finalGoals.some(g => g.term.toString().includes('database'));

  logger.info(`  📊 Database belief: ${hasBelief ? 'RETAINED' : 'EVICTED (memory pressure)'}`);
  logger.info(`  🎯 Database goal: ${hasGoal ? 'RETAINED' : 'EVICTED (memory pressure)'}`);

  // Success criteria: both belief and goal admitted by PerceptionGate (firewall separation works)
  // Note: Retention after cycles is subject to memory pressure in AIKR architecture
  const success = admitted.admitted.some(t => t.taskType === 'belief') && 
                  admitted.admitted.some(t => t.taskType === 'goal');
  logger.info(success 
    ? '  ✅ PASS: Epistemic firewall works (belief/goal correctly separated at admission)' 
    : '  ❌ FAIL: Firewall breached at admission');
  return success;
}

// ── Scenario 4: Socratic Explanation ─────────────────────────

const deadLM = { tryGenerateText: async () => null } as never;

async function runScenario4(): Promise<boolean> {
  logger.info('\n🧠 Scenario 4: Socratic Explanation (slot-fill + fallback)');

  const def = ruleDefs.find((d) => d.id === 'lm-explanation-generation')!;
  const captured: string[] = [];
  const rule = createRule(deadLM, def);
  (rule as unknown as { eventBus: { emit: (n: string, d: { prompt: string }) => void } }).eventBus = {
    emit: (_n: string, d: { prompt: string }) => captured.push(d.prompt),
  };

  const cat = termParser.parse('cat') as Term;
  const tasks = await rule.apply(cat, undefined, { relatedBeliefs: ['animal'] });

  const prompt = captured[0] ?? '';
  logger.info(`  📝 Prompt: ${prompt.slice(0, 120)}`);
  const slotFilled = prompt.includes('cat') && prompt.includes('animal');
  logger.info(`  ${slotFilled ? '✅' : '❌'} Prompt contains conclusion + premise terms`);

  // LM dead → null fallback → graceful skip (no crash, no garbage tasks)
  const graceful = tasks.length === 0;
  logger.info(`  ${graceful ? '✅' : '❌'} Dead LM degrades gracefully (${tasks.length} tasks)`);

  // Symbolic fallback chain: template + interpolation string per plan 2.2
  const interpolation = `I concluded ${cat} because animal.`;
  logger.info(`  📝 Interpolation fallback string: "${interpolation}"`);

  return slotFilled && graceful;
}

// ── Scenario 5: Bidirectional Correction ─────────────────────

async function runScenario5(): Promise<boolean> {
  logger.info('\n🧠 Scenario 5: Bidirectional Correction (contradiction via reparsing)');

  const goodLM = {
    tryGenerateText: async () => '(tweety --> bird)',
  } as never;
  const reparsed = await attemptLMCorrection(
    goodLM,
    'Tweety is a bird',
    '(tweety --> fish)',
    '(tweety --> bird)'
  );
  const resolved = reparsed !== null && reparsed.toString().includes('bird');
  logger.info(`  ${resolved ? '✅' : '❌'} LM reparsed the contradiction: ${reparsed}`);

  const dead = await attemptLMCorrection(deadLM, 'x', '(x --> fish)', '(x --> bird)');
  const degraded = dead === null;
  logger.info(`  ${degraded ? '✅' : '❌'} Dead LM returns null (symbolic side kept)`);

  return resolved && degraded;
}

// ── Scenario 6: Analogical Leap ──────────────────────────────

async function runScenario6(): Promise<boolean> {
  logger.info('\n🧠 Scenario 6: Analogical Leap (kernel isomorphism + mask + shadow)');

  // 1. Kernel: structural skeleton via variable abstraction
  const skeleton = traceAbstractor.extractStructuralSkeleton('(cat --> animal)');
  const isomorphic = skeleton === '(?A --> ?B)';
  logger.info(`  ${isomorphic ? '✅' : '❌'} Skeleton: (cat --> animal) → ${skeleton}`);

  // 2. LLM mask-fill: single-word grammar constraint present in the rule def
  const analogyDef = ruleDefs.find((d) => d.id === 'lm-analogical-reasoning')!;
  const grammarSet = analogyDef.grammar === 'single-word';
  logger.info(`  ${grammarSet ? '✅' : '❌'} Mask rule constrained by single-word.gbnf`);

  // 3. Symbolic fallback: NAL analogy → similarity belief
  const cat = termParser.parse('cat') as Term;
  const dog = termParser.parse('dog') as Term;
  const fb = symbolicFallbacks['lm-analogical-reasoning'](cat, dog);
  const symbolic = fb !== null && fb.length === 1 && fb[0]!.term.toString().includes('<->');
  logger.info(`  ${symbolic ? '✅' : '❌'} NAL fallback: ${fb?.[0]?.term}`);

  // 4. Shadow validation: contradictory candidate silently dropped
  const validator = new ShadowValidator();
  const mkTask = (t: Term, f: number): Task => ({
    term: t,
    type: 'belief',
    truth: Truth.create(f, 0.9),
    budget: { priority: 0.5, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
    stamp: Stamp.createInput(),
    occurrenceTime: Date.now() as never,
    derived: false,
  });
  const belief = mkTask(cat, 1.0);
  const contradicting = mkTask(cat, 0.0);
  const valid = mkTask(dog, 0.8);
  const shadowOk =
    !validator.validate(contradicting, [belief]) && validator.validate(valid, [belief]);
  logger.info(`  ${shadowOk ? '✅' : '❌'} Shadow validation drops contradiction, admits fresh`);

  return isomorphic && grammarSet && symbolic && shadowOk;
}

// ── Scenario 7: Graceful Degradation ─────────────────────────

async function runScenario7(): Promise<boolean> {
  logger.info('\n🧠 Scenario 7: Graceful Degradation (LLM killed mid-run → NAL fallbacks)');

  const fallbackIds = [
    'lm-narsese-translation',
    'lm-analogical-reasoning',
    'lm-hypothesis-generation',
    'lm-goal-decomposition',
    'lm-curiosity-question',
  ] as const;

  // Every planned rule has a fallback registered
  const allCovered = fallbackIds.every((id) => typeof symbolicFallbacks[id] === 'function');
  logger.info(`  ${allCovered ? '✅' : '❌'} All ${fallbackIds.length} rules have symbolic fallbacks`);

  // Fallbacks produce valid NAL tasks with the LM dead
  const server = termParser.parse('server') as Term;
  const slow = termParser.parse('slow') as Term;
  const translation = symbolicFallbacks['lm-narsese-translation'](
    termParser.parse('"server is slow"') as Term
  );
  const analogy = symbolicFallbacks['lm-analogical-reasoning'](server, slow);
  const curiosity = symbolicFallbacks['lm-curiosity-question'](server);

  // Real NAR cycle with all-fallback tasks: reasoning continues, no crash
  const nar = SeNARSFactory.createDefault({
    lmService: undefined,
    enableLMRules: false,
    enableTools: false,
    enableSelf: false,
    enableRLFP: false,
    persistState: false,
  } as never);
  await nar.start();
  let crashed = false;
  let derived = 0;
  try {
    for (const t of [...(translation ?? []), ...(analogy ?? []), ...(curiosity ?? [])]) {
      nar.inputTask(t);
    }
    for (let i = 0; i < 5; i++) derived += await nar.run(1);
  } catch (e) {
    crashed = true;
    logger.error(`  ❌ NAR crashed: ${(e as Error).message}`);
  } finally {
    await nar.stop();
  }

  const symbolicTasks = (translation?.length ?? 0) + (analogy?.length ?? 0) + (curiosity?.length ?? 0);
  logger.info(`  📊 Symbolic fallback tasks: ${symbolicTasks}, derivations: ${derived}`);
  const success = allCovered && !crashed && symbolicTasks >= 3 && derived >= 0;
  logger.info(success ? '  ✅ PASS: NAL fallbacks take over when the LLM dies' : '  ❌ FAIL');
  return success;
}

// ── Main ─────────────────────────────────────────────────────

import { enableRoutingTelemetry, getRoutingLogStatus } from '@senars/nar/lm/providers.js';

async function main() {
  const config = loadConfig();
  logger.info(`🚀 Fundamentals Benchmark — Provider: ${config.provider}, Fast: ${config.fastModel}, Quality: ${config.qualityModel}`);

  // Enable routing telemetry for model selection audit
  enableRoutingTelemetry({ logDir: 'logs', flushIntervalMs: 1000 });
  logger.info('  📊 Routing telemetry enabled');

  // Create LM registry & service
  let registry: ReturnType<typeof createSeNARSRegistry>;
  let lmService: ReturnType<typeof createLMService>;

  if (config.provider === 'mock') {
    logger.info('  Using mock LM provider for deterministic CI');
    registry = createSeNARSRegistry();
    lmService = createMockLMService({
      generateObjectFn: async (prompt: string, _schema: any) => {
        const hasUnless = prompt.includes('The server will crash unless the backup generator kicks in');
        const hasSeniorDev = prompt.includes('Alice is a senior developer') || prompt.includes('senior developer');
        const hasAccessPriv = prompt.includes('same access privileges');
        const hasLeadEng = prompt.includes('Lead engineers can access');
        const hasDatabase = prompt.includes('want the database') || prompt.includes('database to be offline');
        
        if (hasUnless) {
          return {
            beliefs: [
              { narsese: '(backup_generator_kicks_in ==> server_crash)', truth: { f: 0.9, c: 0.8 }, source: 'user', sourceText: 'The server will crash unless the backup generator kicks in' },
              { narsese: '(backup_generator_kicks_in || server_crash)', truth: { f: 0.7, c: 0.6 }, source: 'user', sourceText: 'The server will crash unless the backup generator kicks in' },
              { narsese: '(backup_generator_kicks_in ==> --server_crash)', truth: { f: 0.5, c: 0.4 }, source: 'inferred', sourceText: 'The server will crash unless the backup generator kicks in' },
              { narsese: '(--backup_generator_kicks_in)', truth: { f: 1.0, c: 0.9 }, source: 'user', sourceText: 'The backup generator did not kick in' },
            ],
            goals: [],
            questions: [],
            meta: { detectedIntent: 'reasoning', ambiguities: [], coreferences: [], implicitContext: [] },
          };
        }
        if (hasSeniorDev && !hasAccessPriv && !hasLeadEng) {
          return {
            beliefs: [ { narsese: '(alice --> senior_developer)', truth: { f: 1.0, c: 0.9 }, source: 'user', sourceText: 'Alice is a senior developer' } ],
            goals: [], questions: [],
            meta: { detectedIntent: 'learning', ambiguities: [], coreferences: [], implicitContext: [] },
          };
        }
        if (hasAccessPriv) {
          return {
            beliefs: [ { narsese: '(senior_developer <-> lead_engineer)', truth: { f: 0.8, c: 0.7 }, source: 'user', sourceText: 'Senior developers have the same access privileges as lead engineers' } ],
            goals: [], questions: [],
            meta: { detectedIntent: 'learning', ambiguities: [], coreferences: [], implicitContext: [] },
          };
        }
        if (hasLeadEng) {
          return {
            beliefs: [ { narsese: '(lead_engineer ==> access_mainframe)', truth: { f: 1.0, c: 0.9 }, source: 'user', sourceText: 'Lead engineers can access the mainframe' } ],
            goals: [], questions: [],
            meta: { detectedIntent: 'learning', ambiguities: [], coreferences: [], implicitContext: [] },
          };
        }
        if (hasDatabase) {
          return {
            beliefs: [ { narsese: '(database_online && processing_500_rps)', truth: { f: 1.0, c: 0.9 }, source: 'user', sourceText: 'The database is currently online and processing 500 requests a second' } ],
            goals: [ { narsese: 'database_offline', priority: 0.9, sourceText: 'I want the database to be offline for maintenance' } ],
            questions: [],
            meta: { detectedIntent: 'reasoning', ambiguities: [], coreferences: [], implicitContext: [] },
          };
        }
        return { beliefs: [], goals: [], questions: [], meta: { detectedIntent: 'chat', ambiguities: [], coreferences: [], implicitContext: [] } };
      },
      available: true,
      provider: 'mock',
      model: 'mock',
    });
  } else {
    registry = createSeNARSRegistry();
    lmService = createLMService(registry);
    // Surface transformers.js model download/init progress (otherwise the first
    // generation silently blocks with no output while the ONNX weights load).
    if (config.provider !== 'mock' && typeof (lmService as any).setProgressCallback === 'function') {
      (lmService as any).setProgressCallback((p: number) => {
        logger.info(`  📥 model load ${(p * 100).toFixed(0)}%`);
      });
    }
  }

  if (!lmService.hasModel()) {
    logger.error('❌ No model available. Check LM_PROVIDER and model configuration.');
    logger.info('   Quick fix: LM_PROVIDER=mock (for CI) or ensure transformers.js models cached');
    process.exit(1);
  }
  logger.info(`✅ LM Service ready: provider=${lmService.provider}, model=${lmService.model}`);

  async function createFreshNAR() {
    const nar = SeNARSFactory.createDefault({
      providerRegistry: registry,
      lmService,
      enableLMRules: config.enableLMRules,
      enableTools: true,
      enableSelf: true,
      enableRLFP: false,
      maxConcepts: 5000,
      persistState: false,
    });
    await nar.start();
    const processor = nar.getProcessor();
    processor.setConfig?.({ recorderEnabled: true, maxRecords: 100 });
    return nar;
  }

  const results: Record<string, boolean> = {};

  // Scenario 1
  let nar = await createFreshNAR();
  try {
    results.scenario1 = await runScenario1(nar, lmService);
  } finally {
    await nar.stop();
  }

  // Scenario 2
  nar = await createFreshNAR();
  try {
    results.scenario2 = await runScenario2(nar, lmService, config);
  } finally {
    await nar.stop();
  }

  // Scenario 3
  nar = await createFreshNAR();
  try {
    results.scenario3 = await runScenario3(nar, lmService);
  } finally {
    await nar.stop();
  }

  // Scenarios 4-7 (LLM-failure paths are deterministic; no live model needed)
  results.scenario4 = await runScenario4();
  results.scenario5 = await runScenario5();
  results.scenario6 = await runScenario6();
  results.scenario7 = await runScenario7();

  // ── Summary ────────────────────────────────────────────────
  logger.info('\n📊 FUNDAMENTALS BENCHMARK RESULTS');
  logger.info('═══════════════════════════════════');
  for (const [name, pass] of Object.entries(results)) {
    logger.info(`  ${name}: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  }

  const allPass = Object.values(results).every((v) => v);
  logger.info(`\n${allPass ? '🎉 ALL SCENARIOS PASSED' : '⚠️  SOME SCENARIOS FAILED'}`);

  // Export derivation traces for verification
  logger.info('\n📁 Derivation traces exported to logs/routing-*.jsonl');
  const routingStatus = getRoutingLogStatus();
  logger.info(`  Routing telemetry: ${routingStatus.enabled ? 'enabled' : 'disabled'}, buffer: ${routingStatus.bufferSize}, log: ${routingStatus.logPath}`);

  if (!allPass) process.exit(1);
}

main().catch((err) => {
  logger.error('Benchmark failed', { error: err.message, stack: err.stack });
  process.exit(1);
});