/**
 * Faculty Specifications — the 10 core faculty definitions.
 *
 * Each faculty is a named capability with a specific input/output contract.
 * Faculties are invoked through the oracle seam for deterministic replay.
 */

import type { Term } from '../kernel/terms/term';
import type { Task } from '../kernel/types';
import type { Truth } from '../kernel/truth';
import type { OracleOperation } from '../oracles/oracle';
import { NameRegistry } from '../util/registry';

/** Faculty categories. */
export const FACULTY_CATEGORIES = [
  'perception',
  'reasoning',
  'memory',
  'action',
  'learning',
  'communication',
  'planning',
  'evaluation',
  'meta',
  'governance',
] as const;

export type FacultyCategory = (typeof FACULTY_CATEGORIES)[number];

/** The 18 core faculties (10 original + perceive.formalize + 7 LM roles). */
export const FACULTIES = [
  'grounding',
  'inference',
  'abduction',
  'induction',
  'analogy',
  'revision',
  'planning',
  'evaluation',
  'communication',
  'governance',
  'perceive.formalize',
  'propose.action',
  'propose.hypothesis',
  'propose.repair',
  'propose.plan',
  'propose.skill',
  'retrieve.rerank',
  'judge.rubric',
  'narrate.explain',
  'mirror.postmortem',
  'simulate.scenario',
] as const;

export type FacultyName = (typeof FACULTIES)[number];

/** Faculty input. */
export interface FacultyInput {
  /** The faculty being invoked. */
  faculty: FacultyName;
  /** Primary term/task. */
  primary: Term | Task;
  /** Secondary term/task (optional). */
  secondary?: Term | Task;
  /** Context for the faculty. */
  context?: FacultyContext;
  /** Budget for this invocation. */
  budget?: number;
  /** Priority. */
  priority?: number;
}

/** Faculty context. */
export interface FacultyContext {
  /** Current truth value. */
  truth?: Truth;
  /** Confidence threshold. */
  confidenceThreshold?: number;
  /** Maximum results. */
  maxResults?: number;
  /** Whether to use fallback. */
  useFallback?: boolean;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
  /** Mode for perceive.formalize faculty. */
  mode?: 'nl-to-formal' | 'formal-to-nl';
}

/** Faculty output. */
export interface FacultyOutput<T = unknown> {
  /** The faculty that produced this output. */
  faculty: FacultyName;
  /** The result value. */
  result: T;
  /** Confidence in the result. */
  confidence: number;
  /** Evidence supporting the result. */
  evidence?: FacultyEvidence[];
  /** Fallback used (if any). */
  fallbackUsed?: boolean;
  /** Duration in ms. */
  durationMs: number;
  /** Oracle call metadata. */
  oracleMeta?: FacultyOracleMeta;
}

/** Faculty evidence. */
export interface FacultyEvidence {
  /** Source of evidence. */
  source: 'oracle' | 'memory' | 'rule' | 'observation' | 'axiom' | 'fallback';
  /** Description. */
  description: string;
  /** Strength of evidence. */
  strength: number;
  /** Oracle call ID if from oracle. */
  oracleCallId?: string;
}

/** Faculty oracle metadata. */
export interface FacultyOracleMeta {
  /** Oracle operation used. */
  operation: OracleOperation;
  /** Oracle call ID. */
  callId: string;
  /** Oracle provider. */
  provider: string;
  /** Whether result was pinned. */
  pinned: boolean;
  /** Duration in milliseconds. */
  durationMs: number;
}

/** Faculty specification. */
export interface FacultySpec {
  /** Faculty name. */
  name: FacultyName;
  /** Human-readable description. */
  description: string;
  /** Category. */
  category: FacultyCategory;
  /** Input schema (Zod schema or JSON schema). */
  inputSchema: unknown;
  /** Output schema (Zod schema or JSON schema). */
  outputSchema: unknown;
  /** Oracle operation this faculty uses. */
  oracleOperation: OracleOperation;
  /** Pure-NAL symbolic fallback. */
  fallback: FacultyFallback;
  /** Whether this faculty is enabled. */
  enabled: boolean;
  /** Priority for selection. */
  priority: number;
  /** Budget cost. */
  budgetCost: number;
  /** Maximum concurrent invocations. */
  maxConcurrency: number;
  /** Timeout in ms. */
  timeoutMs: number;
  /** Retry configuration. */
  retry?: { attempts: number; backoffMs: number };
}

/** Faculty fallback function type. */
export type FacultyFallback = (input: FacultyInput) => Promise<FacultyOutput | null>;

/** Faculty registry. */
export class FacultyRegistry extends NameRegistry<FacultySpec> {
  private fallbacks = new Map<FacultyName, FacultyFallback>();

  constructor() {
    super({ unique: true, duplicateError: (name) => `Faculty ${name} already registered` });
  }

  /** Register a faculty specification. */
  override register(spec: FacultySpec): void {
    super.register(spec);
    if (spec.fallback) {
      this.fallbacks.set(spec.name, spec.fallback);
    }
  }

  /** Get faculties by category. */
  getByCategory(category: FacultyCategory): FacultySpec[] {
    return this.getAll().filter(s => s.category === category);
  }

  /** Get enabled faculties. */
  getEnabled(): FacultySpec[] {
    return this.getAll().filter(s => s.enabled);
  }

  /** Get fallback for a faculty. */
  getFallback(name: FacultyName): FacultyFallback | undefined {
    return this.fallbacks.get(name);
  }
}

/** Create an isolated faculty registry. */
export function createFacultyRegistry(): FacultyRegistry {
  const registry = new FacultyRegistry();
  for (const spec of CORE_FACULTIES) {
    registry.register(spec);
  }
  return registry;
}

/** Global faculty registry (convenience; prefer {@link createFacultyRegistry}). */
export const facultyRegistry = new FacultyRegistry();

/** Register a faculty globally. */
export function registerFaculty(spec: FacultySpec): void {
  facultyRegistry.register(spec);
}

/** The 10 core faculty specifications. */

// 1. Grounding Faculty - connects symbols to referents
export const groundingSpec: FacultySpec = {
  name: 'grounding',
  description: 'Grounds symbols in concrete referents through perception or retrieval',
  category: 'perception',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Term
      secondary: { type: 'object' }, // Term (optional)
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
  fallback: async (input) => ({
    faculty: 'grounding',
    result: { groundings: [] },
    confidence: 0.1,
    evidence: [{ source: 'fallback', description: 'No grounding available', strength: 0.1 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.9,
  budgetCost: 0.1,
  maxConcurrency: 10,
  timeoutMs: 5000,
};

// 2. Inference Faculty - NAL deduction/induction/abduction
export const inferenceSpec: FacultySpec = {
  name: 'inference',
  description: 'Performs NAL inference (deduction, induction, abduction)',
  category: 'reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Task
      secondary: { type: 'object' }, // Task (optional)
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
  fallback: async (input) => ({
    faculty: 'inference',
    result: { conclusions: [] },
    confidence: 0.2,
    evidence: [{ source: 'fallback', description: 'Symbolic inference fallback', strength: 0.2 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.95,
  budgetCost: 0.2,
  maxConcurrency: 5,
  timeoutMs: 10000,
};

// 3. Abduction Faculty - generates hypotheses
export const abductionSpec: FacultySpec = {
  name: 'abduction',
  description: 'Generates explanatory hypotheses for observations',
  category: 'reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Term (observation)
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
  fallback: async (input) => ({
    faculty: 'abduction',
    result: { hypotheses: [] },
    confidence: 0.15,
    evidence: [{ source: 'fallback', description: 'Abductive fallback', strength: 0.15 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.7,
  budgetCost: 0.3,
  maxConcurrency: 3,
  timeoutMs: 15000,
};

// 4. Induction Faculty - generalizes from examples
export const inductionSpec: FacultySpec = {
  name: 'induction',
  description: 'Induces general patterns from specific examples',
  category: 'learning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Term (pattern)
      secondary: { type: 'object' }, // Term (examples)
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
            confidence: { type: 'number' },
            support: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: async (input) => ({
    faculty: 'induction',
    result: { generalizations: [] },
    confidence: 0.15,
    evidence: [{ source: 'fallback', description: 'Inductive fallback', strength: 0.15 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.7,
  budgetCost: 0.3,
  maxConcurrency: 3,
  timeoutMs: 15000,
};

// 5. Analogy Faculty - structural mapping
export const analogySpec: FacultySpec = {
  name: 'analogy',
  description: 'Finds structural analogies between domains',
  category: 'reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Term (source)
      secondary: { type: 'object' }, // Term (target)
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
            mapping: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: async (input) => ({
    faculty: 'analogy',
    result: { mappings: [] },
    confidence: 0.1,
    evidence: [{ source: 'fallback', description: 'Analogical fallback', strength: 0.1 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.6,
  budgetCost: 0.25,
  maxConcurrency: 3,
  timeoutMs: 15000,
};

// 6. Revision Faculty - belief revision
export const revisionSpec: FacultySpec = {
  name: 'revision',
  description: 'Revises beliefs based on new evidence',
  category: 'reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Term (existing belief)
      secondary: { type: 'object' }, // Term (new evidence)
      context: {
        type: 'object',
        properties: {
          revisionStrategy: { type: 'string', enum: ['conservative', 'moderate', 'radical'] },
        },
      },
    },
    required: ['primary', 'secondary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      revised: {
        type: 'object',
        properties: {
          term: { type: 'object' },
          truth: { type: 'object' },
          reason: { type: 'string' },
        },
      },
    },
  },
  oracleOperation: 'engine.z3',
  fallback: async (input) => ({
    faculty: 'revision',
    result: { revised: null },
    confidence: 0.2,
    evidence: [{ source: 'fallback', description: 'Revision fallback', strength: 0.2 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.8,
  budgetCost: 0.2,
  maxConcurrency: 5,
  timeoutMs: 10000,
};

// 7. Planning Faculty - goal decomposition and planning
export const planningSpec: FacultySpec = {
  name: 'planning',
  description: 'Decomposes goals into executable plans',
  category: 'planning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Task (goal)
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
        items: {
          type: 'object',
          properties: {
            step: { type: 'object' },
            precondition: { type: 'object' },
            effect: { type: 'object' },
            cost: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'engine.clingo',
  fallback: async (input) => ({
    faculty: 'planning',
    result: { plan: [] },
    confidence: 0.1,
    evidence: [{ source: 'fallback', description: 'Planning fallback', strength: 0.1 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.8,
  budgetCost: 0.4,
  maxConcurrency: 2,
  timeoutMs: 30000,
};

// 8. Evaluation Faculty - assesses outcomes
export const evaluationSpec: FacultySpec = {
  name: 'evaluation',
  description: 'Evaluates outcomes and assigns value',
  category: 'evaluation',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Term (outcome)
      secondary: { type: 'object' }, // Task (goal)
      context: {
        type: 'object',
        properties: {
          criteria: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    required: ['primary', 'secondary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      evaluation: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          criteria: {
            type: 'object',
            additionalProperties: { type: 'number' },
          },
          passed: { type: 'boolean' },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: async (input) => ({
    faculty: 'evaluation',
    result: { evaluation: { score: 0.5, criteria: {}, passed: false } },
    confidence: 0.3,
    evidence: [{ source: 'fallback', description: 'Evaluation fallback', strength: 0.3 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.75,
  budgetCost: 0.2,
  maxConcurrency: 5,
  timeoutMs: 10000,
};

// 9. Communication Faculty - generates/parses language
export const communicationSpec: FacultySpec = {
  name: 'communication',
  description: 'Translates between Narsese and natural language',
  category: 'communication',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Term or Task
      context: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['to-natural', 'to-narsese'] },
          audience: { type: 'string', enum: ['expert', 'layperson', 'system'] },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      translation: { type: 'string' },
      confidence: { type: 'number' },
    },
  },
  oracleOperation: 'lm.generateText',
  fallback: async (input) => ({
    faculty: 'communication',
    result: { translation: '', confidence: 0.1 },
    confidence: 0.1,
    evidence: [{ source: 'fallback', description: 'Communication fallback', strength: 0.1 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.7,
  budgetCost: 0.15,
  maxConcurrency: 10,
  timeoutMs: 5000,
};

// 10. Governance Faculty - policy compliance and safety
export const governanceSpec: FacultySpec = {
  name: 'governance',
  description: 'Checks policy compliance and safety constraints',
  category: 'governance',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Term or Task
      context: {
        type: 'object',
        properties: {
          policySet: { type: 'string' },
          strictMode: { type: 'boolean' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      compliant: { type: 'boolean' },
      violations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            rule: { type: 'string' },
            severity: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
      recommendations: { type: 'array', items: { type: 'string' } },
    },
  },
  oracleOperation: 'engine.z3',
  fallback: async (input) => ({
    faculty: 'governance',
    result: { compliant: true, violations: [], recommendations: [] },
    confidence: 0.5,
    evidence: [{ source: 'fallback', description: 'Governance fallback (permissive)', strength: 0.5 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 1.0,
  budgetCost: 0.1,
  maxConcurrency: 20,
  timeoutMs: 5000,
};

// 11. Perceive Formalize Faculty - natural language to formal Narsese
export const perceiveFormalizeSpec: FacultySpec = {
  name: 'perceive.formalize',
  description: 'Formalizes natural language or Narsese into perceived interpretations with provenance',
  category: 'perception',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'string' }, // text to formalize
      context: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['nl-to-formal', 'formal-to-nl'] },
          sourceText: { type: 'string' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      interpretation: { type: 'object' }, // PerceivedInterpretation
      translation: { type: 'string' }, // for formal-to-nl
      confidence: { type: 'number' },
    },
  },
  oracleOperation: 'formalization.nlToFormal',
  fallback: async (input) => {
    const { primary, context } = input;
    const text = typeof primary === 'string' ? primary : primary.toString();
    const mode = context?.mode ?? 'nl-to-formal';

    if (mode === 'nl-to-formal') {
      // Use structured formalizer as fallback
      const { StructuredFormalizer } = await import('../nl/formalizer');
      const formalizer = new StructuredFormalizer();
      const interpretation = await formalizer.nlToFormal(text);
      return {
        faculty: 'perceive.formalize',
        result: { interpretation, translation: '', confidence: interpretation.candidates.length > 0 ? 0.8 : 0.1 },
        confidence: interpretation.candidates.length > 0 ? 0.8 : 0.1,
        evidence: [{ source: 'fallback', description: 'Structured formalization fallback', strength: interpretation.candidates.length > 0 ? 0.8 : 0.1 }],
        fallbackUsed: true,
        durationMs: 0,
      };
    } else {
      // formal-to-nl fallback
      const { StructuredFormalizer } = await import('../nl/formalizer');
      const formalizer = new StructuredFormalizer();
      const generationInput = { query: text, derivation: null, beliefs: [], conflicts: [], userProfile: { expertise: 'technical' as const, verbosity: 'concise' as const } };
      const translation = await formalizer.formalToNl(generationInput);
      return {
        faculty: 'perceive.formalize',
        result: { interpretation: null as any, translation: translation.response, confidence: 0.5 },
        confidence: 0.5,
        evidence: [{ source: 'fallback', description: 'Structured generation fallback', strength: 0.5 }],
        fallbackUsed: true,
        durationMs: 0,
      };
    }
  },
  enabled: true,
  priority: 0.95,
  budgetCost: 0.2,
  maxConcurrency: 10,
  timeoutMs: 10000,
};

// 12. Propose Action Faculty - proposes executable actions
export const proposeActionSpec: FacultySpec = {
  name: 'propose.action',
  description: 'Proposes concrete executable actions given a goal and context',
  category: 'action',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Task (goal)
      context: {
        type: 'object',
        properties: {
          legalActions: { type: 'array', items: { type: 'string' } },
          constraints: { type: 'array', items: { type: 'object' } },
          maxProposals: { type: 'number' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      proposals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            confidence: { type: 'number' },
            precondition: { type: 'object' },
            estimatedCost: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: async (input) => ({
    faculty: 'propose.action',
    result: { proposals: [] },
    confidence: 0.1,
    evidence: [{ source: 'fallback', description: 'Action proposal fallback', strength: 0.1 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.85,
  budgetCost: 0.3,
  maxConcurrency: 5,
  timeoutMs: 10000,
};

// 13. Propose Hypothesis Faculty - generates explanatory hypotheses
export const proposeHypothesisSpec: FacultySpec = {
  name: 'propose.hypothesis',
  description: 'Generates explanatory hypotheses for observations or anomalies',
  category: 'reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Term (observation)
      secondary: { type: 'object' }, // Term[] (context beliefs)
      context: {
        type: 'object',
        properties: {
          maxHypotheses: { type: 'number' },
          noveltyThreshold: { type: 'number' },
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
            explanation: { type: 'string' },
            confidence: { type: 'number' },
            testable: { type: 'boolean' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: async (input) => ({
    faculty: 'propose.hypothesis',
    result: { hypotheses: [] },
    confidence: 0.15,
    evidence: [{ source: 'fallback', description: 'Hypothesis proposal fallback', strength: 0.15 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.7,
  budgetCost: 0.25,
  maxConcurrency: 3,
  timeoutMs: 15000,
};

// 14. Propose Repair Faculty - suggests fixes for failures
export const proposeRepairSpec: FacultySpec = {
  name: 'propose.repair',
  description: 'Proposes repair strategies for failed operations or contradictions',
  category: 'action',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Task (failed operation)
      secondary: { type: 'object' }, // Term (error/contradiction)
      context: {
        type: 'object',
        properties: {
          failureType: { type: 'string', enum: ['contradiction', 'tool_error', 'timeout', 'resource_exhausted'] },
          maxRepairs: { type: 'number' },
        },
      },
    },
    required: ['primary', 'secondary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      repairs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            strategy: { type: 'string' },
            steps: { type: 'array', items: { type: 'object' } },
            confidence: { type: 'number' },
            riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: async (input) => ({
    faculty: 'propose.repair',
    result: { repairs: [] },
    confidence: 0.1,
    evidence: [{ source: 'fallback', description: 'Repair proposal fallback', strength: 0.1 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.8,
  budgetCost: 0.3,
  maxConcurrency: 3,
  timeoutMs: 15000,
};

// 15. Propose Plan Faculty - decomposes goals into plans
export const proposePlanSpec: FacultySpec = {
  name: 'propose.plan',
  description: 'Decomposes high-level goals into executable multi-step plans',
  category: 'planning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Task (goal)
      context: {
        type: 'object',
        properties: {
          horizon: { type: 'number' },
          availableSkills: { type: 'array', items: { type: 'string' } },
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
        items: {
          type: 'object',
          properties: {
            step: { type: 'object' },
            skill: { type: 'string' },
            precondition: { type: 'object' },
            effect: { type: 'object' },
            estimatedCost: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'engine.clingo',
  fallback: async (input) => ({
    faculty: 'propose.plan',
    result: { plan: [] },
    confidence: 0.1,
    evidence: [{ source: 'fallback', description: 'Plan proposal fallback', strength: 0.1 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.8,
  budgetCost: 0.4,
  maxConcurrency: 2,
  timeoutMs: 30000,
};

// 16. Propose Skill Faculty - synthesizes new skills
export const proposeSkillSpec: FacultySpec = {
  name: 'propose.skill',
  description: 'Synthesizes new reusable skills from successful patterns',
  category: 'learning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Term (pattern/episodes)
      context: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          examples: { type: 'array', items: { type: 'object' } },
        },
      },
    },
    required: ['primary', 'context'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      skill: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          dsl: { type: 'string' },
          preconditions: { type: 'array', items: { type: 'object' } },
          effects: { type: 'array', items: { type: 'object' } },
          confidence: { type: 'number' },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: async (input) => ({
    faculty: 'propose.skill',
    result: { skill: null },
    confidence: 0.05,
    evidence: [{ source: 'fallback', description: 'Skill proposal fallback', strength: 0.05 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.5,
  budgetCost: 0.5,
  maxConcurrency: 1,
  timeoutMs: 60000,
};

// 17. Retrieve Rerank Faculty - reranks retrieval results
export const retrieveRerankSpec: FacultySpec = {
  name: 'retrieve.rerank',
  description: 'Reranks retrieval candidates using learned relevance',
  category: 'memory',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'array', items: { type: 'object' } }, // candidates
      secondary: { type: 'object' }, // Term (query)
      context: {
        type: 'object',
        properties: {
          topK: { type: 'number' },
          useEmbeddings: { type: 'boolean' },
        },
      },
    },
    required: ['primary', 'secondary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      reranked: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            candidate: { type: 'object' },
            score: { type: 'number' },
            reason: { type: 'string' },
          },
        },
      },
    },
  },
  oracleOperation: 'embedding.rerank',
  fallback: async (input) => ({
    faculty: 'retrieve.rerank',
    result: { reranked: input.primary },
    confidence: 0.3,
    evidence: [{ source: 'fallback', description: 'Identity rerank fallback', strength: 0.3 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.75,
  budgetCost: 0.2,
  maxConcurrency: 10,
  timeoutMs: 5000,
};

// 18. Judge Rubric Faculty - evaluates against rubric criteria
export const judgeRubricSpec: FacultySpec = {
  name: 'judge.rubric',
  description: 'Evaluates candidates against a structured rubric using LM judgment',
  category: 'evaluation',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'array', items: { type: 'object' } }, // candidates
      secondary: { type: 'object' }, // Term (rubric criteria)
      context: {
        type: 'object',
        properties: {
          rubricName: { type: 'string' },
          criteria: { type: 'array', items: { type: 'object' } },
          calibrationVersion: { type: 'string' },
        },
      },
    },
    required: ['primary', 'secondary', 'context'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      judgments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            candidate: { type: 'object' },
            scores: { type: 'object', additionalProperties: { type: 'number' } },
            overall: { type: 'number' },
            rationale: { type: 'string' },
            calibrated: { type: 'boolean' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: async (input) => {
    const candidates = Array.isArray(input.primary) ? input.primary : [];
    return {
      faculty: 'judge.rubric',
      result: { judgments: candidates.map((c: any) => ({ candidate: c, overall: 0.5, calibrated: false })) },
      confidence: 0.2,
      evidence: [{ source: 'fallback', description: 'Rubric judgment fallback', strength: 0.2 }],
      fallbackUsed: true,
      durationMs: 0,
    };
  },
  enabled: true,
  priority: 0.9,
  budgetCost: 0.35,
  maxConcurrency: 3,
  timeoutMs: 20000,
};

// 19. Narrate Explain Faculty - generates explanations
export const narrateExplainSpec: FacultySpec = {
  name: 'narrate.explain',
  description: 'Generates natural language explanations for decisions or beliefs',
  category: 'communication',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' }, // Term or Task to explain
      context: {
        type: 'object',
        properties: {
          audience: { type: 'string', enum: ['expert', 'layperson', 'system'] },
          verbosity: { type: 'string', enum: ['concise', 'standard', 'verbose'] },
          includeEvidence: { type: 'boolean' },
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
      evidence: { type: 'array', items: { type: 'object' } },
    },
  },
  oracleOperation: 'lm.generateText',
  fallback: async (input) => ({
    faculty: 'narrate.explain',
    result: { explanation: '', confidence: 0.1, evidence: [] },
    confidence: 0.1,
    evidence: [{ source: 'fallback', description: 'Explanation fallback', strength: 0.1 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.7,
  budgetCost: 0.15,
  maxConcurrency: 10,
  timeoutMs: 10000,
};

// 20. Mirror Postmortem Faculty - analyzes past episodes
export const mirrorPostmortemSpec: FacultySpec = {
  name: 'mirror.postmortem',
  description: 'Analyzes past episodes to extract lessons and patterns',
  category: 'meta',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'array', items: { type: 'object' } }, // episodes
      context: {
        type: 'object',
        properties: {
          focus: { type: 'string', enum: ['failure', 'success', 'pattern', 'all'] },
          timeWindow: { type: 'number' },
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
        items: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            frequency: { type: 'number' },
            lesson: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: async (input) => ({
    faculty: 'mirror.postmortem',
    result: { insights: [] },
    confidence: 0.1,
    evidence: [{ source: 'fallback', description: 'Postmortem fallback', strength: 0.1 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.6,
  budgetCost: 0.4,
  maxConcurrency: 2,
  timeoutMs: 30000,
};

// 21. Simulate Scenario Faculty - runs internal simulations
export const simulateScenarioSpec: FacultySpec = {
  name: 'simulate.scenario',
  description: 'Runs internal scenario simulations using imagination engine',
  category: 'reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'string' }, // scenario seed/intent
      context: {
        type: 'object',
        properties: {
          profile: { type: 'string' },
          steps: { type: 'number' },
          injectEpisodes: { type: 'boolean' },
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
            spec: { type: 'object' },
            result: { type: 'object' },
            reward: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'imagination.generate',
  fallback: async (input) => ({
    faculty: 'simulate.scenario',
    result: { scenarios: [] },
    confidence: 0.05,
    evidence: [{ source: 'fallback', description: 'Simulation fallback', strength: 0.05 }],
    fallbackUsed: true,
    durationMs: 0,
  }),
  enabled: true,
  priority: 0.5,
  budgetCost: 0.5,
  maxConcurrency: 2,
  timeoutMs: 60000,
};

/** The eighteen core faculty specifications, in registration order. */
export const CORE_FACULTIES: readonly FacultySpec[] = [
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
];

/** Register all core faculties, into `registry` (global by default). */
export function registerCoreFaculties(registry: FacultyRegistry = facultyRegistry): void {
  for (const spec of CORE_FACULTIES) registry.register(spec);
}