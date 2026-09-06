#!/usr/bin/env tsx
/**
 * Self-Improvement Demo — Autonomous improvement loop
 * 
 * This demonstrates Phase 3.2-3.8 unified self-improvement:
 * - Self-concept vocabulary loaded
 * - Meta-rules with AIKR bounds active
 * - Homeostatic drives stimulated on events
 * - Self-tools with shadow execution available
 * - RLFP with intrinsic rewards
 * - Goal→Tool wiring for ^tool_name goals
 * - Observability emission every N cycles
 */

import { SeNARSFactory } from '../nar/src/index.js';
import { createSeNARSRegistry } from '../nar/src/lm/index.js';
import { createLMService } from '../nar/src/lm/lm-service.js';
import { initializeSelfConcept, SELF_CONCEPT_BELIEFS } from '../nar/src/tools/self-concept.js';
import { registerMetaRules, META_REASONING_BELIEFS } from '../nar/src/rules/meta-rules.js';
import { createLogger } from '../nar/src/logger.js';

const logger = createLogger({ scope: 'self-improve-demo' });

async function main() {
  logger.info('🚀 Starting Self-Improvement Demo');
  
  // Create registry and LM service
  const registry = createSeNARSRegistry();
  const lmService = createLMService();
  
  // Create NAR with self-improvement features enabled
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
  
  // Initialize self-concept vocabulary
  logger.info('📚 Loading self-concept vocabulary...');
  await initializeSelfConcept(nar);
  logger.info(`   Loaded ${SELF_CONCEPT_BELIEFS.length} self-concept beliefs`);
  
  // Initialize meta-reasoning beliefs
  logger.info('🧠 Loading meta-reasoning beliefs...');
  for (const belief of META_REASONING_BELIEFS) {
    await nar.believe(belief);
  }
  logger.info(`   Loaded ${META_REASONING_BELIEFS.length} meta-reasoning beliefs`);
  
  // Register meta-rules
  logger.info('⚙️  Registering meta-rules with AIKR bounds...');
  const processor = nar.getProcessor();
  registerMetaRules(processor.ruleIndex);
  logger.info('   Meta-rules registered');
  
  // Initialize NAR
  await nar.start();
  logger.info('✅ NAR started');
  
  // Run autonomous improvement loop
  const maxCycles = 10;
  logger.info(`\n🔄 Running autonomous improvement loop for ${maxCycles} cycles...`);
  
  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    logger.info(`\n--- Cycle ${cycle}/${maxCycles} ---`);
    
    // Run reasoning cycle
    const derived = await nar.run(1);
    logger.info(`   Derived: ${derived} tasks`);
    
    // Check drive states
    const driveManager = nar.getDriveManager();
    if (driveManager) {
      const states = driveManager.getAllStates();
      for (const ds of states) {
        logger.info(`   Drive ${ds.spec.id}: ${ds.currentIntensity.toFixed(3)}`);
      }
    }
    
    // Check for meta-goals
    const goals = nar.getGoals();
    const metaGoals = goals.filter(g => g.term.toString().startsWith('^'));
    if (metaGoals.length > 0) {
      logger.info(`   Meta-goals: ${metaGoals.map(g => g.term.toString()).join(', ')}`);
    }
    
    // Check statistics
    const stats = nar.getStatistics();
    logger.info(`   Concepts: ${stats.totalConcepts}, Tasks: ${stats.totalTasks}, Memory pressure: ${(stats.memoryPressure * 100).toFixed(1)}%`);
    
    // Small delay to observe
    await new Promise(r => setTimeout(r, 100));
  }
  
  // Final summary
  logger.info('\n📊 Final Summary');
  const stats = nar.getStatistics();
  logger.info(`   Total concepts: ${stats.totalConcepts}`);
  logger.info(`   Total tasks: ${stats.totalTasks}`);
  logger.info(`   Memory pressure: ${(stats.memoryPressure * 100).toFixed(1)}%`);
  
  const beliefs = nar.getBeliefs();
  logger.info(`   Beliefs: ${beliefs.length}`);
  
  const goals = nar.getGoals();
  logger.info(`   Goals: ${goals.length}`);
  const metaGoals = goals.filter(g => g.term.toString().startsWith('^'));
  logger.info(`   Meta-goals: ${metaGoals.length}`);
  
  // Check RLFP
  const rlfp = nar.getRLFP();
  if (rlfp) {
    logger.info(`   RLFP trajectory count: ${rlfp.trajectoryCount}`);
    const knobs = rlfp.getTunableKnobs();
    logger.info(`   Tunable knobs: ${Object.keys(knobs).length}`);
  }
  
  // Check self-analyzer
  const self = nar.getSelfAnalyzer();
  if (self) {
    const quality = await self.assessQuality();
    logger.info(`   Self-assessment quality: ${quality.overall.toFixed(2)}`);
  }
  
  await nar.stop();
  logger.info('\n✅ Self-Improvement Demo completed successfully!');
}

main().catch((err) => {
  logger.error('Demo failed', { error: err.message, stack: err.stack });
  process.exit(1);
});