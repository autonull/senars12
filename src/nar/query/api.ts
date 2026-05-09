import type {Term} from '../terms';
import type {Task, TaskType, TermFilter} from '../types';
import type {Concept} from '../memory';

export interface QueryResult {
    beliefs: Task[];
    questions: Task[];
    concepts: Concept[];
}

export interface Answer {
    question: string;
    answer?: string;
    confidence: number;
    evidence: Task[];
    derivationPath?: string[];
}

export class QueryAPI {
    private readonly memory: any;

    constructor(memory: any) {
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

    query(term: Term, filter?: Omit<TermFilter, 'pattern'>): QueryResult {
        const concepts = this.memory.getRelatedConcepts(term);
        const beliefs: Task[] = [];
        const questions: Task[] = [];

        for (const concept of concepts) {
            if (concept.beliefBag.size > 0) {
                const beliefTasks = this.extractTasks(concept, 'belief');
                beliefs.push(...this.applyFilters(beliefTasks, filter));
            }
            if (concept.questionBag && concept.questionBag.size > 0) {
                questions.push(...this.extractTasks(concept, 'question'));
            }
        }

        return {
            beliefs: this.limitResults(beliefs, filter?.limit),
            questions: this.limitResults(questions, filter?.limit),
            concepts
        };
    }

  async ask(question: string | Term): Promise<Answer> {
    const questionStr = typeof question === 'string' ? question : question.toString();
    const questionTerm = typeof question === 'string' ? this.parseQuestion(question) : question;

    if (!questionTerm) {
      return {
        question: questionStr,
        confidence: 0,
        evidence: []
      };
    }

    const concept = this.memory.getConcept(questionTerm);
    if (concept) {
      const belief = concept.beliefBag.peek();
      if (belief?.truth) {
        const confidence = belief.truth.f * belief.truth.c;
        if (confidence >= 0.5) {
          const task: Task = {
            term: questionTerm,
            type: 'belief',
            truth: belief.truth,
            budget: {priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
            stamp: (belief as any).stamp ?? {id: '', creationTime: 0, source: 'INPUT' as const, derivations: [], depth: 0},
            occurrenceTime: 0,
            derived: false
          };

          return {
            question: questionStr,
            answer: questionTerm.toString(),
            confidence,
            evidence: [task],
            derivationPath: this.extractDerivationPath(task)
          };
        }
      }
    }

    const relatedConcepts = this.memory.getRelatedConcepts(questionTerm);
    for (const related of relatedConcepts.slice(0, 5)) {
      const belief = related.beliefBag.peek();
      if (belief?.truth) {
        const confidence = belief.truth.f * belief.truth.c;
        if (confidence >= 0.5) {
          const task: Task = {
            term: related.term,
            type: 'belief',
            truth: belief.truth,
            budget: {priority: related.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
            stamp: (belief as any).stamp ?? {id: '', creationTime: 0, source: 'INPUT' as const, derivations: [], depth: 0},
            occurrenceTime: 0,
            derived: false
          };

          return {
            question: questionStr,
            answer: related.term.toString(),
            confidence,
            evidence: [task],
            derivationPath: this.extractDerivationPath(task)
          };
        }
      }
    }

    return {
      question: questionStr,
      confidence: 0,
      evidence: []
    };
  }

  private parseQuestion(question: string): Term | null {
    try {
      if (question.includes('-->') || question.includes('<->') || question.includes('=>')) {
        const {termParser} = require('../terms/parser.js');
        return termParser.parse(question);
      }
      return null;
    } catch {
      return null;
    }
  }

    private queryByType(type: TaskType, filter?: TermFilter): Task[] {
        const tasks: Task[] = [];
        const concepts = this.memory.listConcepts();

        for (const concept of concepts) {
            const extracted = this.extractTasks(concept, type);
            tasks.push(...extracted);
        }

        return this.limitResults(this.applyFilters(tasks, filter), filter?.limit);
    }

    private extractTasks(concept: Concept, type: TaskType): Task[] {
        const tasks: Task[] = [];
        const bag = type === 'belief' ? concept.beliefBag :
            type === 'goal' ? concept.goalBag :
                type === 'question' ? concept.questionBag : null;

        if (bag) {
            for (const item of bag.toArray()) {
                tasks.push({
                    term: concept.term,
                    type,
                    truth: item.truth,
                    budget: item.budget,
                    stamp: (item as any).stamp,
                    occurrenceTime: (item as any).occurrenceTime || Date.now(),
                    derived: (item as any).derived || false
                } as Task);
            }
        }

        return tasks;
    }

    private applyFilters(tasks: Task[], filter?: TermFilter): Task[] {
        if (!filter) return tasks;

        return tasks.filter(task => {
            if (filter.pattern && !this.matchesPattern(task, filter.pattern.toString())) {
                return false;
            }

            if (filter.truthRange) {
                const [min, max] = filter.truthRange;
                const confidence = task.truth.f * task.truth.c;
                if (confidence < min || confidence > max) {
                    return false;
                }
            }

            if (filter.recency) {
                const now = Date.now();
                if (now - task.occurrenceTime > filter.recency) {
                    return false;
                }
            }

            if (filter.type && task.type !== filter.type) {
                return false;
            }

            return true;
        });
    }

    private matchesPattern(task: Task, pattern: string): boolean {
        return task.term.toString() === pattern;
    }

    private limitResults(tasks: Task[], limit?: number): Task[] {
        if (!limit || limit >= tasks.length) return tasks;
        return tasks.slice(0, limit);
    }

    private extractDerivationPath(task: Task): string[] {
        const path: string[] = [];
        let currentStamp = task.stamp;

        while (currentStamp && path.length < 10) {
            path.push(currentStamp.id);
            if (!currentStamp.derivations || currentStamp.derivations.length === 0) {
                break;
            }
            break;
        }

        return path;
    }
}

export const createQueryAPI = (memory: any): QueryAPI => {
    return new QueryAPI(memory);
};
