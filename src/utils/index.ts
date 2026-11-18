/**
 * Utils — barrel export (bridge to @senars/util during migration).
 *
 * TODO: Migrate actual implementations from util/src/ to src/utils/
 * and remove this bridge when util package is collapsed.
 */

// Config
export * from '../../util/src/config/env.js';
export * from '../../util/src/config/boundary.js';
export * from '../../util/src/config/bounds.js';
export * from '../../util/src/config/cognitive-bounds.js';
export * from '../../util/src/config/defaults.js';
export * from '../../util/src/config/dialogue.js';
export * from '../../util/src/config/index.js';
export * from '../../util/src/config/lm-schema.js';
export * from '../../util/src/config/nar-core-bounds.js';
export * from '../../util/src/config/paths.js';
export * from '../../util/src/config/pressure.js';
export * from '../../util/src/config/system-one.js';
export * from '../../util/src/config/validation.js';

// Errors
export * from '../../util/src/errors/engine.js';
export * from '../../util/src/errors/index.js';
export * from '../../util/src/errors/nar-errors.js';
export * from '../../util/src/errors/policy.js';
export * from '../../util/src/errors/senars-error.js';
export * from '../../util/src/errors/tool.js';
export * from '../../util/src/errors/transport.js';

// Types
export * from '../../util/src/types/agent.js';
export * from '../../util/src/types/capability.js';
export * from '../../util/src/types/cognitive.js';
export * from '../../util/src/types/engine.js';
export * from '../../util/src/types/episodic-memory.js';
export * from '../../util/src/types/health.js';
export * from '../../util/src/types/lifecycle.js';
export * from '../../util/src/types/llm.js';
export * from '../../util/src/types/memory.js';
export * from '../../util/src/types/tools.js';
export * from '../../util/src/types/transport.js';
export * from '../../util/src/types/truth.js';

// Commands
export * from '../../util/src/commands/index.js';
export * from '../../util/src/commands/registry.js';

// Utils
export * from '../../util/src/utils/assert.js';
export * from '../../util/src/utils/async.js';
export * from '../../util/src/utils/bandit.js';
export * from '../../util/src/utils/bounded-map.js';
export * from '../../util/src/utils/cli.js';
export * from '../../util/src/utils/clock.js';
export * from '../../util/src/utils/collections.js';
export * from '../../util/src/utils/diagnostics.js';
export * from '../../util/src/utils/disposal.js';
export * from '../../util/src/utils/error.js';
export * from '../../util/src/utils/format.js';
export * from '../../util/src/utils/fs.js';
export * from '../../util/src/utils/guards.js';
export * from '../../util/src/utils/hash.js';
export * from '../../util/src/utils/id.js';
export * from '../../util/src/utils/json.js';
export * from '../../util/src/utils/keyed-collection.js';
export * from '../../util/src/utils/lru-cache.js';
export * from '../../util/src/utils/numeric.js';
export * from '../../util/src/utils/object.js';
export * from '../../util/src/utils/prompt.js';
export * from '../../util/src/utils/random.js';
export * from '../../util/src/utils/rate-limit.js';
export * from '../../util/src/utils/result.js';
export * from '../../util/src/utils/retry.js';
export * from '../../util/src/utils/shutdown.js';
export * from '../../util/src/utils/stats.js';
export * from '../../util/src/utils/tally.js';
export * from '../../util/src/utils/text.js';
export * from '../../util/src/utils/unify.js';
export * from '../../util/src/utils/witness.js';
export * from '../../util/src/bag/Bag.js';
export * from '../../util/src/bag/index.js';

// Events
export * from '../../util/src/events/event-bus.js';
export * from '../../util/src/events/index.js';
export * from '../../util/src/events/listener-bag.js';
export * from '../../util/src/events/push-queue.js';
export * from '../../util/src/events/signal.js';
export * from '../../util/src/events/types.js';

// Logger
export * from '../../util/src/logger.js';

// Local utils (config-check, config-migrate, env-validate)
export * from './config-check.js';
export * from './config-migrate.js';
export * from './env-validate.js';

// Common utilities (frequently used)
export * from './common.js';