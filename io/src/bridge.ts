/**
 * @deprecated Will be removed in next major version.
 * Use individual bridge modules from `@senars/io` instead:
 * `import { bindAgentToConnection, createAgentDispatch } from '@senars/io'`
 */
export {
  bindAgentToConnection,
  createAgentDispatch,
  originExtractor,
  resolveSessionKey,
  createAuthMiddleware,
  createCommandInterceptor,
  createSessionBinder,
  createRateLimiter,
  createConnectionConfigsFromEnv,
  createErrorBoundary,
} from './bridge/index.js';
