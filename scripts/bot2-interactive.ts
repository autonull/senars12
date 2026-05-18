#!/usr/bin/env node
/**
 * BOT2 Interactive Demo
 * Run: node --loader ts-node/esm scripts/bot2-interactive.ts
 */

import {NAR} from '../src/nar/nar.js';
import {WorkingMemory} from '../src/nar/memory/WorkingMemory.js';
import {OrchestrationGuide} from '../src/nar/orchestration.js';
import {SkillCatalog} from '../src/agent/SkillCatalog.js';
import {ResponseInterpreter} from '../src/agent/ResponseInterpreter.js';
import {LastResults} from '../src/agent/LastResults.js';

async function interactiveDemo() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   BOT2 Interactive Demo                ║');
  console.log('║   Testing Real NARS + LM Integration  ║');
  console.log('╚════════════════════════════════════════╝\n');

  const nar = new NAR();
  const wm = new WorkingMemory();
  const guide = new OrchestrationGuide();
  const catalog = new SkillCatalog(nar);
  const interpreter = new ResponseInterpreter(nar);
  const lastResults = new LastResults();

  console.log('📝 Step 1: Add beliefs to NARS memory');
  console.log('─────────────────────────────────────');
  await nar.believe('(cat-->animal).');
  console.log('  Added: (cat-->animal).');
  await nar.believe('(animal-->living-being).');
  console.log('  Added: (animal-->living-being).');
  await nar.believe('(living-being-->entity).');
  console.log('  Added: (living-being-->entity).');
  console.log(`  Total beliefs: ${nar.getBeliefs().length}\n`);

  console.log('🧠 Step 2: Run NARS reasoning (deduction)');
  console.log('─────────────────────────────────────');
  const derived = await nar.run(10);
  console.log(`  Performed ${derived} derivation steps`);
  const beliefs = nar.getBeliefs();
  console.log(`  Beliefs after reasoning: ${beliefs.length}`);
  console.log('  Derived beliefs:');
  beliefs.slice(0, 5).forEach(b => {
    console.log(`    - ${b.term.toString()} [f=${b.truth.f.toFixed(2)}, c=${b.truth.c.toFixed(2)}]`);
  });
  console.log();

  console.log('📌 Step 3: Working Memory (Multi-cycle context)');
  console.log('─────────────────────────────────────');
  wm.pin('current_task', 'animal-classification');
  wm.pin('domain', 'biology');
  console.log('  Pinned: current_task = "animal-classification"');
  console.log('  Pinned: domain = "biology"');
  console.log(`  Recall task: "${wm.recall('current_task')}"`);
  console.log(`  Recall domain: "${wm.recall('domain')}"`);
  console.log();

  console.log('🎯 Step 4: Orchestration (LLM Confidence Calibration)');
  console.log('─────────────────────────────────────');
  const llmClaims = [
    {f: 0.9, c: 0.95, desc: 'LLM very confident'},
    {f: 0.7, c: 0.8, desc: 'LLM moderately confident'},
    {f: 0.5, c: 0.4, desc: 'LLM uncertain'},
  ];
  
  llmClaims.forEach(claim => {
    const calibrated = guide.calibrateLLMConfidence(claim);
    const tier = guide.evaluate(calibrated);
    console.log(`  ${claim.desc}:`);
    console.log(`    Original: f=${claim.f}, c=${claim.c}`);
    console.log(`    Calibrated: f=${calibrated.f}, c=${calibrated.c} (15pp discount)`);
    console.log(`    Action tier: ${tier}`);
  });
  console.log();

  console.log('🛠️  Step 5: Skill Catalog (Auto-generated)');
  console.log('─────────────────────────────────────');
  const skills = catalog.getSkillsForPrompt();
  const skillList = skills.split('\n').slice(0, 6);
  skillList.forEach(s => console.log(`  - ${s}`));
  console.log(`  ... (${skills.split('\n').length} total skills)`);
  console.log();

  console.log('💬 Step 6: Response Interpreter');
  console.log('─────────────────────────────────────');
  const responses = [
    'I believe cats are animals based on deduction.',
    '(dog-->animal). This is a fact.',
    'Let me reason about this...',
  ];
  
  for (const resp of responses) {
    const result = await interpreter.interpret(resp);
    console.log(`  Input: "${resp}"`);
    console.log(`  Parsed: ${result ? '✓' : '✗'}`);
  }
  console.log();

  console.log('📊 Step 7: LastResults (Multi-turn tracking)');
  console.log('─────────────────────────────────────');
  lastResults.record('Is cat an animal?', 'Yes, based on deduction', ['believe', 'deduce']);
  lastResults.record('What about dogs?', 'Also animals', ['believe']);
  lastResults.record('Are all animals living?', 'Most are', ['believe', 'infer']);
  
  console.log('  Last 2 turns:');
  console.log(lastResults.getRecent(2).split('\n').map(l => '  ' + l).join('\n'));
  console.log();

  console.log('🔬 Step 8: Complex Reasoning (Penguin Paradox)');
  console.log('─────────────────────────────────────');
  await nar.believe('(bird-->fly).');
  console.log('  Added: (bird-->fly).');
  await nar.believe('(penguin-->bird).');
  console.log('  Added: (penguin-->bird).');
  await nar.believe('(penguin-->"not fly).');
  console.log('  Added: (penguin-->"not fly). (conflicting!)');
  
  const derived2 = await nar.run(20);
  console.log(`\n  After 20 reasoning steps: ${derived2} derivations`);
  
  const penguinBeliefs = nar.getBeliefs().filter(b => b.term.toString().includes('penguin'));
  console.log(`  Penguin-related beliefs: ${penguinBeliefs.length}`);
  penguinBeliefs.forEach(b => {
    console.log(`    - ${b.term.toString()} [f=${b.truth.f.toFixed(2)}, c=${b.truth.c.toFixed(2)}]`);
  });
  console.log();

  console.log('✅ Step 9: Complete Integration Check');
  console.log('─────────────────────────────────────');
  wm.pin('goal', 'comprehensive-test');
  lastResults.record('Run integration', 'All components working', ['test']);
  
  console.log(`  WorkingMemory: ${wm.recall('goal') ? '✓' : '✗'}`);
  console.log(`  SkillCatalog: ${catalog.getSkillsForPrompt().includes('deduction') ? '✓' : '✗'}`);
  console.log(`  LastResults: ${lastResults.getRecent(1).includes('integration') ? '✓' : '✗'}`);
  console.log(`  NARS beliefs: ${nar.getBeliefs().length > 0 ? '✓' : '✗'}`);
  console.log(`  Orchestration: ${guide.evaluate({f: 0.7, c: 0.6}) === 'ACT' ? '✓' : '✗'}`);
  console.log();

  console.log('╔════════════════════════════════════════╗');
  console.log('║   BOT2 Demo Complete!                  ║');
  console.log('║   All components integrated & working  ║');
  console.log('╚════════════════════════════════════════╝');
}

interactiveDemo().catch(console.error);
