import { tool } from 'ai';
import { z } from 'zod';
import { evaluateExpression } from '@senars/util/utils/eval';
import type { Term } from '../../terms';
import { mentionsSymbol } from '../../terms';

export interface NARSToolDeps {
  workingMemory: { size(): number };

  input(statement: string, type?: string, truth?: unknown): Promise<void>;

  queryTerm(term: unknown, filter?: unknown): { beliefs: unknown[] };

  getQuestions(): unknown[];

  getGoals(): unknown[];

  run(steps: number): Promise<number>;

  getStatistics(): { totalConcepts: number; totalTasks: number };

  getBeliefs(): unknown[];

  attentionReport(): { concepts: unknown[]; total: number };

  getConstitution(): unknown[];

  checkConstitutionViolation(belief: unknown): boolean;
}

export interface NARSToolsOptions {
  constitutionEnforcement?: boolean;
}

export function createNARSTools(nar: NARSToolDeps, options: NARSToolsOptions = {}) {
  const { constitutionEnforcement = true } = options;

  const checkConstitution = async (statement: string, type: string) => {
    if (!constitutionEnforcement) return { violation: false };
    try {
      // Parse the statement to create a task for checking
      const { termParser, Truth } = await import('../../terms/index.js');
      const { createTask, createBudget } = await import('../../types');
      const parsed = termParser.parseTask(statement);
      if (parsed?.term) {
        const task = createTask(
          parsed.term,
          type as 'belief' | 'goal',
          parsed.truth ?? Truth.NEUTRAL,
          createBudget(0.5)
        );
        const violation = nar.checkConstitutionViolation(task);
        return { violation, clause: violation ? 'constitution conflict' : undefined };
      }
    } catch {
      // If parsing fails, skip constitution check
    }
    return { violation: false };
  };
  return {
    nar_believe: tool({
      description: 'Add a belief to NARS knowledge base in Narsese format',
      inputSchema: z.strictObject({
        statement: z.string().describe('Narsese statement, e.g., "(cat --> animal)."'),
        truth: z
          .object({
            frequency: z.number().min(0).max(1).optional(),
            confidence: z.number().min(0).max(1).optional(),
          })
          .optional(),
      }),
      execute: async ({ statement, truth }) => {
        const check = await checkConstitution(statement, 'belief');
        if (check.violation) {
          return {
            success: false,
            error: `Constitution violation: ${check.clause}`,
            statement,
          };
        }
        const f = truth?.frequency;
        const c = truth?.confidence;
        const hasTruth = f !== undefined && c !== undefined;
        const fullStatement = hasTruth ? `${statement.replace(/\.$/, '')} %${f};${c}%` : statement;
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
      inputSchema: z.strictObject({
        statement: z.string().describe('Narsese goal statement, e.g., "(call_mom)!"'),
      }),
      execute: async ({ statement }) => {
        const check = await checkConstitution(statement, 'goal');
        if (check.violation) {
          return {
            success: false,
            error: `Constitution violation: ${check.clause}`,
            statement,
          };
        }
        await nar.input(statement, 'goal');
        return { success: true, statement, timestamp: Date.now() };
      },
    }),

    nar_query: tool({
      description: 'Query the NARS knowledge base for information about a term',
      inputSchema: z.strictObject({
        term: z.string().describe('Term to query'),
        filter: z
          .object({
            minConfidence: z.number().optional(),
            maxResults: z.number().optional(),
          })
          .optional(),
      }),
      execute: async ({ term, filter }) => {
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
      inputSchema: z.strictObject({
        question: z.string().describe('Narsese question, e.g., "(cat --> ?)"'),
        steps: z.number().min(1).max(100).optional().default(10),
      }),
      execute: async ({ question, steps = 10 }) => {
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
      inputSchema: z.strictObject({
        steps: z.number().min(1).max(100).describe('Number of reasoning steps (1-100)'),
      }),
      execute: async ({ steps }) => {
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
      inputSchema: z.strictObject({
        limit: z.number().min(1).max(100).optional().default(20),
        filter: z
          .object({
            minConfidence: z.number().optional(),
            term: z.string().optional(),
          })
          .optional(),
      }),
      execute: async ({ limit = 20, filter }) => {
        let beliefs = nar.getBeliefs() as Array<{
          term: { toString(): string };
          truth?: { c: number };
        }>;

        if (filter?.term) {
          beliefs = beliefs.filter((b) => mentionsSymbol(b.term as Term, filter.term!));
        }
        if (filter?.minConfidence) {
          beliefs = beliefs.filter((b) => b.truth && b.truth.c >= filter.minConfidence!);
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
      inputSchema: z.strictObject({
        limit: z.number().optional().default(10),
      }),
      execute: async ({ limit = 10 }) => {
        const questions = nar.getQuestions().slice(0, limit);
        return { questions, count: questions.length };
      },
    }),

    nar_get_attention: tool({
      description: 'Get current attention distribution in NARS memory',
      inputSchema: z.strictObject({
        limit: z.number().optional().default(20),
      }),
      execute: async ({ limit = 20 }) => {
        const report = nar.attentionReport();
        return {
          concepts: report.concepts.slice(0, limit),
          total: report.total,
        };
      },
    }),

    nar_get_goals: tool({
      description: 'Get current goals from NARS memory',
      inputSchema: z.strictObject({
        limit: z.number().min(1).max(100).optional().default(10),
      }),
      execute: async ({ limit = 10 }) => {
        const goals = (nar.getGoals() as unknown[]).slice(0, limit);
        return { goals, count: goals.length };
      },
    }),
  };
}

export function createGeneralTools(deps: {
  nar?: { queryTerm(term: unknown, filter?: unknown): { beliefs: unknown[] } };
  episodicMemory?: { getEpisodes(options: { limit: number; type?: string }): Promise<unknown[]> };
}) {
  return {
    calculate: tool({
      description: 'Perform mathematical calculation',
      inputSchema: z.strictObject({
        expression: z.string().describe('Math expression, e.g., "2 + 2 * 3"'),
      }),
      execute: async ({ expression }) => {
        try {
          return { expression, result: evaluateExpression(expression), success: true };
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
      inputSchema: z.strictObject({
        limit: z.number().optional().default(10),
        type: z
          .enum(['input', 'response', 'belief_added', 'question', 'tool_call', 'error'])
          .optional(),
      }),
      execute: async ({ limit = 10, type }) => {
        if (!deps.episodicMemory) {
          return { error: 'Episodic memory not available', episodes: [] };
        }
        const episodes = await deps.episodicMemory.getEpisodes({ limit, type });
        return {
          episodes,
          count: episodes.length,
        };
      },
    }),
  };
}
