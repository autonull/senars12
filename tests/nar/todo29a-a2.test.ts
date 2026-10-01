/**
 * A2's boundary (TODO29.a §5.2) — every case failing first, per §10.1.
 *
 * `core:no-lm` is a scan over the checkout, so the rules it applies are tested
 * here on objects: what counts as a cycle-path file, what counts as an import of
 * the layer, and what a well-meaning edge looks like from the inside. A gate
 * that can only fail on a real violation is a gate whose *rules* nobody has ever
 * seen fail.
 */

import { LMRule } from '@senars/nar/lm';
import * as layerJson from '@senars/nar/lm/json.js';
import { CYCLE_PATH_PREFIXES } from '../../nar/src/lm/in-cycle-inventory.js';
import {
  createEmbeddingGenerator,
  isMockLM,
  MockEmbeddingGenerator,
} from '@senars/nar/memory/embedding';
import { RuleProcessor } from '../../nar/src/rules/impls/processor.js';
import type { ModelRule } from '@senars/nar/rules/types';
import { parseJsonObject } from '@senars/util';
import { describe, expect, it } from 'vitest';
import { coreLayerViolations, isCyclePath, resolveInNar } from '../../scripts/lib/layer-boundary.js';
import { ROOT } from '../../scripts/lib/root.js';

const at = (source: string, file = `${ROOT}/nar/src/memory/embedding.ts`) =>
  coreLayerViolations(file, source);

describe('A2 — the core extension contract is typed in core vocabulary', () => {
  it('the layer satisfies the core contract without the core naming it', () => {
    const rule: ModelRule = new LMRule('probe', null);
    expect(rule.hasSymbolicFallback).toBe(false);
    expect(rule.category).toBe('general');

    const processor = new RuleProcessor();
    processor.registerModelRule(rule);
    expect(processor.getModelRule('probe')).toBe(rule);
    expect(processor.getModelRuleStats()).toHaveLength(1);
  });

  it('JSON extraction is util, and the layer re-exports the same function', () => {
    const text = 'sure!\n```json\n{"a": 1}\n```\ntrailing prose with a } brace';
    expect(parseJsonObject(text)).toEqual({ a: 1 });
    expect(layerJson.parseJsonObject).toBe(parseJsonObject);
    expect(parseJsonObject('no object here')).toBeNull();
  });
});

describe('A2 — the embedding runtime is injected, not read', () => {
  it('a runtime naming no provider degrades to the deterministic embedder', () => {
    expect(createEmbeddingGenerator(() => ({ provider: 'none', device: 'cpu' }))).toBeInstanceOf(
      MockEmbeddingGenerator
    );
    expect(createEmbeddingGenerator()).toBeInstanceOf(MockEmbeddingGenerator);
  });

  it('a runtime naming transformers loads the real embedder', () => {
    const generator = createEmbeddingGenerator(() => ({ provider: 'transformers', device: 'cpu' }));
    expect(generator.constructor.name).toBe('TransformersEmbeddingGenerator');
  });

  it('the provider decision is asked of the runtime, not remembered from a value', () => {
    let provider = 'none';
    const runtime = () => ({ provider, device: 'cpu' });
    expect(isMockLM(runtime)).toBe(true);
    provider = 'transformers';
    expect(isMockLM(runtime)).toBe(false);
  });
});

describe('A2 — the gate sees both directions and grants no exemption', () => {
  it('a relative import of the layer fails', () => {
    expect(at("import { getLMSettings } from '../lm/providers.js';")).toEqual([
      {
        at: 'nar/src/memory/embedding.ts:1',
        specifier: '../lm/providers.js',
        dynamic: false,
      },
    ]);
  });

  it('a workspace subpath of the layer fails, and both spellings resolve alike', () => {
    expect(at("import { LMRule } from '@senars/nar/lm/rule/LMRule.js';")).toHaveLength(1);
    expect(resolveInNar(`${ROOT}/nar/src/rules/x.ts`, '@senars/nar/lm/json.js')).toBe(
      `${ROOT}/nar/src/lm/json`
    );
  });

  it('a dynamic import of the layer fails — it is a value edge at runtime', () => {
    expect(at("const m = await import('../lm/lm-service.js');")[0]?.dynamic).toBe(true);
  });

  it('a type-only import of the layer fails: a named layer type is the coupling', () => {
    expect(at("import type { LMService } from '../lm/lm-service.js';")).toHaveLength(1);
  });

  it('a sibling module and another package are not the layer', () => {
    expect(at("import { cosine } from '../utils/similarity.js';")).toEqual([]);
    expect(at("import { pushCapped } from '@senars/util';")).toEqual([]);
    expect(at("import { Truth } from '../terms';")).toEqual([]);
  });

  it('a comment naming the layer is not an import', () => {
    expect(at('// see nar/src/lm/providers.ts for the settings\n')).toEqual([]);
  });

  it('the layer is exempt — it is not a consumer of itself', () => {
    expect(
      coreLayerViolations(
        `${ROOT}/nar/src/lm/rule/LMRule.ts`,
        "import { parseJsonObject } from '../json.js';"
      )
    ).toEqual([]);
  });
});

describe('A2 — the cycle path is the inventory list, not a second copy', () => {
  it('every declared prefix is on the cycle path', () => {
    expect(CYCLE_PATH_PREFIXES.length).toBeGreaterThan(0);
    for (const prefix of CYCLE_PATH_PREFIXES) {
      expect(isCyclePath(`${ROOT}/${prefix}`)).toBe(true);
    }
  });

  it('assembly and the layer itself are not the cycle path', () => {
    expect(isCyclePath(`${ROOT}/nar/src/facade/system-one.ts`)).toBe(false);
    expect(isCyclePath(`${ROOT}/nar/src/lm/lm-service.ts`)).toBe(false);
  });
});