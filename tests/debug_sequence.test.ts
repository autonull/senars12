import {describe, it, expect, beforeAll} from '@jest/globals';
import {NAR} from '../src/nar/nar.js';
import {WorkingMemory} from '../src/nar/memory/WorkingMemory.js';
import {OrchestrationGuide} from '../src/nar/orchestration.js';
import {SkillCatalog} from '../src/agent/SkillCatalog.js';
import {ResponseInterpreter} from '../src/agent/ResponseInterpreter.js';
import {LastResults} from '../src/agent/LastResults.js';

describe('Sequence debug', () => {
  let nar: NAR;
  let workingMemory: WorkingMemory;
  let orchestrationGuide: OrchestrationGuide;
  let skillCatalog: SkillCatalog;
  let responseInterpreter: ResponseInterpreter;
  let lastResults: LastResults;

  beforeAll(() => {
    console.log('Creating NAR...');
    nar = new NAR();
    console.log('NAR created');
    workingMemory = new WorkingMemory();
    orchestrationGuide = new OrchestrationGuide();
    console.log('Creating SkillCatalog...');
    skillCatalog = new SkillCatalog(nar);
    console.log('SkillCatalog created');
    responseInterpreter = new ResponseInterpreter(nar);
    lastResults = new LastResults();
  });

  it('should believe first inheritance', async () => {
    console.log('Test 1: About to believe (cat-->animal).');
    await nar.believe('(cat-->animal).');
    console.log('Test 1: Believed successfully');
    expect(nar.getBeliefs().length).toBeGreaterThanOrEqual(1);
  });

  it('should believe second inheritance', async () => {
    console.log('Test 2: About to believe (animal-->"living being").');
    await nar.believe('(animal-->"living being").');
    console.log('Test 2: Believed successfully');
    expect(nar.getBeliefs().length).toBeGreaterThanOrEqual(1);
  });
});
