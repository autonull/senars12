/**
 * Faculty Specification Data — pure data definitions for all 20 faculties.
 * Separated from specs.ts to reduce file size and separate data from logic.
 */

import type { FacultySpec, FacultyFallback } from '../specs';
import type { Term, Truth } from '@senars/terms';
import type { Task } from '../../kernel/types';
import type { OracleOperation } from '../../oracles/oracle';

const createFallback = (faculty: string, result: unknown, confidence: number, description: string, strength: number): FacultyFallback =>
  async () => ({
    faculty: faculty as any,
    result,
    confidence,
    evidence: [{ source: 'fallback', description, strength }],
    fallbackUsed: true,
    durationMs: 0,
  });

/** 1. Grounding Faculty - connects symbols to referents */
export const groundingSpec: FacultySpec = {
  name: 'grounding',
  description: 'Grounds symbols in concrete referents through perception or retrieval',
  category: 'perception',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      secondary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          confidenceThreshold: { type: 'number' },
          maxResults: { type: 'number' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      groundings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            term: { type: 'object' },
            referent: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'retrieval.query',
  fallback: createFallback('grounding', { groundings: [] }, 0.1, 'No grounding available', 0.1),
  enabled: true,
  priority: 0.9,
  budgetCost: 0.1,
  maxConcurrency: 10,
  timeoutMs: 5000,
};

/** 2. Inference Faculty - NAL deduction/induction/abduction */
export const inferenceSpec: FacultySpec = {
  name: 'inference',
  description: 'Performs NAL inference (deduction, induction, abduction)',
  category: 'reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      secondary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          inferenceType: { type: 'string', enum: ['deduction', 'induction', 'abduction', 'revision'] },
          maxSteps: { type: 'number' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      conclusions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            term: { type: 'object' },
            truth: { type: 'object' },
            inferenceType: { type: 'string' },
          },
        },
      },
    },
  },
  oracleOperation: 'engine.tau-prolog',
  fallback: createFallback('inference', { conclusions: [] }, 0.2, 'Symbolic inference fallback', 0.2),
  enabled: true,
  priority: 0.95,
  budgetCost: 0.2,
  maxConcurrency: 5,
  timeoutMs: 10000,
};

/** 3. Abduction Faculty - generates hypotheses */
export const abductionSpec: FacultySpec = {
  name: 'abduction',
  description: 'Generates explanatory hypotheses for observations',
  category: 'reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          maxHypotheses: { type: 'number' },
          minConfidence: { type: 'number' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      hypotheses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            term: { type: 'object' },
            truth: { type: 'object' },
            explanation: { type: 'string' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('abduction', { hypotheses: [] }, 0.15, 'Abductive fallback', 0.15),
  enabled: true,
  priority: 0.7,
  budgetCost: 0.3,
  maxConcurrency: 3,
  timeoutMs: 15000,
};

/** 4. Induction Faculty - generalizes from examples */
export const inductionSpec: FacultySpec = {
  name: 'induction',
  description: 'Induces general patterns from specific examples',
  category: 'learning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      secondary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          minExamples: { type: 'number' },
          generalizationLevel: { type: 'number' },
        },
      },
    },
    required: ['primary', 'secondary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      generalizations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            pattern: { type: 'object' },
            truth: { type: 'object' },
            examples: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('induction', { generalizations: [] }, 0.15, 'Inductive fallback', 0.15),
  enabled: true,
  priority: 0.6,
  budgetCost: 0.3,
  maxConcurrency: 3,
  timeoutMs: 15000,
};

/** 5. Analogy Faculty - maps between domains */
export const analogySpec: FacultySpec = {
  name: 'analogy',
  description: 'Finds structural analogies between domains',
  category: 'reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      secondary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          maxMappings: { type: 'number' },
          minSimilarity: { type: 'number' },
        },
      },
    },
    required: ['primary', 'secondary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      mappings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'object' },
            target: { type: 'object' },
            confidence: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('analogy', { mappings: [] }, 0.1, 'Analogical fallback', 0.1),
  enabled: true,
  priority: 0.5,
  budgetCost: 0.4,
  maxConcurrency: 2,
  timeoutMs: 20000,
};

/** 6. Revision Faculty - merges conflicting beliefs */
export const revisionSpec: FacultySpec = {
  name: 'revision',
  description: 'Revises and merges conflicting beliefs into consistent knowledge',
  category: 'reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      secondary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          revisionType: { type: 'string', enum: ['merge', 'replace', 'weighted'] },
          confidenceThreshold: { type: 'number' },
        },
      },
    },
    required: ['primary', 'secondary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      revised: { type: 'object' },
      truth: { type: 'object' },
      method: { type: 'string' },
    },
  },
  oracleOperation: 'engine.custom',
  fallback: createFallback('revision', { revised: null, truth: null, method: 'fallback' }, 0.2, 'Revision fallback', 0.2),
  enabled: true,
  priority: 0.8,
  budgetCost: 0.15,
  maxConcurrency: 5,
  timeoutMs: 8000,
};

/** 7. Planning Faculty - generates action sequences */
export const planningSpec: FacultySpec = {
  name: 'planning',
  description: 'Generates action sequences to achieve goals',
  category: 'planning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          horizon: { type: 'number' },
          constraints: { type: 'array', items: { type: 'object' } },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      plan: {
        type: 'array',
        items: { type: 'object' },
      },
      estimatedCost: { type: 'number' },
      successProbability: { type: 'number' },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('planning', { plan: [], estimatedCost: 0, successProbability: 0.1 }, 0.1, 'Planning fallback', 0.1),
  enabled: true,
  priority: 0.7,
  budgetCost: 0.4,
  maxConcurrency: 3,
  timeoutMs: 30000,
};

/** 8. Evaluation Faculty - assesses outcomes */
export const evaluationSpec: FacultySpec = {
  name: 'evaluation',
  description: 'Evaluates outcomes and assigns credit/blame',
  category: 'evaluation',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      secondary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          evaluationType: { type: 'string', enum: ['outcome', 'process', 'counterfactual'] },
          metrics: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      score: { type: 'number' },
      breakdown: { type: 'object' },
      confidence: { type: 'number' },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('evaluation', { score: 0, breakdown: {}, confidence: 0.1 }, 0.1, 'Evaluation fallback', 0.1),
  enabled: true,
  priority: 0.6,
  budgetCost: 0.2,
  maxConcurrency: 5,
  timeoutMs: 10000,
};

/** 9. Communication Faculty - generates natural language */
export const communicationSpec: FacultySpec = {
  name: 'communication',
  description: 'Generates natural language from formal representations',
  category: 'communication',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          targetLanguage: { type: 'string' },
          style: { type: 'string' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      confidence: { type: 'number' },
    },
  },
  oracleOperation: 'lm.generateText',
  fallback: createFallback('communication', { text: '', confidence: 0.1 }, 0.1, 'Communication fallback', 0.1),
  enabled: true,
  priority: 0.8,
  budgetCost: 0.15,
  maxConcurrency: 10,
  timeoutMs: 5000,
};

/** 10. Governance Faculty - self-governance decisions */
export const governanceSpec: FacultySpec = {
  name: 'governance',
  description: 'Makes governance decisions about system modifications',
  category: 'governance',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          decisionType: { type: 'string', enum: ['approve', 'reject', 'defer', 'modify'] },
          riskLevel: { type: 'number' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      decision: { type: 'string' },
      rationale: { type: 'string' },
      conditions: { type: 'array', items: { type: 'object' } },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('governance', { decision: 'defer', rationale: 'Insufficient evidence', conditions: [] }, 0.05, 'Governance fallback', 0.05),
  enabled: true,
  priority: 0.9,
  budgetCost: 0.3,
  maxConcurrency: 2,
  timeoutMs: 20000,
};

/** 11. Perceive Formalize Faculty - NL to formal conversion */
export const perceiveFormalizeSpec: FacultySpec = {
  name: 'perceive.formalize',
  description: 'Converts natural language to formal Narsese terms',
  category: 'perception',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'string' },
      context: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['nl-to-formal', 'formal-to-nl'] },
          domain: { type: 'string' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      term: { type: 'object' },
      confidence: { type: 'number' },
      alternatives: { type: 'array', items: { type: 'object' } },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('perceive.formalize', { term: null, confidence: 0.1, alternatives: [] }, 0.1, 'Formalization fallback', 0.1),
  enabled: true,
  priority: 0.95,
  budgetCost: 0.1,
  maxConcurrency: 20,
  timeoutMs: 3000,
};

/** 12. Propose Action Faculty - proposes actions */
export const proposeActionSpec: FacultySpec = {
  name: 'propose.action',
  description: 'Proposes concrete actions for the current situation',
  category: 'action',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          actionSpace: { type: 'array', items: { type: 'string' } },
          constraints: { type: 'array', items: { type: 'object' } },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            expectedOutcome: { type: 'object' },
            confidence: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('propose.action', { actions: [] }, 0.15, 'Action proposal fallback', 0.15),
  enabled: true,
  priority: 0.7,
  budgetCost: 0.2,
  maxConcurrency: 5,
  timeoutMs: 10000,
};

/** 13. Propose Hypothesis Faculty - proposes hypotheses */
export const proposeHypothesisSpec: FacultySpec = {
  name: 'propose.hypothesis',
  description: 'Proposes explanatory hypotheses for observations',
  category: 'reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          maxHypotheses: { type: 'number' },
          domain: { type: 'string' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      hypotheses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            hypothesis: { type: 'object' },
            confidence: { type: 'number' },
            testable: { type: 'boolean' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('propose.hypothesis', { hypotheses: [] }, 0.15, 'Hypothesis proposal fallback', 0.15),
  enabled: true,
  priority: 0.6,
  budgetCost: 0.3,
  maxConcurrency: 3,
  timeoutMs: 15000,
};

/** 14. Propose Repair Faculty - proposes repairs */
export const proposeRepairSpec: FacultySpec = {
  name: 'propose.repair',
  description: 'Proposes repairs for detected issues or failures',
  category: 'meta',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          issueType: { type: 'string' },
          severity: { type: 'number' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      repairs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            estimatedCost: { type: 'number' },
            successProbability: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('propose.repair', { repairs: [] }, 0.1, 'Repair proposal fallback', 0.1),
  enabled: true,
  priority: 0.6,
  budgetCost: 0.3,
  maxConcurrency: 3,
  timeoutMs: 20000,
};

/** 15. Propose Plan Faculty - proposes plans */
export const proposePlanSpec: FacultySpec = {
  name: 'propose.plan',
  description: 'Proposes multi-step plans for goal achievement',
  category: 'planning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          horizon: { type: 'number' },
          resources: { type: 'object' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      plans: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            steps: { type: 'array', items: { type: 'object' } },
            estimatedDuration: { type: 'number' },
            successProbability: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('propose.plan', { plans: [] }, 0.1, 'Plan proposal fallback', 0.1),
  enabled: true,
  priority: 0.6,
  budgetCost: 0.4,
  maxConcurrency: 2,
  timeoutMs: 30000,
};

/** 16. Propose Skill Faculty - proposes new skills */
export const proposeSkillSpec: FacultySpec = {
  name: 'propose.skill',
  description: 'Proposes new skills or capabilities to acquire',
  category: 'learning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          skillType: { type: 'string' },
          difficulty: { type: 'number' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      skills: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            prerequisites: { type: 'array', items: { type: 'string' } },
            estimatedEffort: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('propose.skill', { skills: [] }, 0.05, 'Skill proposal fallback', 0.05),
  enabled: true,
  priority: 0.4,
  budgetCost: 0.5,
  maxConcurrency: 2,
  timeoutMs: 60000,
};

/** 17. Retrieve Rerank Faculty - retrieves and reranks */
export const retrieveRerankSpec: FacultySpec = {
  name: 'retrieve.rerank',
  description: 'Retrieves relevant knowledge and reranks by relevance',
  category: 'memory',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          maxResults: { type: 'number' },
          rerankModel: { type: 'string' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            item: { type: 'object' },
            score: { type: 'number' },
            source: { type: 'string' },
          },
        },
      },
    },
  },
  oracleOperation: 'retrieval.query',
  fallback: createFallback('retrieve.rerank', { results: [] }, 0.2, 'Retrieve/rerank fallback', 0.2),
  enabled: true,
  priority: 0.8,
  budgetCost: 0.15,
  maxConcurrency: 10,
  timeoutMs: 5000,
};

/** 18. Judge Rubric Faculty - evaluates against rubric */
export const judgeRubricSpec: FacultySpec = {
  name: 'judge.rubric',
  description: 'Evaluates candidates against a structured rubric',
  category: 'evaluation',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      secondary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          rubric: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                weight: { type: 'number' },
              },
            },
          },
        },
      },
    },
    required: ['primary', 'secondary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      scores: { type: 'object' },
      overall: { type: 'number' },
      passed: { type: 'boolean' },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('judge.rubric', { scores: {}, overall: 0, passed: false }, 0.1, 'Rubric judge fallback', 0.1),
  enabled: true,
  priority: 0.7,
  budgetCost: 0.25,
  maxConcurrency: 3,
  timeoutMs: 15000,
};

/** 19. Narrate Explain Faculty - generates explanations */
export const narrateExplainSpec: FacultySpec = {
  name: 'narrate.explain',
  description: 'Generates natural language explanations for decisions',
  category: 'communication',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          audience: { type: 'string' },
          detailLevel: { type: 'string' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      explanation: { type: 'string' },
      confidence: { type: 'number' },
      keyPoints: { type: 'array', items: { type: 'string' } },
    },
  },
  oracleOperation: 'lm.generateText',
  fallback: createFallback('narrate.explain', { explanation: '', confidence: 0.1, keyPoints: [] }, 0.1, 'Explanation fallback', 0.1),
  enabled: true,
  priority: 0.7,
  budgetCost: 0.2,
  maxConcurrency: 5,
  timeoutMs: 10000,
};

/** 20. Mirror Postmortem Faculty - retrospective analysis */
export const mirrorPostmortemSpec: FacultySpec = {
  name: 'mirror.postmortem',
  description: 'Performs retrospective analysis on past decisions',
  category: 'meta',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          timeWindow: { type: 'number' },
          focus: { type: 'string' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      insights: {
        type: 'array',
        items: { type: 'object' },
      },
      lessons: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('mirror.postmortem', { insights: [], lessons: [], recommendations: [] }, 0.05, 'Postmortem fallback', 0.05),
  enabled: true,
  priority: 0.3,
  budgetCost: 0.4,
  maxConcurrency: 2,
  timeoutMs: 60000,
};

/** 21. Simulate Scenario Faculty - runs simulations */
export const simulateScenarioSpec: FacultySpec = {
  name: 'simulate.scenario',
  description: 'Simulates scenarios to predict outcomes',
  category: 'planning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          scenarioType: { type: 'string' },
          iterations: { type: 'number' },
          variables: { type: 'object' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      scenarios: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            outcome: { type: 'object' },
            probability: { type: 'number' },
            trace: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('simulate.scenario', { scenarios: [] }, 0.05, 'Simulation fallback', 0.05),
  enabled: true,
  priority: 0.5,
  budgetCost: 0.5,
  maxConcurrency: 2,
  timeoutMs: 60000,
};

/** All 20 faculty specifications in registration order. */
export const CORE_FACULTIES = [
  groundingSpec,
  inferenceSpec,
  abductionSpec,
  inductionSpec,
  analogySpec,
  revisionSpec,
  planningSpec,
  evaluationSpec,
  communicationSpec,
  governanceSpec,
  perceiveFormalizeSpec,
  proposeActionSpec,
  proposeHypothesisSpec,
  proposeRepairSpec,
  proposePlanSpec,
  proposeSkillSpec,
  retrieveRerankSpec,
  judgeRubricSpec,
  narrateExplainSpec,
  mirrorPostmortemSpec,
  simulateScenarioSpec,
] as const;