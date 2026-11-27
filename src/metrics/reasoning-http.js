/**
 * The production reasoning surface (CORE.19 C7.4): a minimal, env-guarded HTTP
 * endpoint so a script can `believe`/`ask` against a running bot without the
 * browser UI or the `/test/*` surface.
 *
 * It reuses the kernel the transport already binds (`believe`, `question`,
 * `run`, `askWithDerivation`) — no second reasoning path. Off unless
 * {@link REASONING_HTTP_ENV} is `"true"`, so a default deployment exposes
 * nothing; when off the route still *claims* its paths and answers `404`, so a
 * stray request is not silently routed as chat.
 */
import { envBool } from '@senars/config';
import { SenarsError } from '../errors/senars-error';
/** Env flag guarding the production reasoning surface. */
export const REASONING_HTTP_ENV = 'ENABLE_REASONING_HTTP';
/** Default cycles a single `ask` runs before reading the answer. */
export const DEFAULT_ASK_RUNS = 5;
/** Upper bound on caller-supplied `runs`, so one request cannot run unbounded. */
export const MAX_ASK_RUNS = 100;
const BELIEVE_PATH = '/reasoning/believe';
const ASK_PATH = '/reasoning/ask';
const TYPED_ERROR = (code, message) => ({ error: { code, message } });
const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    return true;
};
const readJsonBody = async (req) => {
    const chunks = [];
    for await (const chunk of req)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString('utf-8');
    if (!text)
        return {};
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null)
        throw new SenarsError('body must be a JSON object', 'VALIDATION_ERROR');
    return parsed;
};
const requireTerm = (body) => {
    const term = body.term;
    return typeof term === 'string' && term.trim() ? term : null;
};
const askRuns = (body) => {
    const runs = body.runs;
    if (typeof runs !== 'number' || !Number.isFinite(runs) || runs < 1)
        return DEFAULT_ASK_RUNS;
    return Math.min(Math.floor(runs), MAX_ASK_RUNS);
};
/**
 * Build the route over a kernel getter. The getter is read per request so the
 * transport can bind a kernel after the connection is constructed (the bot sets
 * it once the agent is wired).
 */
export const createReasoningRoute = (getEngine) => async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path !== BELIEVE_PATH && path !== ASK_PATH)
        return false;
    if (!envBool(REASONING_HTTP_ENV)) {
        return send(res, 404, TYPED_ERROR('DISABLED', 'Reasoning HTTP surface is disabled'));
    }
    if (req.method !== 'POST') {
        return send(res, 405, TYPED_ERROR('METHOD_NOT_ALLOWED', 'Use POST'));
    }
    const engine = getEngine();
    if (!engine) {
        return send(res, 503, TYPED_ERROR('NO_ENGINE', 'No reasoning kernel is bound'));
    }
    let body;
    try {
        body = await readJsonBody(req);
    }
    catch (e) {
        return send(res, 400, TYPED_ERROR('INVALID_JSON', e.message));
    }
    const term = requireTerm(body);
    if (!term)
        return send(res, 400, TYPED_ERROR('INVALID_TERM', '`term` must be a non-empty string'));
    try {
        if (path === BELIEVE_PATH) {
            if (!engine.believe)
                return send(res, 501, TYPED_ERROR('UNSUPPORTED', 'Kernel cannot believe'));
            await Promise.resolve(engine.believe(term));
            return send(res, 200, { ok: true, operation: 'believe', term });
        }
        if (!engine.question || !engine.run || !engine.askWithDerivation) {
            return send(res, 501, TYPED_ERROR('UNSUPPORTED', 'Kernel cannot answer questions'));
        }
        const runs = askRuns(body);
        await Promise.resolve(engine.question(term));
        await Promise.resolve(engine.run(runs));
        const answer = await engine.askWithDerivation(term);
        return send(res, 200, {
            ok: true,
            operation: 'ask',
            term,
            runs,
            answer: {
                answer: answer?.answer,
                frequency: answer?.truth?.f,
                confidence: answer?.truth?.c,
                hasDerivation: Boolean(answer?.derivation),
            },
            ...(answer?.derivation ? { derivation: answer.derivation.record } : {}),
        });
    }
    catch (e) {
        return send(res, 500, TYPED_ERROR('REASONING_ERROR', e.message));
    }
};
