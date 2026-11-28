import type { Episode, EpisodeFilter, EpisodeType, EpisodicMemory as UtilEpisodicMemory } from '@senars/types/episodic-memory';
import { type Clock } from '@senars/util/clock';
import { z } from 'zod';
export type { EpisodicMemoryConfig } from '@senars/types/episodic-memory';
export type { Episode, EpisodeType };
/**
 * Episode schema for Ledger-backed EpisodicMemory.
 * Exported for test reuse and external ledger construction.
 */
export declare const EpisodeSchema: z.ZodObject<{
    at: z.ZodNumber;
    correlationId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<{
        belief_added: "belief_added";
        dialogue: "dialogue";
        error: "error";
        input: "input";
        question: "question";
        reaction: "reaction";
        response: "response";
        tool_call: "tool_call";
    }>;
    content: z.ZodString;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    id: z.ZodOptional<z.ZodString>;
    causes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    consequences: z.ZodOptional<z.ZodArray<z.ZodString>>;
    context: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type LedgerEpisode = z.infer<typeof EpisodeSchema>;
export declare class EpisodicMemory implements UtilEpisodicMemory {
    #private;
    /** Phase D: episodes dropped only if a rollover write itself fails. */
    static droppedTotal: number;
    /** Phase B: optional admit sink — invoked after each successful append (best-effort). */
    onLogged?: (episode: Episode) => void;
    constructor(config?: Partial<{
        enabled: boolean;
        basePath: string;
        retentionDays: number;
        maxEntriesPerFile: number;
        /** Injected time source (C8); defaults to the system clock. */
        clock: Clock;
    }>);
    get basePath(): string;
    log(type: EpisodeType, content: string, metadata?: Record<string, unknown>): Promise<void>;
    getRecent(limit?: number): Promise<Episode[]>;
    search(query: string, limit?: number): Promise<Episode[]>;
    close(): Promise<void>;
    getEpisodes(options?: EpisodeFilter): Promise<Episode[]>;
    pruneOldEpisodes(): Promise<void>;
    clear(): Promise<void>;
    recallRecent(limit?: number): Promise<Episode[]>;
    getRecentSummary(limit?: number): Promise<string>;
}
//# sourceMappingURL=EpisodicMemory.d.ts.map