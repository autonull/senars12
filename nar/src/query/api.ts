import { createLogger } from '@senars/util';
import type { Concept } from '../memory';
import type { Term } from '../terms';
import { hasVariable, Truth, termParser, termsEqual, unify, termKey } from '../terms';
import { byRelevance, type RelevanceOptions } from './relevance.js';
import type { Stamp, Task, TaskType, TermFilter, Timestamp } from '../types';
import { createTaskWeight, createTask, createTimestamp } from '../types';
import type { DerivationRecord } from '@senars/core/schemas';
import { verifyRecord } from '@senars/core/verify-derivation';

const logger = createLogger({ scope: 'QueryAPI' });

export interface QueryResult {
  beliefs: Task[];
  questions: Task[];
  concepts: Concept[];
}

export interface Answer {
  question: string;
  answer?: string;
  /**
   * The belief's truth as a **pair**. This is the answer's epistemic content:
   * `f` is how true it is, `c` is how much the estimate is worth.
   *
   * It was a bare `confidence: number` holding `f * c`, which is a third
   * quantity — neither `c` nor `Truth.expectation` (`c*(f-0.5)+0.5`) — and it
   * is lossy in the one direction that matters. `(f=0.50, c=0.90)` and
   * `(f=0.45, c=1.00)` both reported `0.45`, so "I do not know this" and "I am
   * certain it is false" were indistinguishable at the read surface. For a
   * system whose claim is that it separates belief from ignorance, that is the
   * wrong place to lose the distinction.
   */
  truth?: Truth;
  /**
   * Signed, centred on 0.5, derived from `truth` — never stored. A caller that
   * needs one number reads `Truth.expectation(answer.truth)`; a caller that
   * needs to know whether the system knows anything reads the pair.
   */
  readonly confidence?: number;
  evidence: Task[];
  derivationPath?: string[];
  derivation?: VerifiedDerivation;
}

export interface VerifiedDerivation {
  record: DerivationRecord;
  verification: {
    ok: boolean;
    errors: string[];
    truthVerified: number;
    truthSkipped: number;
  };
}

export interface MemoryRef {
  getConcept: (term: Term) => Concept | undefined;
  findSimilarConcepts: (term: Term, limit?: number) => Concept[];
  listConcepts: () => Concept[];
}

export class QueryAPI {
  private readonly memory: MemoryRef;

  constructor(memory: MemoryRef) {
    this.memory = memory;
  }

  getBeliefs(filter?: TermFilter): Task[] {
    return this.queryByType('belief', filter);
  }

  getGoals(filter?: TermFilter): Task[] {
    return this.queryByType('goal', filter);
  }

  getQuestions(filter?: TermFilter): Task[] {
    return this.queryByType('question', filter);
  }

  /**
   * Beliefs ordered by relevance to the open questions and goals. A read-path
   * ranking over an unchanged store (TODO30 §1.2 option B): the same derivation
   * set, in the order a reader cares about.
   */
  getRelevantBeliefs(
    focus: readonly Term[],
    options?: Omit<RelevanceOptions, 'focus'>
  ): Task[] {
    return this.limitResults(byRelevance(this.getBeliefs(), { ...options, focus }));
  }

  query(term: Term, filter?: Omit<TermFilter, 'pattern'>): QueryResult {
    const concepts = this.memory.findSimilarConcepts(term);
    const beliefs: Task[] = [];
    const questions: Task[] = [];

    for (const concept of concepts) {
      if (concept.beliefBag.size() > 0) {
        const beliefTasks = this.extractTasks(concept, 'belief');
        beliefs.push(...this.applyFilters(beliefTasks, filter));
      }
      if (concept.questionBag && concept.questionBag.size() > 0) {
        questions.push(...this.extractTasks(concept, 'question'));
      }
    }

    return {
      beliefs: this.limitResults(beliefs, filter?.limit),
      questions: this.limitResults(questions, filter?.limit),
      concepts,
    };
  }

  async ask(question: string | Term): Promise<Answer> {
    const questionStr = typeof question === 'string' ? question : question.toString();
    const questionTerm = typeof question === 'string' ? this.parseQuestion(question) : question;

    if (!questionTerm) {
      return { question: questionStr, confidence: 0, evidence: [] };
    }

    // An answer is the asked term, or — when the asked term carries variables
    // and therefore names none — a ground instance of it. Never a neighbour
    // that merely looks similar: TODO30 §0.2 measured that answering a question
    // the system cannot with one it can, at high confidence.
    const exact = this.findConceptByTerm(questionTerm);
    if (exact) {
      const answer = this.tryAnswer(questionTerm, exact);
      if (answer) return answer;
    }

    const neighbours = this.memory.findSimilarConcepts(questionTerm, 5);
    const adjacent = neighbours.flatMap((concept) => this.evidenceFor(concept));
    const grounded = hasVariable(questionTerm)
      ? neighbours.find((concept) => concept.beliefBag.peek()?.truth && unify(questionTerm, concept.term))
      : undefined;
    const belief = grounded?.beliefBag.peek();

    return belief?.truth
      ? {
          question: questionStr,
          answer: grounded?.term.toString(),
          truth: belief.truth,
          evidence: adjacent,
          derivationPath: this.extractDerivationPath(belief.stamp),
        }
      : { question: questionStr, evidence: adjacent };
  }

  private findConceptByTerm(term: Term): Concept | undefined {
    for (const concept of this.memory.listConcepts()) {
      if (termsEqual(concept.term, term)) return concept;
    }
    return undefined;
  }

  private tryAnswer(question: Term, concept: Concept): Answer | null {
    const belief = concept.beliefBag.peek();
    if (!belief?.truth) return null;
    // Refuse on the pair, not on the product: an almost-certain negative
    // (`f≈0.45, c=1.0`) and a confident non-answer both scored low before, but
    // only one of them is an answer.
    if (Truth.expectation(belief.truth) <= 0.5) return null;
    return {
      question: question.toString(),
      answer: question.toString(),
      truth: belief.truth,
      evidence: [this.createTaskFromBelief(concept.term, belief, concept.priority)],
      derivationPath: this.extractDerivationPath(belief.stamp),
    };
  }

  private evidenceFor(concept: Concept): Task[] {
    const belief = concept.beliefBag.peek();
    return belief?.truth
      ? [this.createTaskFromBelief(concept.term, belief, concept.priority)]
      : [];
  }

  private createTaskFromBelief(
    term: Term,
    belief: {
      truth?: { f: number; c: number };
      stamp?: Stamp;
    },
    priority: number
  ): Task {
    return createTask(
      term,
      'belief',
      belief.truth ? Truth.create(belief.truth.f, belief.truth.c) : Truth.NEUTRAL,
      createTaskWeight(priority),
      { ...(belief.stamp ? { stamp: belief.stamp } : {}), occurrenceTime: createTimestamp(0) }
    );
  }
  private extractDerivationPath(stamp?: Stamp): string[] {
    const path: string[] = [];
    let currentStamp: Stamp | undefined = stamp;

    while (currentStamp && path.length < 10) {
      path.push(currentStamp.id);
      const derivations = currentStamp.derivations;
      if (!derivations || derivations.length === 0) break;
      currentStamp = undefined;
    }

    return path;
  }

  private parseQuestion(question: string): Term | null {
    try {
      if (question.includes('-->') || question.includes('<->') || question.includes('=>')) {
        return termParser.parse(question);
      }
      return null;
    } catch (error) {
      logger.warn(`Failed to parse question: ${question} - ${error}`);
      return null;
    }
  }

  private queryByType(type: TaskType, filter?: TermFilter): Task[] {
    const tasks = this.memory.listConcepts().flatMap((concept) => this.extractTasks(concept, type));
    return this.limitResults(this.applyFilters(tasks, filter), filter?.limit);
  }

  private extractTasks(concept: Concept, type: TaskType): Task[] {
    const bag =
      type === 'belief'
        ? concept.beliefBag
        : type === 'goal'
          ? concept.goalBag
          : type === 'question'
            ? concept.questionBag
            : null;
    if (!bag) return [];

    return bag.toArray().map((item) =>
      createTask(
        concept.term,
        type,
        item.truth ?? Truth.NEUTRAL,
        item.budget ?? createTaskWeight(concept.priority),
        {
          stamp: item.stamp,
          occurrenceTime: (item.occurrenceTime || Date.now()) as Timestamp,
          derived: item.derived ?? false,
        }
      )
    );
  }

  private applyFilters(tasks: Task[], filter?: TermFilter): Task[] {
    if (!filter) return tasks;

    return tasks.filter((task) => {
      if (filter.truthRange) {
        const [min, max] = filter.truthRange;
        const confidence = task.truth.f * task.truth.c;
        if (confidence < min || confidence > max) return false;
      }
      if (filter.recency && Date.now() - task.occurrenceTime > filter.recency) return false;
      if (filter.type && task.type !== filter.type) return false;
      return true;
    });
  }

  private matchesPattern(task: Task, pattern: string): boolean {
    const parsed = termParser.parse(pattern);
    return parsed ? termsEqual(task.term, parsed) : task.term.toString() === pattern;
  }

  private limitResults(tasks: Task[], limit?: number): Task[] {
    if (!limit || limit >= tasks.length) return tasks;
    return tasks.slice(0, limit);
  }
}

export const createQueryAPI = (memory: MemoryRef): QueryAPI => {
  return new QueryAPI(memory);
};
