/**
 * Successor Generation — generates possible next states for economy tasks.
 */
import type { EconomyTask, Successor } from '../types';
import type { Clock } from '../../kernel/env';
/** Successor generation context. */
export interface SuccessorContext {
    /** Current tasks. */
    tasks: EconomyTask[];
    /** Task to generate successors for. */
    task: EconomyTask;
    /** Available oracles. */
    oracleOperations: string[];
    /** Available faculties. */
    facultyNames: string[];
    /** Current iteration. */
    iteration: number;
}
/** Generated successor. */
export interface GeneratedSuccessor extends Successor {
    /** Source operation. */
    source: 'oracle' | 'faculty' | 'derivation' | 'internal';
    /** Operation name. */
    operation: string;
    /** Arguments. */
    args: Record<string, unknown>;
}
/**
 * Generate successors for a task.
 */
export declare function generateSuccessors(context: SuccessorContext, clock?: Clock): GeneratedSuccessor[];
//# sourceMappingURL=successor-generation.d.ts.map