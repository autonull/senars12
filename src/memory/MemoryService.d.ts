import type { Engine } from '../engine/Engine';
import type { EventLog } from '../log/index';
import type { SkillFeedback, ToolRegistry } from '../motor/ToolRegistry';
import type { MemoryEntry, MemoryQuery } from './types';
export declare class MemoryService {
    #private;
    get size(): number;
    get all(): readonly MemoryEntry[];
    /** Occupancy of the working tier, `0..1` — the AIKR pressure signal. */
    pressure(): number;
    get connectedEngines(): Map<string, Engine> | undefined;
    /** Resize the working tier, keeping the most recent entries that still fit. */
    setMaxWorking(max: number): void;
    /** Connect the EventLog for Tier 1 (episodic) queries */
    connectLog(log: EventLog): void;
    /** Connect engines for Tier 2 (semantic) queries */
    connectEngines(engines: Map<string, Engine>): void;
    /** Connect ToolRegistry for Tier 3 (procedural) feedback */
    connectMotor(motor: ToolRegistry): void;
    append(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): void;
    recent(limit: number, type?: string): MemoryEntry[];
    query(q: MemoryQuery): MemoryEntry[];
    queryTimeRange(from: number, to: number): MemoryEntry[];
    queryAroundTime(ts: number, windowMs: number): MemoryEntry[];
    /** Tier 1: Episodic memory via the log's own filtered read. */
    queryEpisodic(from?: number, to?: number, types?: string[], limit?: number): Promise<MemoryEntry[]>;
    /** Tier 2: Semantic memory via engines */
    querySemantic(pattern: string): Promise<unknown[]>;
    /** Tier 3: Procedural memory — tool feedback */
    getProceduralFeedback(): SkillFeedback[];
    /** Tier 4: Long-term persistence */
    persist(): Promise<void>;
    load(): Promise<void>;
    /** Register an additional memory tier (e.g. vector store via plugin). */
    addTier(name: string, impl: unknown): void;
    getTier(name: string): unknown;
    /** Consolidate: promote high-salience entries to semantic via engines */
    consolidate(_correlationId: string): Promise<void>;
    clear(): void;
}
//# sourceMappingURL=MemoryService.d.ts.map