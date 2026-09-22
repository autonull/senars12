/** Resilience primitives (D03/X5). The single generic circuit-breaker lives here;
 *  provider-scoped health machinery (lm/provider-runtime.ts) layers routing,
 *  metrics, and telemetry on top of its own per-provider state. */
export { CircuitBreaker, type CircuitBreakerConfig } from './circuit-breaker.js';
