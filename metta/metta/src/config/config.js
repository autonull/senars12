import {ConfigManager, Validators} from '@senars/core';

export const configManager = new ConfigManager();

configManager
    .define('maxReductionSteps', 1000, Validators.positive, 'Maximum reduction steps before timeout')
    .define('cacheCapacity', 1000, Validators.positive, 'Default cache capacity')
    .define('maxCacheSize', 10000, Validators.positive, 'Maximum cache size')
    .define('loadStdlib', true, Validators.boolean, 'Load standard library on init')
    .define('bridge', null, () => true, 'Bridge instance for reasoner')
    .define('maxInternedSymbols', 10000, Validators.positive, 'Maximum symbols to intern')
    .define('zipperThreshold', 1, Validators.positive, 'Depth at which Zipper replaces recursive traversal')
    .define('pathTrie', false, Validators.boolean, 'Enable PathTrie rule index')
    .define('jit', true, Validators.boolean, 'Enable JIT compilation')
    .define('jitThreshold', 50, Validators.positive, 'Calls before JIT compiling')
    .define('parallelThreshold', 200, Validators.positive, 'Min superpose width for Workers')
    .define('persist', false, Validators.boolean, 'Enable PersistentSpace checkpointing')
    .define('persistThreshold', 50000, Validators.positive, 'Atoms before checkpoint')
    .define('il', false, Validators.boolean, 'Enable MeTTa-IL compilation')
    .define('tensor', true, Validators.boolean, 'Enable NeuralBridge tensor ops')
    .define('smt', false, Validators.boolean, 'Enable SMT constraint solver')
    .define('smtVarThreshold', 5, Validators.positive, 'Min vars to trigger SMT')
    .define('debugging', false, Validators.boolean, 'Enable debug mode')
    .define('tracing', false, Validators.boolean, 'Enable execution tracing')
    .define('profiling', false, Validators.boolean, 'Enable performance profiling')
    .define('slowOpThreshold', 100, Validators.positive, 'Threshold for slow operation logging (ms)')
    .define('interning', true, Validators.boolean, 'Symbol interning')
    .define('fastPaths', true, Validators.boolean, 'Monomorphic type guards')
    .define('indexing', true, Validators.boolean, 'Multi-level rule indexing')
    .define('caching', true, Validators.boolean, 'Reduction result caching')
    .define('pooling', true, Validators.boolean, 'Object pooling')
    .define('tco', true, Validators.boolean, 'Tail call optimization')
    .define('bloomFilter', false, Validators.boolean, 'Fast negative lookups')
    .freeze();

export function getConfig() {
    return configManager.getAll();
}
