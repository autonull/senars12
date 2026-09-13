/**
 * @deprecated Will be removed in next major version.
 * Use individual bridge modules from `@senars/io` instead:
 * `import { bindAgentToConnection, createAgentDispatch } from '@senars/io'`
 */
export {
  bindAgentToConnection,
  createAgentDispatch,
  createAuthMiddleware,
  createCommandInterceptor,
  createConnectionConfigsFromEnv,
  createErrorBoundary,
  createRateLimiter,
  createSessionBinder,
  originExtractor,
  resolveSessionKey,
} from './bridge/index.js';
