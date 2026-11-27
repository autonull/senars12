import { type LMTask } from '@senars/types/llm';
import { SenarsError } from '@senars/errors';
export declare const withHint: (message: string, provider?: string) => string;
/** Typed error for provider/transport failures (offline fallbacks, re-probing). */
export declare class LMUnavailableError extends SenarsError {
    readonly provider: string | undefined;
    readonly task: LMTask | undefined;
    readonly detail: unknown;
    constructor(message: string, provider?: string, task?: LMTask, detail?: unknown);
}
/** @deprecated Use `isRetryableError` from `@senars/errors` instead. Kept for backward compatibility. */
export declare const isTransportError: (e: unknown) => boolean;
export declare const withRetry: <T>(fn: () => Promise<T>, provider: string | undefined, task: LMTask, retries?: number) => Promise<T>;
/** How much hotter a retried generation runs. The documented escalation step. */
export declare const RETRY_TEMPERATURE_STEP = 0.2;
/**
 * The temperatures a failed generation is retried at, hottest last.
 *
 * One ladder for the escalation path: `tryGenerateText` and the structured-output
 * fallback each wrote their own, and they had drifted — the JSON-mode fallback
 * stepped by `0.3` where every other escalation stepped by `0.2`, so a
 * structured-output failure escalated further than the contract says. Retrying
 * hotter is a *different* axis from retrying later, which is why this sits
 * beside `withRetry` rather than inside it.
 */
export declare const temperatureLadder: (base?: number) => readonly number[];
//# sourceMappingURL=errors.d.ts.map