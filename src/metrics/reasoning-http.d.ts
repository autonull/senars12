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
import type { IncomingMessage, ServerResponse } from 'node:http';
/** Env flag guarding the production reasoning surface. */
export declare const REASONING_HTTP_ENV = "ENABLE_REASONING_HTTP";
/** Default cycles a single `ask` runs before reading the answer. */
export declare const DEFAULT_ASK_RUNS = 5;
/** Upper bound on caller-supplied `runs`, so one request cannot run unbounded. */
export declare const MAX_ASK_RUNS = 100;
/** What the surface needs of the kernel it reasons against. */
export interface ReasoningHttpEngine {
    believe?(term: string): unknown;
    question?(term: string): unknown;
    run?(steps: number, signal?: AbortSignal): Promise<unknown> | unknown;
    askWithDerivation?(term: string): Promise<ReasoningAnswer | undefined>;
}
export interface ReasoningAnswer {
    answer?: unknown;
    truth?: {
        f: number;
        c: number;
    };
    derivation?: {
        record: unknown;
    };
}
/**
 * Build the route over a kernel getter. The getter is read per request so the
 * transport can bind a kernel after the connection is constructed (the bot sets
 * it once the agent is wired).
 */
export declare const createReasoningRoute: (getEngine: () => ReasoningHttpEngine | undefined) => (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
//# sourceMappingURL=reasoning-http.d.ts.map