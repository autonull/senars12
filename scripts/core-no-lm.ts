#!/usr/bin/env tsx
/**
 * The core does not reach into the induction layer (TODO29.a A2).
 *
 * The gate fails on a cycle-path import of `nar/src/lm/`, in either direction of
 * the dependency — static or dynamic, value or type. There is no type-only
 * exemption here for the same reason `deps:direction` has none: a type is
 * erased at compile time, but a core file naming a layer type is a dependency
 * the layering is making and the boundary is refusing.
 *
 * It is a *scan*, not a build: the point is that a well-meaning import cannot
 * cross, and the compiler cannot see a module that was never meant to be there.
 */
import { coreLayerRemedy, scanCoreLayer } from './lib/layer-boundary.js';
import { report } from './lib/verdicts.js';

const violations = scanCoreLayer();
report('core:no-lm', violations, { remedy: coreLayerRemedy(violations) });

console.log(
  'core:no-lm ok — no cycle-path module imports nar/src/lm; the core names a ModelRule, ' +
    'a TextGenerator and an EmbeddingRuntime instead'
);
