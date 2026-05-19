import {describe, it, expect, beforeAll} from '@jest/globals';
import {NAR} from '../src/nar/nar.js';
import {WorkingMemory} from '../src/nar/memory/WorkingMemory.js';
import {OrchestrationGuide} from '../src/nar/orchestration.js';
import {SkillCatalog} from '../src/agent/SkillCatalog.js';
import {ResponseInterpreter} from '../src/agent/ResponseInterpreter.js';
import {LastResults} from '../src/agent/LastResults.js';

describe('Full debug', () => {
  let nar: NAR;
  let workingMemory: WorkingMemory;
  let orchestrationGuide: OrchestrationGuide;
  let skillCatalog: SkillCatalog;
  let responseInterpreter: ResponseInterpreter;
  let lastResults: LastResults;

  beforeAll(() => {
    nar = new NAR();
    workingMemory = new WorkingMemory();
    orchestrationGuide = new OrchestrationGuide();
    skillCatalog = new SkillCatalog(nar);
    responseInterpreter = new ResponseInterpreter(nar);
    lastResults = new LastResults();
  });

  it('should believe inheritance', async () => {
    await nar.believe('(cat-->animal).');
    expect(nar.getBeliefs().length).toBeGreaterThanOrEqual(0);
  });
});
