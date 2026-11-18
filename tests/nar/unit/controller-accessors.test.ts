import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { CognitiveRegistry } from '@senars/nar/cognitive/impls/CognitiveRegistry.js';
import { DEFAULT_COGNITIVE_PARAMETERS } from '@senars/nar/config/cognitive-parameters.js';
import { createNAR } from '@senars/nar/nar-presets.js';
import { createSeNARSRegistry } from '@senars/nar/lm/index.js';
import { createLMService } from '@senars/nar/lm/lm-service.js';
import type { NAR } from '@senars/nar/nar.js';

describe('CognitiveController accessors', () => {
  let nar: NAR;

  beforeEach(async () => {
    const registry = createSeNARSRegistry();
    const lmService = createLMService();
    const cognitiveRegistry = new CognitiveRegistry();
    cognitiveRegistry.initializeDefaults();

    nar = createNAR({
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
    expect(derivation).toBe('default');
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
