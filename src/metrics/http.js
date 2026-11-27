/**
 * The `/metrics` endpoint (TODO33 §3).
 *
 * 282 LOC of Prometheus writers with no reader: circuit-breaker state, LM spend
 * and judgment counters are invisible in a deployed LM. This is the reader —
 * `text/plain; version=0.0.4` for a scraper, JSON for a human or a CLI.
 */
import { getMetricsAsJson, getMetricsAsText } from './prometheus';
/**
 * Answer `/metrics` (`text`) or `/metrics.json`, or return `false` for any other
 * path so the caller can carry on with its own routing.
 */
export const handleMetricsRequest = async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path !== '/metrics' && path !== '/metrics.json')
        return false;
    if (path === '/metrics.json') {
        const body = JSON.stringify(await getMetricsAsJson(), null, 2);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(body);
        return true;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    res.end(await getMetricsAsText());
    return true;
};
