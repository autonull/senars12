/**
 * Dialogue Flywheel config (TODO24). Top-level app section — dialogue is a
 * peer subsystem that optional reasoners (System One) feed into, not a child
 * of one. Disabled by default: with `enabled: false` the bot behaves
 * byte-identically to pre-flywheel behavior (I5).
 */
import { z } from 'zod';
export declare const dialogueDefaults: {
    readonly enabled: false;
    readonly captureAll: false;
    readonly maxTurnsPerSession: 500;
    /** Opt-in (DQ3): run a retrospective on session close. */
    readonly autoRetrospect: false;
    /** I6 scope: raw-text sidecar off by default (hash-only episodes/labels). */
    readonly retention: 'hash-only';
    /** Sidecar dir for raw text when retention === 'with-text'. */
    readonly textStorePath: './.cache/dialogue/text';
    /** DQ2: reaction attribution — 'explicit' (default, .react only) vs 'cues'
     *  (heuristic from the next utterance, gated by Bench 76). */
    readonly attribution: 'explicit';
};
export declare const dialogueSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    captureAll: z.ZodDefault<z.ZodBoolean>;
    maxTurnsPerSession: z.ZodDefault<z.ZodNumber>;
    autoRetrospect: z.ZodDefault<z.ZodBoolean>;
    retention: z.ZodDefault<z.ZodEnum<{
        "hash-only": "hash-only";
        "with-text": "with-text";
    }>>;
    textStorePath: z.ZodDefault<z.ZodString>;
    attribution: z.ZodDefault<z.ZodEnum<{
        cues: "cues";
        explicit: "explicit";
    }>>;
}, z.core.$strip>;
export type DialogueConfig = z.infer<typeof dialogueSchema>;
//# sourceMappingURL=dialogue.d.ts.map