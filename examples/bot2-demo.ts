#!/usr/bin/env node
/**
 * BOT2.md Real-World Demo
 * 
 * This script demonstrates BOT2 components working together with real NARS reasoning.
 * Run with: node examples/bot2-demo.js
 */

import {NAR} from '../src/nar/nar.js';
import {WorkingMemory} from '../src/nar/memory/WorkingMemory.js';
import {OrchestrationGuide} from '../src/nar/orchestration.js';
import {SkillCatalog} from '../src/agent/SkillCatalog.js';
import {ResponseInterpreter} from '../src/agent/ResponseInterpreter.js';
import {LastResults} from '../src/agent/LastResults.js';

async function demo() {
  console.log('=== BOT2 Real-World Demo ===\n');
  
  const nar = new NAR();
  const workingMemory = new WorkingMemory();
  const orchestrationGuide = new OrchestrationGuide();
  const skillCatalog = new SkillCatalog(nar);
  const responseInterpreter = new ResponseInterpreter(nar);
  const lastResults = new LastResults();
  
  console.log('Demo 1: Multi-Cycle Reasoning with Working Memory');
  console.log('------------------------------------------------');
  workingMemory.pin('task', 'animal-classification');
  workingMemory.pin('domain', 'biology');
  
  await nar.believe('(cat-->animal).');
  await nar.believe('(animal-->living-being).');
  await nar.believe('(living-being-->entity).');
  
  console.log(`Added 3 beliefs to NARS`);
  console.log(`Working memory: task=${workingMemory.recall('task')}, domain=${workingMemory.recall('domain')}`);
  
  const derived = await nar.run(10);
  console.log(`After 10 reasoning steps: ${derived} derivations performed`);
  
  const beliefs = nar.getBeliefs();
  console.log(`Total beliefs in system: ${beliefs.length}\n`);
  
  console.log('Demo 2: LLM Confidence Calibration');
  console.log('-----------------------------------');
  const llmOutput = {f: 0.85, c: 0.95};
  console.log(`LLM output: f=${llmOutput.f}, c=${llmOutput.c}`);
  
  const calibrated = orchestrationGuide.calibrateLLMConfidence(llmOutput);
  console.log(`After 15pp discount: f=${calibrated.f}, c=${calibrated.c}`);
  
  const tier = orchestrationGuide.evaluate(calibrated);
  console.log(`Action tier: ${tier}`);
  console.log(`Expectation: ${orchestrationGuide.expectation(calibrated).toFixed(3)}\n`);
  
  console.log('Demo 3: Skill Catalog Auto-Generation');
  console.log('------------------------------------');
  const skills = skillCatalog.getSkillsForPrompt();
  const skillList = skills.split('\n').slice(0, 8);
  skillList.forEach(s => console.log(`  - ${s}`));
  console.log(`  ... (${skills.split('\n').length} total skills)\n`);
  
  console.log('Demo 4: Response Interpretation');
  console.log('------------------------------');
  const response1 = 'I believe cats are animals based on deduction.';
  const result1 = await responseInterpreter.interpret(response1);
  console.log(`Input: "${response1}"`);
  console.log(`Interpretation: ${JSON.stringify(result1, null, 2).slice(0, 100)}...\n`);
  
  console.log('Demo 5: LastResults Tracking');
  console.log('---------------------------');
  lastResults.record('Is cat an animal?', 'Yes, based on deduction', ['believe', 'deduce']);
  lastResults.record('What about dogs?', 'Also animals', ['believe']);
  lastResults.record('Are all animals living?', 'Most are', ['believe', 'infer']);
  
  console.log('Last 2 turns:');
  console.log(lastResults.getRecent(2));
  console.log();
  
  console.log('Demo 6: Complex Reasoning Chain');
  console.log('------------------------------');
  await nar.believe('(bird-->fly).');
  await nar.believe('(penguin-->bird).');
  await nar.believe('(penguin-->"not fly).');
  
  console.log('Added conflicting beliefs about penguins');
  const beliefs2 = nar.getBeliefs();
  console.log(`Beliefs before reasoning: ${beliefs2.length}`);
  
  const derived2 = await nar.run(20);
  console.log(`After 20 reasoning steps: ${derived2} derivations`);
  
  const beliefs3 = nar.getBeliefs();
  console.log(`Final belief count: ${beliefs3.length}`);
  
  const penguinBeliefs = beliefs3.filter(b => b.term.toString().includes('penguin'));
  console.log(`Penguin-related beliefs: ${penguinBeliefs.length}`);
  
  penguinBeliefs.forEach(b => {
    console.log(`  - ${b.term.toString()} [f=${b.truth.f.toFixed(2)}, c=${b.truth.c.toFixed(2)}]`);
  });
  console.log();
  
  console.log('Demo 7: Orchestration Decision Making');
  console.log('------------------------------------');
  const testCases = [
    {f: 0.9, c: 0.8, desc: 'High confidence belief'},
    {f: 0.5, c: 0.4, desc: 'Uncertain belief'},
    {f: 0.3, c: 0.2, desc: 'Low confidence belief'},
  ];
  
  testCases.forEach(tc => {
    const tier = orchestrationGuide.evaluate(tc);
    console.log(`  ${tc.desc}: f=${tc.f}, c=${tc.c} => ${tier}`);
  });
  console.log();
  
  console.log('Demo 8: Complete Integration');
  console.log('---------------------------');
  workingMemory.pin('goal', 'comprehensive-test');
  
  lastResults.record(
    'Run comprehensive test',
    'All BOT2 components integrated',
    ['believe', 'reason', 'evaluate']
  );
  
  const context = workingMemory.recall('goal');
  const recent = lastResults.getRecent(1);
  
  console.log(`Current goal: ${context}`);
  console.log(`Last action: ${recent.split('\n')[0]}`);
  console.log(`Skills available: ${skillCatalog.getSkillsForPrompt().split('\n').length}`);
  console.log(`Beliefs in system: ${nar.getBeliefs().length}`);
  console.log();
  
  console.log('=== BOT2 Demo Complete ===');
  console.log('All components integrated and functional!');
}

demo().catch(console.error);
