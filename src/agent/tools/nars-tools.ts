import {tool} from 'ai';
import {z} from 'zod';
import type {NAR} from '../../nar/nar.js';
import type {Task} from '../../nar/types/index.js';

export function narsTools(nar: NAR) {
  return {
    nar_believe: tool({
      description: 'Add a belief to NARS knowledge base in Narsese format',
      parameters: z.object({
        statement: z.string().describe('Narsese statement, e.g., "(cat --> animal)."'),
        truth: z.object({
          frequency: z.number().min(0).max(1).optional(),
          confidence: z.number().min(0).max(1).optional(),
        }).optional(),
      }),
      execute: async ({statement, truth}) => {
        const fullStatement = truth
          ? `${statement} :|: truth=${truth.frequency}`
          : statement;
        await nar.input(fullStatement);
        return {
          success: true,
          statement,
          truth,
          timestamp: Date.now(),
        };
      },
    }),

    nar_query: tool({
      description: 'Query the NARS knowledge base for information about a term',
      parameters: z.object({
        term: z.string().describe('Term to query'),
        filter: z.object({
          minConfidence: z.number().optional(),
          maxResults: z.number().optional(),
        }).optional(),
      }),
      execute: async ({term, filter}) => {
        const results = nar.queryTerm(term as Parameters<typeof nar.queryTerm>[0], filter);
        return {
          results: results.beliefs.slice(0, filter?.maxResults ?? 50),
          count: results.beliefs.length,
          term,
        };
      },
    }),

    nar_question: tool({
      description: 'Ask a question to NARS and attempt to derive an answer',
      parameters: z.object({
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
      parameters: z.object({
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
      parameters: z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        filter: z.object({
          minConfidence: z.number().optional(),
          term: z.string().optional(),
        }).optional(),
      }),
      execute: async ({limit = 20, filter}) => {
        let beliefs: Task[] = nar.getBeliefs();

        if (filter?.term) {
          beliefs = beliefs.filter(b => b.term.toString().includes(filter.term));
        }
        if (filter?.minConfidence) {
          beliefs = beliefs.filter(b => b.truth && b.truth.c >= filter.minConfidence);
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
      parameters: z.object({
        limit: z.number().optional().default(10),
      }),
      execute: async ({limit = 10}) => {
        const questions = nar.getQuestions().slice(0, limit);
        return {questions, count: questions.length};
      },
    }),

    nar_get_attention: tool({
      description: 'Get current attention distribution in NARS memory',
      parameters: z.object({
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
  };
}