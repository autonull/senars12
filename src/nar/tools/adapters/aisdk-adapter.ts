import {tool} from 'ai';
import {z} from 'zod';

export function createNARSTools(nar: {
    input(statement: string, type?: string, truth?: unknown): Promise<void>;
    queryTerm(term: unknown, filter?: unknown): {beliefs: unknown[]};
    getQuestions(): unknown[];
    getGoals(): unknown[];
    run(steps: number): Promise<number>;
    getStatistics(): {totalConcepts: number; totalTasks: number};
    getBeliefs(): unknown[];
    attentionReport(): {concepts: unknown[]; total: number};
    getConstitution(): unknown[];
    workingMemory: {size(): number};
}) {
    return {
        nar_believe: tool({
            description: 'Add a belief to NARS knowledge base in Narsese format',
            inputSchema: z.object({
                statement: z.string().describe('Narsese statement, e.g., "(cat --> animal)."'),
                truth: z.object({
                    frequency: z.number().min(0).max(1).optional(),
                    confidence: z.number().min(0).max(1).optional(),
                }).optional(),
            }),
            execute: async ({statement, truth}) => {
                const f = truth?.frequency;
                const c = truth?.confidence;
                const hasTruth = f !== undefined && c !== undefined;
                const fullStatement = hasTruth
                    ? `${statement.replace(/\.$/, '')} %${f};${c}%`
                    : statement;
                await nar.input(fullStatement);
                return {
                    success: true,
                    statement: fullStatement,
                    truth,
                    timestamp: Date.now(),
                };
            },
        }),

        nar_goal: tool({
            description: 'Add a goal to NARS in Narsese format. Goals drive procedural inference.',
            inputSchema: z.object({
                statement: z.string().describe('Narsese goal statement, e.g., "(call_mom)!"'),
            }),
            execute: async ({statement}) => {
                await nar.input(statement, 'goal');
                return {success: true, statement, timestamp: Date.now()};
            },
        }),

        nar_query: tool({
            description: 'Query the NARS knowledge base for information about a term',
            inputSchema: z.object({
                term: z.string().describe('Term to query'),
                filter: z.object({
                    minConfidence: z.number().optional(),
                    maxResults: z.number().optional(),
                }).optional(),
            }),
            execute: async ({term, filter}) => {
                const results = nar.queryTerm(term, filter);
                return {
                    results: results.beliefs.slice(0, filter?.maxResults ?? 50),
                    count: results.beliefs.length,
                    term,
                };
            },
        }),

        nar_question: tool({
            description: 'Ask a question to NARS and attempt to derive an answer',
            inputSchema: z.object({
                question: z.string().describe('Narsese question, e.g., "(cat --> ?)"'),
                steps: z.number().min(1).max(100).optional().default(10),
            }),
            execute: async ({question, steps = 10}) => {
                await nar.input(question);
                const derived = await nar.run(steps);
                const answers = nar.getQuestions().slice(0, 5);
                return {
                    derived,
                    answers,
                    hasAnswer: derived > 0,
                };
            },
        }),

        nar_reason: tool({
            description: 'Run NARS reasoning engine for N steps to derive new beliefs',
            inputSchema: z.object({
                steps: z.number().min(1).max(100).describe('Number of reasoning steps (1-100)'),
            }),
            execute: async ({steps}) => {
                const derived = await nar.run(steps);
                return {
                    derived,
                    stats: nar.getStatistics(),
                    beliefs: nar.getBeliefs().slice(-5),
                };
            },
        }),

        nar_get_beliefs: tool({
            description: 'Get current beliefs from NARS memory',
            inputSchema: z.object({
                limit: z.number().min(1).max(100).optional().default(20),
                filter: z.object({
                    minConfidence: z.number().optional(),
                    term: z.string().optional(),
                }).optional(),
            }),
            execute: async ({limit = 20, filter}) => {
                let beliefs = nar.getBeliefs() as Array<{term: {toString(): string}; truth?: {c: number}}>;

                if (filter?.term) {
                    beliefs = beliefs.filter(b => b.term.toString().includes(filter.term!));
                }
                if (filter?.minConfidence) {
                    beliefs = beliefs.filter(b => b.truth && b.truth.c >= filter.minConfidence!);
                }

                return {
                    beliefs: beliefs.slice(0, limit),
                    total: beliefs.length,
                    limit,
                };
            },
        }),

        nar_get_questions: tool({
            description: 'Get pending questions from NARS that need answers',
            inputSchema: z.object({
                limit: z.number().optional().default(10),
            }),
            execute: async ({limit = 10}) => {
                const questions = nar.getQuestions().slice(0, limit);
                return {questions, count: questions.length};
            },
        }),

        nar_get_attention: tool({
            description: 'Get current attention distribution in NARS memory',
            inputSchema: z.object({
                limit: z.number().optional().default(20),
            }),
            execute: async ({limit = 20}) => {
                const report = nar.attentionReport();
                return {
                    concepts: report.concepts.slice(0, limit),
                    total: report.total,
                };
            },
        }),

        nar_get_goals: tool({
            description: 'Get current goals from NARS memory',
            inputSchema: z.object({
                limit: z.number().min(1).max(100).optional().default(10),
            }),
            execute: async ({limit = 10}) => {
                const goals = (nar.getGoals() as unknown[]).slice(0, limit);
                return {goals, count: goals.length};
            },
        }),
    };
}

/**
 * Tools bound to a `WorkingMemory` instance — see `agent/cognition/WorkingMemory`.
 * Phase 6: lets the LM read and write named slots (focus, goal, hypothesis,
 * evidence, open_questions, recent_derivations, prior_insights) during an
 * episode. The tools the LM sees depend on the active WM, not on a static
 * catalogue; the agent passes a fresh instance per episode.
 */
export function createWorkingMemoryTools(wm: {
    get(name: string): unknown;
    set(name: string, value: unknown, ttlMs?: number): void;
    append(name: string, value: string, ttlMs?: number, limit?: number): void;
    remove(name: string, value: string): void;
    clear(name: string): void;
    snapshot(): Readonly<Record<string, unknown>>;
    keys(): string[];
}) {
    return {
        set_focus: tool({
            description: 'Set the current focus slot in working memory (episode-scoped).',
            inputSchema: z.object({
                focus: z.string().describe('The current focus of attention.'),
                ttlMs: z.number().int().positive().optional(),
            }),
            execute: async ({focus, ttlMs}) => {
                wm.set('focus', focus, ttlMs);
                return {success: true, focus};
            },
        }),

        set_goal: tool({
            description: 'Set the current goal slot in working memory (episode-scoped).',
            inputSchema: z.object({
                goal: z.string().describe('The current goal.'),
                ttlMs: z.number().int().positive().optional(),
            }),
            execute: async ({goal, ttlMs}) => {
                wm.set('goal', goal, ttlMs);
                return {success: true, goal};
            },
        }),

        set_hypothesis: tool({
            description: 'Set the working hypothesis slot in working memory (5 min TTL by default).',
            inputSchema: z.object({
                hypothesis: z.string().describe('The current hypothesis to test.'),
                ttlMs: z.number().int().positive().optional(),
            }),
            execute: async ({hypothesis, ttlMs}) => {
                wm.set('hypothesis', hypothesis, ttlMs);
                return {success: true, hypothesis};
            },
        }),

        add_evidence: tool({
            description: 'Append an evidence item to working memory. Deduplicated, capped to 64 entries.',
            inputSchema: z.object({
                evidence: z.string().describe('The evidence to add.'),
                ttlMs: z.number().int().positive().optional(),
            }),
            execute: async ({evidence, ttlMs}) => {
                wm.append('evidence', evidence, ttlMs);
                return {success: true, evidence};
            },
        }),

        mark_open_question: tool({
            description: 'Persist an open question in working memory (no TTL).',
            inputSchema: z.object({
                question: z.string().describe('The open question to track.'),
            }),
            execute: async ({question}) => {
                wm.append('open_questions', question);
                return {success: true, question};
            },
        }),

        record_derivation: tool({
            description: 'Record a recent derivation in working memory (e.g. a chained inference).',
            inputSchema: z.object({
                derivation: z.string().describe('A short description of the derivation.'),
            }),
            execute: async ({derivation}) => {
                wm.append('recent_derivations', derivation);
                return {success: true, derivation};
            },
        }),

        get_slot: tool({
            description: 'Read a named slot from working memory.',
            inputSchema: z.object({
                name: z.string().describe('Slot name, e.g. focus, goal, hypothesis, evidence, open_questions, recent_derivations, prior_insights.'),
            }),
            execute: async ({name}) => {
                const value = wm.get(name);
                return {name, value: value ?? null, present: value !== undefined};
            },
        }),

        clear_slot: tool({
            description: 'Clear a named slot from working memory.',
            inputSchema: z.object({
                name: z.string().describe('Slot name to clear.'),
            }),
            execute: async ({name}) => {
                wm.clear(name);
                return {success: true, name};
            },
        }),

        snapshot_working_memory: tool({
            description: 'Take a snapshot of all currently-live working memory slots.',
            inputSchema: z.object({}),
            execute: async () => {
                return {snapshot: wm.snapshot(), keys: wm.keys()};
            },
        }),
    };
}

export function createGeneralTools(deps: {
    nar?: {queryTerm(term: unknown, filter?: unknown): {beliefs: unknown[]}};
    episodicMemory?: {getEpisodes(options: {limit: number; type?: string}): Promise<unknown[]>};
}) {
    return {
        calculate: tool({
            description: 'Perform mathematical calculation',
            inputSchema: z.object({
                expression: z.string().describe('Math expression, e.g., "2 + 2 * 3"'),
            }),
            execute: async ({expression}) => {
                try {
                    const sanitized = expression.replace(/[^0-9+\-*/(). ]/g, '');
                    const result = Function(`"use strict";return (${sanitized})`)();
                    return {
                        expression,
                        result,
                        success: true,
                    };
                } catch (error) {
                    return {
                        expression,
                        error: String(error),
                        success: false,
                    };
                }
            },
        }),

        get_recent_episodes: tool({
            description: 'Get recent episodes from episodic memory',
            inputSchema: z.object({
                limit: z.number().optional().default(10),
                type: z.enum(['input', 'response', 'belief_added', 'question', 'tool_call', 'error']).optional(),
            }),
            execute: async ({limit = 10, type}) => {
                if (!deps.episodicMemory) {
                    return {error: 'Episodic memory not available', episodes: []};
                }
                const episodes = await deps.episodicMemory.getEpisodes({limit, type});
                return {
                    episodes,
                    count: episodes.length,
                };
            },
        }),
    };
}