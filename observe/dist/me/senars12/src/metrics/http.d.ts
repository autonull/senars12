/**
 * The `/metrics` endpoint (TODO33 §3).
 *
 * 282 LOC of Prometheus writers with no reader: circuit-breaker state, LM spend
 * and judgment counters are invisible in a deployed LM. This is the reader —
 * `text/plain; version=0.0.4` for a scraper, JSON for a human or a CLI.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
/**
 * Answer `/metrics` (`text`) or `/metrics.json`, or return `false` for any other
 * path so the caller can carry on with its own routing.
 */
export declare const handleMetricsRequest: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
//# sourceMappingURL=http.d.ts.map