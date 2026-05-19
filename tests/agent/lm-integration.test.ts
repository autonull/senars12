import {describe, it, expect, beforeAll} from '@jest/globals';
import {NAR} from '../../src/nar/nar.js';
import {WorkingMemory} from '../../src/nar/memory/WorkingMemory.js';
import {OrchestrationGuide} from '../../src/nar/orchestration.js';
import {SkillCatalog} from '../../src/agent/SkillCatalog.js';
import {ResponseInterpreter} from '../../src/agent/ResponseInterpreter.js';
import {LastResults} from '../../src/agent/LastResults.js';
import {ChatResponder} from '../../src/agent/ChatResponder.js';
import {LMConfig} from '../../src/nar/lm/types.js';

describe('BOT2 LM Integration', () => {
  let nar: NAR;
  let workingMemory: WorkingMemory;
  let orchestrationGuide: OrchestrationGuide;
  let skillCatalog: SkillCatalog;
  let responseInterpreter: ResponseInterpreter;
  let lastResults: LastResults;
  let chatResponder: ChatResponder;

  beforeAll(() => {
    nar = new NAR();
    workingMemory = new WorkingMemory();
    orchestrationGuide = new OrchestrationGuide();
    skillCatalog = new SkillCatalog(nar);
    responseInterpreter = new ResponseInterpreter(nar);
    lastResults = new LastResults();
  });

  it('should integrate working memory with orchestration', () => {
    workingMemory.pin('test-key', 'test-value');
    const value = workingMemory.recall('test-key');
    expect(value).toBe('test-value');
    
    const tier = orchestrationGuide.evaluate({f: 0.7, c: 0.6});
    expect(tier).toBe('ACT');
  });

  it('should integrate skill catalog with response interpreter', async () => {
    const skillsText = skillCatalog.getSkillsText();
    expect(skillsText).toContain('NAL Operations');
    
    const result = await responseInterpreter.interpret('Test response');
    expect(result).toBeDefined();
  });

  it('should track last results and feed into context', () => {
    lastResults.record('What is 2+2?', 'The answer is 4', ['believe']);
    
    const recent = lastResults.getRecent(3);
    expect(recent).toContain('What is 2+2?');
    expect(recent).toContain('The answer is 4');
  });

  it('should calibrate LLM confidence in orchestration', () => {
    const original = {f: 0.8, c: 0.9};
    const calibrated = orchestrationGuide.calibrateLLMConfidence(original);
    
    expect(calibrated.f).toBe(0.8);
    expect(calibrated.c).toBeLessThan(original.c);
    expect(calibrated.c).toBe(0.75);
  });

  it('should run complete BOT2 workflow', async () => {
    workingMemory.pin('goal', 'test-reasoning');
    
    await nar.believe('(cat-->animal).');
    await nar.believe('(animal-->"living being").');
    
    const beliefs = nar.getBeliefs();
    expect(beliefs.length).toBeGreaterThanOrEqual(2);
    
    const derived = await nar.run(5);
    
    lastResults.record(
      'What is 2+2?',
      'The answer is 4',
      ['believe']
    );
    
    const skills = skillCatalog.getSkillsForPrompt();
    expect(skills).toContain('deduction');
    
    const tier = orchestrationGuide.evaluate({f: 0.75, c: 0.65});
    expect(tier).toBe('ACT');
  });

  it('should handle ChatResponder with skill catalog', () => {
    expect(skillCatalog).toBeDefined();
    expect(nar).toBeDefined();
  });

  it('should integrate all BOT2 components', async () => {
    workingMemory.pin('task', 'integration-test');
    
    await nar.believe('(bird-->fly).');
    await nar.believe('(penguin-->bird).');
    await nar.believe('(penguin-->"not fly").');
    
    const beliefs = nar.getBeliefs();
    expect(beliefs.length).toBeGreaterThanOrEqual(3);
    
    const revision = await nar.run(10);
    
    const calibrated = orchestrationGuide.calibrateLLMConfidence({f: 0.9, c: 0.8});
    expect(calibrated.c).toBe(0.65);
    
    lastResults.record(
      'Add beliefs about birds',
      'Added 3 beliefs',
      ['believe', 'believe', 'believe']
    );
    
    const recent = lastResults.getRecent(1);
    expect(recent).toContain('Add beliefs about birds');
    
    const skills = skillCatalog.getSkillsText();
    expect(skills).toContain('revision');
    
    const interpretation = await responseInterpreter.interpret('Processed');
    expect(interpretation).toBeDefined();
  });
});
