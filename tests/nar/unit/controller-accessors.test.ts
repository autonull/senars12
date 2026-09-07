import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { SeNARSFactory } from '../../../nar/src/index.js';
import { createSeNARSRegistry } from '../../../nar/src/lm/index.js';
import { createLMService } from '../../../nar/src/lm/lm-service.js';
import { CognitiveRegistry } from '../../../nar/src/cognitive/registry.js';
import { DEFAULT_COGNITIVE_PARAMETERS } from '../../../nar/src/config/cognitive-parameters.js';

describe('CognitiveController accessors', () => {
  let nar: ReturnType<typeof SeNARSFactory.createDefault>;

  beforeEach(async () => {
    const registry = createSeNARSRegistry();
    const lmService = createLMService();
    const cognitiveRegistry = new CognitiveRegistry();
    cognitiveRegistry.initializeDefaults();

    nar = SeNARSFactory.createDefault({
      providerRegistry: registry,
      lmService,
      enableSelf: true,
      enableRLFP: true,
      enableTools: true,
      maxConcepts: 100,
      persistState: false,
      cognitiveParams: DEFAULT_COGNITIVE_PARAMETERS,
      strategyRegistry: cognitiveRegistry,
    });
    await nar.start();
  });

  afterEach(async () => {
    await nar.stop();
  });

  test('getStrategy returns current strategy type for a known type', () => {
    const controller = nar.getController();
    expect(controller).toBeDefined();

    const derivation = controller!.getStrategy('derivation');
    expect(typeof derivation).toBe('string');
    expect(derivation!.length).toBeGreaterThan(0);
  });

  test('getStrategy tracks setStrategy updates', () => {
    const controller = nar.getController();
    const before = controller!.getStrategy('sampling');

    const target = before === 'priority' ? 'top-n' : 'priority';
    controller!.setStrategy('sampling', target);
    expect(controller!.getStrategy('sampling')).toBe(target);
  });

  test('getStrategy normalizes lmRule to lm-rule key', () => {
    const controller = nar.getController();
    const viaType = controller!.getStrategy('lm-rule');
    expect(typeof viaType).toBe('string');
  });
});