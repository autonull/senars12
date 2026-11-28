/**
 * G5 — arcade OTel spans. Each game tick emits an `arcade.tick` span with
 * arm/game attributes and decision events (veto, handover), turning the demo
 * into a distributed trace of cognition watchable in any OTel UI. Without a
 * registered tracer provider the spans are API no-ops — zero overhead.
 *
 * The tracer comes from `otel/index.ts` rather than the global API: that module
 * reads its own provider, and reaching for the global bypassed it, so these
 * spans went nowhere whenever a configured provider was anything other than the
 * global one.
 */
export interface ArcadeTickSpan {
    finish(data: {
        action?: string;
        latencyMs: number;
        reward: number;
        terminal: boolean;
        handover: boolean;
        decision?: {
            action: string | null;
            vetoedBy: string | null;
            source: string;
        };
    }): void;
}
export declare function startArcadeTickSpan(arm: string, game: string, cycle: number): ArcadeTickSpan;
//# sourceMappingURL=arcade-trace.d.ts.map