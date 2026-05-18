import {describe, it, expect} from '@jest/globals';
import {NAR} from '../../src/nar/nar.js';
import {WorkingMemory} from '../../src/nar/memory/WorkingMemory.js';
import {OrchestrationGuide} from '../../src/nar/orchestration.js';
import {GroundingPipeline, SourceQuality} from '../../src/nar/grounding.js';
import {SkillCatalog} from '../../src/agent/SkillCatalog.js';
import {ResponseInterpreter} from '../../src/agent/ResponseInterpreter.js';
import {LastResults} from '../../src/agent/LastResults.js';
import {ScenarioRunner} from '../../src/agent/scenarios/ScenarioRunner.js';
import {ScoringEngine} from '../../src/agent/scenarios/ScoringEngine.js';
import {ExperimentRunner} from '../../src/agent/experiments/ExperimentRunner.js';
import {SelfAnalyzer} from '../../src/agent/SelfAnalyzer.js';

describe('BOT2.md Components', () => {
  describe('WorkingMemory', () => {
    it('should pin and recall values', () => {
      const wm = new WorkingMemory();
      wm.pin('test-key', 'test-value');
      expect(wm.recall('test-key')).toBe('test-value');
    });

    it('should recall all pinned values', () => {
      const wm = new WorkingMemory();
      wm.pin('key1', 'value1');
      wm.pin('key2', 'value2');
      const all = wm.recallAll();
      expect(all.size).toBe(2);
      expect(all.get('key1')).toBe('value1');
      expect(all.get('key2')).toBe('value2');
    });

    it('should unpin specific key', () => {
      const wm = new WorkingMemory();
      wm.pin('key1', 'value1');
      wm.pin('key2', 'value2');
      wm.unpin('key1');
      expect(wm.recall('key1')).toBeNull();
      expect(wm.recall('key2')).toBe('value2');
    });

    it('should clear all when unpin called without key', () => {
      const wm = new WorkingMemory();
      wm.pin('key1', 'value1');
      wm.unpin();
      expect(wm.recallAll().size).toBe(0);
    });
  });

  describe('OrchestrationGuide', () => {
    it('should evaluate truth to correct tier', () => {
      const guide = new OrchestrationGuide();
      
      expect(guide.evaluate({f: 0.7, c: 0.6})).toBe('ACT');
      expect(guide.evaluate({f: 0.4, c: 0.5})).toBe('HYPOTHESIZE');
      expect(guide.evaluate({f: 0.5, c: 0.2})).toBe('IGNORE');
    });

    it('should calculate expectation', () => {
      const guide = new OrchestrationGuide();
      const exp = guide.expectation({f: 0.7, c: 0.8});
      expect(exp).toBeCloseTo(0.66, 1);
    });

    it('should calibrate LLM confidence (discount by 15pp)', () => {
      const guide = new OrchestrationGuide();
      const calibrated = guide.calibrateLLMConfidence({f: 0.7, c: 0.8});
      expect(calibrated.f).toBe(0.7);
      expect(calibrated.c).toBe(0.65);
    });

    it('should apply novelty discount', () => {
      const guide = new OrchestrationGuide();
      const discounted = guide.noveltyDiscount({term: 'test'}, {f: 0.8, c: 0.9});
      expect(discounted.f).toBe(0.76);
      expect(discounted.c).toBeCloseTo(0.882);
    });
  });

  describe('GroundingPipeline', () => {
    it('should map source quality to confidence', () => {
      const nar = new NAR();
      const pipeline = new GroundingPipeline(nar, nar.memory, {});

      expect(pipeline.getSourceConfidence('SEC.gov')).toBe(SourceQuality.PRIMARY);
      expect(pipeline.getSourceConfidence('Reuters')).toBe(SourceQuality.SECONDARY);
      expect(pipeline.getSourceConfidence('Wikipedia')).toBe(SourceQuality.GENERAL);
      expect(pipeline.getSourceConfidence('Blog')).toBe(SourceQuality.TERTIARY);
    });

    it('should ground facts with source quality', async () => {
      const nar = new NAR();
      const pipeline = new GroundingPipeline(nar, nar.memory, {});

      await pipeline.groundFact('test', 'SEC.gov', SourceQuality.PRIMARY, '(cat --> animal).');
      
      const beliefs = nar.getBeliefs();
      expect(beliefs.length).toBeGreaterThan(0);
    });
  });

  describe('SkillCatalog', () => {
    it('should generate skills text', () => {
      const nar = new NAR();
      const catalog = new SkillCatalog(nar);
      const text = catalog.getSkillsText();
      expect(text).toContain('NAL Operations');
    });

    it('should get skills for prompt', () => {
      const nar = new NAR();
      const catalog = new SkillCatalog(nar);
      const text = catalog.getSkillsForPrompt();
      expect(typeof text).toBe('string');
    });

    it('should register custom skills', () => {
      const nar = new NAR();
      const catalog = new SkillCatalog(nar);
      catalog.registerCustomSkill('test-skill', 'A test skill', 'Example usage');
      const text = catalog.getSkillsText();
      expect(text).toContain('test-skill');
    });
  });

  describe('ResponseInterpreter', () => {
    it('should interpret simple responses', async () => {
      const nar = new NAR();
      const interpreter = new ResponseInterpreter(nar);
      const result = await interpreter.interpret('This is a test response');
      expect(result).toBeDefined();
    });

    it('should extract Narsese statements', async () => {
      const nar = new NAR();
      const interpreter = new ResponseInterpreter(nar);
      const result = await interpreter.interpret('I believe (cat --> animal).');
      expect(result).toBeDefined();
    });
  });

  describe('LastResults', () => {
    it('should record turn results', () => {
      const lastResults = new LastResults();
      lastResults.record('input', 'response', ['action1']);
      
      const recent = lastResults.getRecent(3);
      expect(recent).toContain('input');
      expect(recent).toContain('response');
    });

    it('should limit recent results', () => {
      const lastResults = new LastResults();
      for (let i = 0; i < 10; i++) {
        lastResults.record(`input${i}`, `response${i}`, [`action${i}`]);
      }
      
      const recent = lastResults.getRecent(3);
      expect(recent).not.toContain('input0');
      expect(recent).toContain('input9');
    });
  });

  describe('ScenarioRunner', () => {
    it('should run a simple scenario', async () => {
      const nar = new NAR();
      const runner = new ScenarioRunner(nar);
      
      const scenario = {
        id: 'test-1',
        name: 'Test Scenario',
        category: 'test' as const,
        description: 'A test',
        steps: [
          {input: '(cat --> animal).', type: 'belief' as const}
        ]
      };

      const result = await runner.run(scenario);
      expect(result.scenario.id).toBe('test-1');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should run batch of scenarios', async () => {
      const nar = new NAR();
      const runner = new ScenarioRunner(nar);
      
      const scenarios = [
        {
          id: 'test-1',
          name: 'Test 1',
          category: 'test' as const,
          description: 'Test',
          steps: [{input: '(cat --> animal).', type: 'belief' as const}]
        }
      ];

      const results = await runner.runBatch(scenarios);
      expect(results.length).toBe(1);
    });
  });

  describe('ScoringEngine', () => {
    it('should score derivations', () => {
      const scoring = new ScoringEngine();
      const result = scoring.scoreDerivations(0, {contains: 'test'});
      expect(result).toBeDefined();
    });
  });

  describe('ExperimentRunner', () => {
    it('should create experiment', () => {
      const nar = new NAR();
      const scenarioRunner = new ScenarioRunner(nar);
      const runner = new ExperimentRunner(nar, scenarioRunner);
      
      const experiment = runner.createExperiment({
        name: 'Test Experiment',
        type: 'parameter-sweep',
        description: 'A test',
        parameters: {},
        objective: 'test'
      });
      
      expect(experiment.id).toBeDefined();
      expect(experiment.status).toBe('pending');
    });

    it('should list experiments', () => {
      const nar = new NAR();
      const scenarioRunner = new ScenarioRunner(nar);
      const runner = new ExperimentRunner(nar, scenarioRunner);
      
      runner.createExperiment({
        name: 'Test 1',
        type: 'parameter-sweep',
        description: 'Test',
        parameters: {},
        objective: 'test'
      });

      const experiments = runner.listExperiments();
      expect(experiments.length).toBe(1);
    });
  });

  describe('SelfAnalyzer', () => {
    it('should be constructable', () => {
      const nar = new NAR();
      const analyzer = new SelfAnalyzer(nar);
      expect(analyzer).toBeDefined();
    });

    it('should analyze reasoning gaps', async () => {
      const nar = new NAR();
      const analyzer = new SelfAnalyzer(nar);
      const report = await analyzer.analyzeReasoningGaps();
      expect(report).toBeDefined();
    });
  });
});
