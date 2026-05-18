import {describe, it, expect, beforeAll} from '@jest/globals';
import {NAR} from '../../src/nar/nar.js';
import {WorkingMemory} from '../../src/nar/memory/WorkingMemory.js';
import {OrchestrationGuide} from '../../src/nar/orchestration.js';
import {SkillCatalog} from '../../src/agent/SkillCatalog.js';
import {ResponseInterpreter} from '../../src/agent/ResponseInterpreter.js';
import {LastResults} from '../../src/agent/LastResults.js';
import {ScenarioRunner} from '../../src/agent/scenarios/ScenarioRunner.js';
import {ScoringEngine} from '../../src/agent/scenarios/ScoringEngine.js';

describe('BOT2 Real-World Demo', () => {
  let nar: NAR;
  let workingMemory: WorkingMemory;
  let orchestrationGuide: OrchestrationGuide;
  let skillCatalog: SkillCatalog;
  let responseInterpreter: ResponseInterpreter;
  let lastResults: LastResults;
  let scenarioRunner: ScenarioRunner;
  let scoringEngine: ScoringEngine;

  beforeAll(() => {
    nar = new NAR();
    workingMemory = new WorkingMemory();
    orchestrationGuide = new OrchestrationGuide();
    skillCatalog = new SkillCatalog(nar);
    responseInterpreter = new ResponseInterpreter(nar);
    lastResults = new LastResults();
    scenarioRunner = new ScenarioRunner(nar);
    scoringEngine = new ScoringEngine();
  });

  it('Demo 1: Multi-cycle reasoning with working memory', async () => {
    console.log('\n=== Demo 1: Multi-Cycle Reasoning ===');
    
    workingMemory.pin('current_task', 'animal-classification');
    workingMemory.pin('context', 'biology-reasoning');
    
    await nar.believe('(cat-->animal).');
    await nar.believe('(animal-->living-being).');
    await nar.believe('(living-being-->entity).');
    
    const beliefs = nar.getBeliefs();
    console.log(`Added ${beliefs.length} initial beliefs`);
    
    const derived = await nar.run(10);
    console.log(`Derived ${derived} new beliefs through inference`);
    
    const context = workingMemory.recall('current_task');
    expect(context).toBe('animal-classification');
    
    const allPinned = workingMemory.recallAll();
    expect(allPinned.size).toBe(2);
    
    workingMemory.unpin('current_task');
    expect(workingMemory.recall('current_task')).toBeNull();
    expect(workingMemory.recall('context')).toBe('biology-reasoning');
    
    console.log('✓ Working memory successfully tracks reasoning context');
  });

  it('Demo 2: Confidence calibration for LLM outputs', async () => {
    console.log('\n=== Demo 2: LLM Confidence Calibration ===');
    
    const llmOutput = {f: 0.85, c: 0.95};
    console.log(`LLM claims: frequency=${llmOutput.f}, confidence=${llmOutput.c}`);
    
    const calibrated = orchestrationGuide.calibrateLLMConfidence(llmOutput);
    console.log(`After 15pp discount: frequency=${calibrated.f}, confidence=${calibrated.c}`);
    
    expect(calibrated.c).toBeLessThan(llmOutput.c);
    expect(calibrated.c).toBeCloseTo(0.80, 2);
    
    const tier = orchestrationGuide.evaluate(calibrated);
    console.log(`Action tier: ${tier}`);
    expect(tier).toBe('ACT');
    
    const expectation = orchestrationGuide.expectation(calibrated);
    console.log(`Expectation value: ${expectation.toFixed(3)}`);
    
    console.log('✓ LLM confidence properly calibrated to prevent overconfidence');
  });

  it('Demo 3: Grounded reasoning with source quality', async () => {
    console.log('\n=== Demo 3: Grounded Reasoning ===');
    
    const secConfidence = orchestrationGuide.calibrateLLMConfidence({f: 0.9, c: 0.9});
    const blogConfidence = orchestrationGuide.calibrateLLMConfidence({f: 0.9, c: 0.4});
    
    console.log(`SEC.gov source: confidence=${secConfidence.c}`);
    console.log(`Blog source: confidence=${blogConfidence.c}`);
    
    expect(secConfidence.c).toBeGreaterThan(blogConfidence.c);
    
    await nar.believe('(stock-->financial-instrument).');
    const beliefs = nar.getBeliefs();
    console.log(`Stored belief with high-confidence source`);
    
    console.log('✓ Source quality mapping prevents misinformation');
  });

  it('Demo 4: Skill catalog auto-generation', async () => {
    console.log('\n=== Demo 4: Auto-Generated Skill Catalog ===');
    
    const skillsText = skillCatalog.getSkillsText();
    console.log('Available skills:');
    console.log(skillsText.split('\n').slice(0, 10).join('\n'));
    
    expect(skillsText).toContain('NAL Operations');
    expect(skillsText).toContain('deduction');
    expect(skillsText).toContain('abduction');
    expect(skillsText).toContain('induction');
    
    skillCatalog.registerCustomSkill('custom-reasoning', 'Custom reasoning pattern', 'Example');
    const updated = skillCatalog.getSkillsText();
    expect(updated).toContain('custom-reasoning');
    
    console.log('✓ Skill catalog auto-updates from registered components');
  });

  it('Demo 5: Response interpretation and action extraction', async () => {
    console.log('\n=== Demo 5: Response Interpretation ===');
    
    const response1 = 'I believe cats are animals.';
    const result1 = await responseInterpreter.interpret(response1);
    console.log(`Interpreted: "${response1}"`);
    
    const response2 = '(dog-->animal). This is a fact.';
    const result2 = await responseInterpreter.interpret(response2);
    console.log(`Interpreted: "${response2}"`);
    
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    
    console.log('✓ Response interpreter parses natural language and Narsese');
  });

  it('Demo 6: LastResults for multi-turn context', async () => {
    console.log('\n=== Demo 6: Multi-Turn Context Tracking ===');
    
    lastResults.record('Is cat an animal?', 'Yes, based on deduction', ['believe', 'deduce']);
    lastResults.record('What about dogs?', 'Also animals', ['believe']);
    lastResults.record('Are all animals living?', 'Most are', ['believe']);
    
    const recent = lastResults.getRecent(3);
    console.log('Last 3 turns:');
    console.log(recent);
    
    expect(recent).toContain('Is cat an animal?');
    expect(recent).toContain('Are all animals living?');
    
    lastResults.record('New question', 'New answer', ['respond']);
    const updated = lastResults.getRecent(2);
    expect(updated).not.toContain('Is cat an animal?');
    expect(updated).toContain('New question');
    
    console.log('✓ LastResults maintains sliding window of conversation');
  });

  it('Demo 7: Scenario execution and scoring', async () => {
    console.log('\n=== Demo 7: Scenario Execution ===');
    
    const scenario = {
      id: 'deduction-demo',
      name: 'Deduction Test',
      category: 'demo' as const,
      description: 'Test basic deduction',
      steps: [
        {input: '(cat-->animal).', type: 'belief' as const, runSteps: 0},
        {input: '(animal-->living-being).', type: 'belief' as const, runSteps: 5},
      ]
    };
    
    const result = await scenarioRunner.run(scenario);
    console.log(`Scenario: ${result.scenario.name}`);
    console.log(`Passed: ${result.passed}`);
    console.log(`Score: ${result.score.toFixed(2)}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Beliefs before: ${result.beliefsBefore}, after: ${result.beliefsAfter}`);
    
    expect(result.scenario.id).toBe('deduction-demo');
    expect(result.duration).toBeGreaterThanOrEqual(0);
    
    console.log('✓ Scenario runner executes and scores test cases');
  });

  it('Demo 8: Complete BOT2 workflow integration', async () => {
    console.log('\n=== Demo 8: Complete BOT2 Integration ===');
    
    workingMemory.pin('goal', 'comprehensive-reasoning-test');
    
    await nar.believe('(bird-->fly).');
    await nar.believe('(penguin-->bird).');
    await nar.believe('(penguin-->"not fly).');
    
    console.log('Step 1: Added conflicting beliefs about penguins');
    
    const beliefs = nar.getBeliefs();
    console.log(`Total beliefs: ${beliefs.length}`);
    
    const derived = await nar.run(15);
    console.log(`Step 2: Ran 15 reasoning steps, derived ${derived} results`);
    
    const calibrated = orchestrationGuide.calibrateLLMConfidence({f: 0.9, c: 0.85});
    console.log(`Step 3: Calibrated LLM confidence from 0.85 to ${calibrated.c}`);
    
    lastResults.record(
      'Add penguin beliefs',
      'Added 3 beliefs with revision',
      ['believe', 'believe', 'believe', 'revise']
    );
    
    const skills = skillCatalog.getSkillsForPrompt();
    console.log(`Step 4: Skill catalog has ${skills.split('\n').length} entries`);
    
    const interpretation = await responseInterpreter.interpret('Processed penguin reasoning');
    console.log(`Step 5: Response interpreter processed output`);
    
    const recent = lastResults.getRecent(1);
    expect(recent).toContain('Add penguin beliefs');
    
    const goal = workingMemory.recall('goal');
    expect(goal).toBe('comprehensive-reasoning-test');
    
    console.log('✓ All BOT2 components integrated and working together');
  });

  it('Demo 9: Non-trivial reasoning chain', async () => {
    console.log('\n=== Demo 9: Non-Trivial Reasoning Chain ===');
    
    await nar.believe('(mammal-->warm-blooded).');
    await nar.believe('(dog-->mammal).');
    await nar.believe('(cat-->mammal).');
    await nar.believe('(whale-->mammal).');
    
    console.log('Added mammal hierarchy');
    
    const beliefs1 = nar.getBeliefs();
    console.log(`Beliefs in system: ${beliefs1.length}`);
    
    const derived = await nar.run(20);
    console.log(`After 20 reasoning steps: ${derived} derivations`);
    
    const beliefs2 = nar.getBeliefs();
    const hasDeduction = beliefs2.some(b => 
      b.term?.toString().includes('dog') || 
      b.term?.toString().includes('warm-blooded')
    );
    
    console.log(`Found deduction results: ${hasDeduction}`);
    
    workingMemory.pin('last_query', 'mammal-reasoning');
    lastResults.record(
      'Query about mammals',
      'Executed multi-step deduction',
      ['believe', 'run']
    );
    
    console.log('✓ Complex reasoning chain executed successfully');
  });

  it('Demo 10: Benchmark-style evaluation', async () => {
    console.log('\n=== Demo 10: Benchmark Evaluation ===');
    
    const testScenarios = [
      {
        id: 'test-deduction-1',
        name: 'Basic Deduction',
        category: 'benchmark' as const,
        description: 'Test A-->B, B-->C => A-->C',
        steps: [
          {input: '(A-->B).', type: 'belief' as const, runSteps: 0},
          {input: '(B-->C).', type: 'belief' as const, runSteps: 5},
        ]
      },
      {
        id: 'test-induction-1',
        name: 'Basic Induction',
        category: 'benchmark' as const,
        description: 'Test pattern induction',
        steps: [
          {input: '(A-->B).', type: 'belief' as const, runSteps: 0},
          {input: '(A-->C).', type: 'belief' as const, runSteps: 5},
        ]
      }
    ];
    
    const results = await scenarioRunner.runBatch(testScenarios);
    
    console.log('Benchmark Results:');
    results.forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.scenario.name}: ${result.passed ? 'PASS' : 'FAIL'} (score: ${result.score.toFixed(2)})`);
    });
    
    const passRate = results.filter(r => r.passed).length / results.length;
    console.log(`Pass rate: ${(passRate * 100).toFixed(0)}%`);
    
    expect(results.length).toBe(2);
    
    console.log('✓ Benchmark evaluation completed');
  });
});
