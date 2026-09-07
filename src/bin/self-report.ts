#!/usr/bin/env tsx
/**
 * Self-Report CLI — Pretty-print cognitive state summary
 * 
 * Usage: nar self-report
 *        pnpm exec tsx src/bin/self-report.ts
 */

import { SeNARSFactory } from '../../nar/src/index.js';
import { createSeNARSRegistry } from '../../nar/src/lm/index.js';
import { createLMService } from '../../nar/src/lm/lm-service.js';
import { initializeSelfConcept } from '../../nar/src/tools/self-concept.js';
import { registerMetaRules, initializeMetaReasoning } from '../../nar/src/rules/meta-rules.js';
import { createLogger } from '../../nar/src/logger.js';
import type { NAR } from '../../nar/src/nar.js';

const logger = createLogger({ scope: 'self-report' });

function formatDrives(drives: Record<string, number>): string {
  const lines = [];
  for (const [name, value] of Object.entries(drives)) {
    const bar = '█'.repeat(Math.round(value * 20)) + '░'.repeat(20 - Math.round(value * 20));
    lines.push(`  ${name.padEnd(12)} ${bar} ${(value * 100).toFixed(1)}%`);
  }
  return lines.join('\n');
}

function formatMetaGoals(goals: string[]): string {
  if (goals.length === 0) return '  (none)';
  return goals.map(g => `  → ${g}`).join('\n');
}

function formatToolExecutions(executions: string[]): string {
  if (executions.length === 0) return '  (none)';
  return executions.map(e => `  ⚙ ${e}`).join('\n');
}

function formatAikrPressure(pressure: 'low' | 'medium' | 'high'): string {
  const colors = { low: '🟢', medium: '🟡', high: '🔴' };
  return `${colors[pressure]} ${pressure.toUpperCase()}`;
}

async function main() {
  logger.info('📊 SeNARS Self-Report');
  logger.info('═'.repeat(50));
  
  // Create minimal NAR to query state
  const registry = createSeNARSRegistry();
  const lmService = createLMService();
  
  const nar = SeNARSFactory.createDefault({
    providerRegistry: registry,
    lmService,
    enableSelf: true,
    enableRLFP: true,
    enableTools: true,
    enableLMRules: true,
    maxConcepts: 1000,
    persistState: false,
  });
  
  await initializeSelfConcept(nar);
  await initializeMetaReasoning(nar);
  registerMetaRules(nar.getProcessor().ruleIndex);
  
  await nar.start();
  
  // Run a few cycles to generate state
  for (let i = 0; i < 5; i++) {
    await nar.run(1);
  }
  
  // Gather state manually from NAR components
  const driveManager = nar.getDriveManager();
  const rlfp = nar.getRLFP();
  const self = nar.getSelfAnalyzer();
  const stats = nar.getStatistics();
  const beliefs = nar.getBeliefs();
  const goals = nar.getGoals();
  
  // Active drives
  const activeDrives: Record<string, number> = {};
  if (driveManager) {
    for (const ds of driveManager.getAllStates()) {
      activeDrives[ds.spec.id] = ds.currentIntensity;
    }
  }
  
  // Active meta-goals (goals starting with ^)
  const activeMetaGoals = goals
    .filter(g => g.term.toString().startsWith('^'))
    .map(g => g.term.toString())
    .slice(0, 10);
  
  // AIKR pressure
  const memoryPressure = stats.memoryPressure ?? 0;
  let aikrPressure: 'low' | 'medium' | 'high' = 'low';
  if (memoryPressure > 0.8) aikrPressure = 'high';
  else if (memoryPressure > 0.5) aikrPressure = 'medium';
  
  // RLFP reward average (would need access to internal history)
  let rlfpRewardAvg = 0;
  if (rlfp) {
    // Access internal _rlfpRewardHistory if available
    const history = (rlfp as any)._rlfpRewardHistory ?? [];
    if (history.length > 0) {
      rlfpRewardAvg = history.reduce((a: number, b: number) => a + b, 0) / history.length;
    }
  }
  
  // Meta-derivation budget
  let metaDerivationBudget = 'N/A';
  const execution = nar.getExecution?.();
  if (execution) {
    const metaDerivations = (execution as any)._metaDerivationsThisStep ?? 0;
    const metaDepth = (execution as any)._metaDerivationDepth ?? 0;
    metaDerivationBudget = `${metaDerivations}/5 derivations, depth ${metaDepth}/2`;
  }
  
  // Self-assessment quality
  let selfQuality = 'N/A';
  if (self) {
    try {
      const quality = await self.assessQuality();
      selfQuality = quality.overall.toFixed(2);
    } catch {
      selfQuality = 'error';
    }
  }
  
  // Print report
  console.log('\n🧠 COGNITIVE STATE SUMMARY');
  console.log('═'.repeat(50));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Cycle Count: ${nar.getCycleCount()}`);
  
  console.log('\n📈 ACTIVE DRIVES');
  console.log('─'.repeat(50));
  console.log(formatDrives(activeDrives));
  
  console.log('\n🎯 ACTIVE META-GOALS');
  console.log('─'.repeat(50));
  console.log(formatMetaGoals(activeMetaGoals));
  
  console.log('\n⚙️  PENDING TOOL EXECUTIONS');
  console.log('─'.repeat(50));
  console.log(formatToolExecutions([]));
  
  console.log('\n📊 AIKR PRESSURE');
  console.log('─'.repeat(50));
  console.log(`  ${formatAikrPressure(aikrPressure)} (memory: ${(memoryPressure * 100).toFixed(1)}%)`);
  
  console.log('\n🎰 RLFP REWARD');
  console.log('─'.repeat(50));
  console.log(`  Average: ${rlfpRewardAvg.toFixed(3)}`);
  if (rlfp) {
    const knobs = rlfp.getTunableKnobs();
    console.log(`  Tunable Knobs: ${Object.keys(knobs).length}`);
    for (const [name, knob] of Object.entries(knobs)) {
      console.log(`    ${name}: ${knob.current} (range: ${knob.min}–${knob.max})`);
    }
  }
  
  console.log('\n💰 META-DERIVATION BUDGET');
  console.log('─'.repeat(50));
  console.log(`  ${metaDerivationBudget}`);
  
  console.log('\n🔍 SELF-ASSESSMENT');
  console.log('─'.repeat(50));
  console.log(`  Quality: ${selfQuality}`);
  
  console.log('\n📚 MEMORY STATISTICS');
  console.log('─'.repeat(50));
  console.log(`  Concepts: ${stats.totalConcepts}`);
  console.log(`  Tasks: ${stats.totalTasks}`);
  console.log(`  Beliefs: ${beliefs.length}`);
  console.log(`  Goals: ${goals.length}`);
  console.log(`  Memory Pressure: ${(memoryPressure * 100).toFixed(1)}%`);
  
  // Top beliefs by priority
  console.log('\n🏆 TOP 5 BELIEFS (by priority)');
  console.log('─'.repeat(50));
  const topBeliefs = beliefs
    .sort((a, b) => (b.concept?.priority ?? 0) - (a.concept?.priority ?? 0))
    .slice(0, 5);
  for (const b of topBeliefs) {
    const truth = b.truth ? `:${b.truth.f.toFixed(2)}:${b.truth.c.toFixed(2)}` : '';
    const pri = b.concept?.priority?.toFixed(2) ?? '?';
    console.log(`  [${pri}] ${b.term.toString()}${truth}`);
  }
  
  // Contradictions
  console.log('\n⚠️  CONTRADICTIONS');
  console.log('─'.repeat(50));
  // This would need access to conflict detection
  console.log('  (run with --full for contradiction analysis)');
  
  // Stalled goals
  console.log('\n⏸️  STALLED GOALS');
  console.log('─'.repeat(50));
  const pendingGoals = goals.filter(g => g.term.toString().startsWith('^'));
  if (pendingGoals.length === 0) {
    console.log('  (none)');
  } else {
    for (const g of pendingGoals.slice(0, 5)) {
      console.log(`  ${g.term.toString()}`);
    }
  }
  
  await nar.stop();
  console.log('\n' + '═'.repeat(50));
  console.log('✅ Self-report complete');
}

main().catch(err => {
  logger.error('Self-report failed', { error: err.message, stack: err.stack });
  process.exit(1);
});