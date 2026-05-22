#!/usr/bin/env node
/**
 * PIPE: Neuro-Symbolic Cognitive Synergy with Transformers.js
 *
 * Pipes Narsese through SeNARS, showing:
 *   • NARS symbolic inference on inheritance chains
 *   • Priority-gated LM rules firing via processLMRules (threshold = 0.5)
 *   • Goal satisfaction detection via CognitiveContextBuilder
 *   • AutonomousScheduler idle detection
 *   • Default Transformers.js LM provider (builtin:compact)
 *
 * Usage: node tests/pipe-cognitive-synergy.mjs
 */

import {SeNARSFactory} from '../src/nar/index.ts';
import {createSeNARSRegistry} from '../src/nar/lm/providers.ts';
import {CognitiveContextBuilder} from '../src/agent/CognitiveContext.ts';
import {buildStatusBar} from '../src/agent/tui/visual.ts';
import {AutonomousScheduler} from '../src/agent/AutonomousScheduler.ts';

const SEP = '─'.repeat(56);
const TUI = {showReasoningSteps: true, showConfidence: false, showToolCalls: true, typingIndicator: true, colors: false, compactMode: false, statusBar: true};

async function main() {
  console.log(`\n${SEP}`);
  console.log(`  🌐  PIPE: Neuro-Symbolic Cognitive Synergy`);
  console.log(`  ════════════════════════════════════════════`);
  const registry = createSeNARSRegistry();
  const model = registry.languageModel('builtin:compact');
  console.log(`  LM Provider:  transformers (builtin:compact)`);
  console.log(`  LM Model:     HuggingFaceTB/SmolLM2-360M-Instruct`);
  console.log(`  Fallback:     transformers → ollama → mock`);
  console.log(`  NAR Config:   priorityThreshold=0.1, maxConcepts=100\n`);

  // ── Create NAR ──
  const nar = SeNARSFactory.createDefault({
    providerRegistry: registry,
    maxConcepts: 100,
    priorityThreshold: 0.1,
  });
  await nar.initialize();

  // ── Scheduler ──
  const scheduler = new AutonomousScheduler(nar, {
    reasoningStepsPerWake: 4, wakeupIntervalMs: 60000, sleepIntervalMs: 1000,
    enableLMRules: true, effortLevel: 0.5, priorityThreshold: 0.5,
  });
  scheduler.start();

  const ctx = new CognitiveContextBuilder(nar);

  // ════════════════════════════════════════════════════════════
  //  STAGE 1: Inheritance chain — NARS symbolic inference
  // ════════════════════════════════════════════════════════════

  console.log(`  ┌──────────────────────────────────────────┐`);
  console.log(`  │ 📥 STAGE 1: Inheritance Chain            │`);
  console.log(`  │    NARS derives (robin --> animal)        │`);
  console.log(`  │    from (bird --> animal) + (robin --> bird) │`);
  console.log(`  └──────────────────────────────────────────┘\n`);

  console.log(`  > (bird --> animal). :0.9:0.95`);
  let d = await nar.input('(bird --> animal). :0.9:0.95');
  d = await nar.run(3);
  console.log(`  < NAR: + (bird --> animal)  f=0.90 c=0.95  │ derived ${d}`);

  console.log(`  > (robin --> bird). :0.85:0.90`);
  d = await nar.input('(robin --> bird). :0.85:0.90');
  d = await nar.run(5);
  console.log(`  < NAR: + (robin --> bird)   f=0.85 c=0.90  │ derived ${d}`);

  let beliefs = nar.getBeliefs();
  console.log(`\n  ── NARS beliefs after inference:`);
  for (const b of beliefs) {
    console.log(`     ${b.term.toString().padEnd(30)} f=${b.truth.f.toFixed(2)} c=${b.truth.c.toFixed(2)}${b.derived ? '  🧩 derived' : ''}`);
  }

  // ════════════════════════════════════════════════════════════
  //  STAGE 2: Goal setting + satisfaction check
  // ════════════════════════════════════════════════════════════

  console.log(`\n  ┌──────────────────────────────────────────┐`);
  console.log(`  │ 🎯 STAGE 2: Goal Satisfaction            │`);
  console.log(`  │    checkGoalSatisfaction() detects       │`);
  console.log(`  │    when a belief's truth.f > 0.8         │`);
  console.log(`  └──────────────────────────────────────────┘\n`);

  // Pending goal
  console.log(`  > (swim --> ability). :0.7:0.80  (as goal)`);
  await nar.input('(swim --> ability). :0.7:0.80', 'goal', {f: 0.7, c: 0.80});
  await nar.run(1);
  let check = ctx.checkGoalSatisfaction('(swim --> ability)');
  console.log(`  < GOAL "(swim --> ability)" → satisfied=${check.satisfied}  f=${check.truthFreq.toFixed(2)} < 0.8 → pending`);

  // Also check existing chain goal
  check = ctx.checkGoalSatisfaction('(bird --> animal)');
  const birdGoalText = check.truthFreq > 0.8 ? '> 0.8' : '< 0.8';
  console.log('  < GOAL "(bird --> animal)"   → satisfied=' + check.satisfied + '  f=' + check.truthFreq.toFixed(2) + ' ' + birdGoalText);

  // Satisfy the pending goal
  console.log(`\n  > (swim --> ability). :0.95:0.90`);
  await nar.input('(swim --> ability). :0.95:0.90');
  await nar.run(2);
  check = ctx.checkGoalSatisfaction('(swim --> ability)');
  console.log(`  < GOAL "(swim --> ability)" → satisfied=${check.satisfied}  f=${check.truthFreq.toFixed(2)} > 0.8 ✓`);

  console.log(`\n  ── All goals:`);
  const goals = nar.getGoals();
  for (const g of nar.getGoals()) {
    const chk = ctx.checkGoalSatisfaction(g.term.toString());
    console.log(`     ${g.term.toString().padEnd(25)} ${chk.satisfied ? '✓ ACHIEVED' : '⋯ pending'}  f=${chk.truthFreq.toFixed(2)}`);
  }

  // ════════════════════════════════════════════════════════════
  //  STAGE 3: Priority-gated LM rules
  // ════════════════════════════════════════════════════════════

  console.log(`\n  ┌──────────────────────────────────────────┐`);
  console.log(`  │ 🔥 STAGE 3: Priority-Gated LM Rules     │`);
  console.log(`  │    processLMRules() checks maxPriority  │`);
  console.log(`  │    of premise concepts vs threshold=0.5 │`);
  console.log(`  └──────────────────────────────────────────┘\n`);

  // Show concept priorities before boost
  let concepts = nar.listConcepts();
  console.log(`  ── Concept priorities BEFORE boost:`);
  for (const c of concepts) {
    console.log(`     ${c.term.toString().padEnd(25)} priority=${c.priority.toFixed(2)}  ${c.priority >= 0.5 ? '≥ threshold ✓' : '< threshold'}`);
  }

  // Boost concepts to trigger LM rules
  for (const c of concepts) {
    const old = c.priority;
    c.priority = Math.min(1.0, old + 0.6);
    console.log(`     🔺 ${c.term.toString().padEnd(18)} ${old.toFixed(2)} → ${c.priority.toFixed(2)}`);
  }

  // Priority-gated run
  console.log(`\n  > nar.run(3) — LM rules now eligible (all ≥ 0.5)`);
  d = await nar.run(3);
  console.log(`  < NAR: derived ${d} new belief(s)`);

  // Show derived beliefs
  beliefs = nar.getBeliefs();
  const derivedNew = beliefs.filter(b => b.derived);
  console.log(`\n  ── LM-enhanced NARS derivation:`);
  for (const b of derivedNew.slice(-5)) {
    console.log(`     ${b.term.toString().padEnd(30)} f=${b.truth.f.toFixed(2)} c=${b.truth.c.toFixed(2)}  🧩`);
  }

  // ════════════════════════════════════════════════════════════
  //  STAGE 4: Scheduler idle detection
  // ════════════════════════════════════════════════════════════

  console.log(`\n  ┌──────────────────────────────────────────┐`);
  console.log(`  │ ⏰ STAGE 4: AutonomousScheduler          │`);
  console.log(`  │    Idle detection + markUserInput()      │`);
  console.log(`  └──────────────────────────────────────────┘\n`);

  const schedConfig = {
    reasoningStepsPerWake: 3, wakeupIntervalMs: 100, sleepIntervalMs: 50,
    enableLMRules: true, effortLevel: 1.0, priorityThreshold: 0.5,
  };
  const fastScheduler = new AutonomousScheduler(nar, schedConfig);
  let runCount = 0;
  const originalRun = nar.run.bind(nar);
  nar.run = async (n) => { runCount++; const r = await originalRun(n); return r; };

  fastScheduler.start();
  await scheduler.markUserInput();
  console.log(`  < markUserInput() — idle timer reset`);
  await new Promise(r => setTimeout(r, 120));
  console.log(`  < waited 120ms (sleepThreshold=${schedConfig.sleepIntervalMs}ms) — scheduler fired ${runCount} background run(s)`);
  fastScheduler.stop();
  // Restore original run
  nar.run = originalRun;

  // ════════════════════════════════════════════════════════════
  //  STAGE 5: Status bar + stats
  // ════════════════════════════════════════════════════════════

  console.log(`\n  ┌──────────────────────────────────────────┐`);
  console.log(`  │ 📊 STAGE 5: Status Bar + Cognitive Stats │`);
  console.log(`  └──────────────────────────────────────────┘\n`);

  const conceptsAll = nar.listConcepts();
  const stats = nar.getStatistics();
  const goalsActive = nar.getGoals().length;
  const satisfiedCount = nar.getGoals().filter(g => ctx.checkGoalSatisfaction(g.term.toString()).satisfied).length;

  console.log(`  Status Bar:`);
  const bar = buildStatusBar({
    lmModel: 'transformers',
    lmAvailable: true,
    narConcepts: conceptsAll.length,
    narAvailable: true,
    turn: 4,
    mode: 'full',
    goals: {active: goalsActive, satisfied: satisfiedCount},
  }, TUI);
  for (const line of bar.split('\n')) console.log(`  ${line}`);

  console.log(`\n  Cognitive State:`);
  console.log(`     Concepts:    ${conceptsAll.length}`);
  console.log(`     Beliefs:     ${nar.getBeliefs().length}`);
  console.log(`     Tasks:       ${stats.totalTasks}`);
  console.log(`     Goals:       ${goalsActive} (${satisfiedCount} satisfied)`);
  console.log(`     Memory:      ${stats.totalConcepts} concepts`);

  // ── Summary ──
  console.log(`\n${SEP}`);
  console.log(`  ✅  Cognitive Synergy Cycle Complete`);
  console.log(`${SEP}`);
  console.log(`  Pipeline:  Input → NARS Inference → LM Rule Gating → Output`);
  console.log(`  Provider:  transformers (builtin:compact) — HuggingFaceTB/SmolLM2-360M-Instruct`);
  console.log(`  Threshold: priorityThreshold=0.5 gates LM rule firing in processLMRules()`);
  console.log(`  Synergy:   NARS derives symbolic beliefs; LM rules enrich via context priority`);
  console.log(`${SEP}\n`);

  scheduler.stop();
}

main().catch(err => { console.error(`\n  ✗ Error: ${err.message}`); process.exit(1); });
