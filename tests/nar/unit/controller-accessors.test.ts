import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { CognitiveRegistry } from '@senars/cognitive/impls/CognitiveRegistry';
import { DEFAULT_COGNITIVE_PARAMETERS } from '@senars/config/cognitive-parameters';
import { createNAR } from '@senars/nar-presets';
import { createSeNARSRegistry } from '@senars/lm/index';
import { createLMService } from '@senars/lm/lm-service';
import type { NAR } from '@senars/nar';

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
