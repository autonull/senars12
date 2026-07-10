import type { NAR } from '../..';
import type { NLGenerationService } from '../../nl';
import { containsSubterm, getSubject } from '../../terms';

export class NarQueryService {
  constructor(
    private nar: NAR | undefined,
    private generationService: NLGenerationService | undefined
  ) {}

  async explainBelief(term: string) {
    return this.explainTerm(term);
  }

  async explainGoal(term: string) {
    return this.explainTerm(term);
  }

  async traceRule(ruleId: string, term: string) {
    if (!this.nar) return null;
    const rule = this.nar.getProcessor().getLMRule?.(ruleId);
    if (!rule) return null;
    return {
      ruleName: rule.name,
      input: term,
      output: '',
      confidence: 0,
    };
  }

  async getGoalProgress(goalId: string) {
    if (!this.nar) return null;
    const goals = this.nar.getGoals?.() ?? [];
    const goal = goals.find(
      (g) => g.term.toString() === goalId || g.term.toString().includes(goalId)
    );
    if (!goal) return null;
    const beliefs = this.nar.getBeliefs?.() ?? [];
    const goalSubject = getSubject(goal.term);
    const relatedBeliefs = goalSubject
      ? beliefs.filter((b) => containsSubterm(b.term, goalSubject))
      : [];
    const progress = Math.min(1, relatedBeliefs.length / Math.max(1, goals.length));
    const status: 'completed' | 'active' | 'failed' = progress >= 1 ? 'completed' : 'active';
    return {
      goalId,
      progress: Math.round(progress * 100) / 100,
      status,
      subgoals: [] as string[],
    };
  }

  async listActiveGoals() {
    if (!this.nar) return [];
    const goals = this.nar.getGoals?.() ?? [];
    const beliefs = this.nar.getBeliefs?.() ?? [];
    return goals.map((g) => {
      const goalSubject = getSubject(g.term);
      const relatedBeliefs = goalSubject
        ? beliefs.filter((b) => containsSubterm(b.term, goalSubject))
        : [];
      const progress = Math.min(1, relatedBeliefs.length / Math.max(1, goals.length));
      const status = progress >= 1 ? 'completed' : progress > 0 ? 'active' : 'active';
      return {
        goalId: g.term.toString(),
        term: g.term.toString(),
        progress: Math.round(progress * 100) / 100,
        status,
      };
    });
  }

  async explainInNaturalLanguage(term: string) {
    if (!this.nar || !this.generationService) return null;
    try {
      const { termParser } = await import('../../terms/index.js');
      const parsed = termParser.parse(term);
      if (!parsed) return null;
      const result = this.nar.query.query(parsed, { truthRange: [0, 1], limit: 5 });
      if (!result.beliefs.length) return null;
      const genInput = {
        query: `Explain: ${term}`,
        derivation: null,
        beliefs: result.beliefs.map((b: any) => ({
          term: b.term.toString(),
          truth: b.truth ? { frequency: b.truth.f, confidence: b.truth.c } : undefined,
        })),
        conflicts: [],
      };
      const output = await this.generationService.generate(genInput);
      return output.response;
    } catch {
      return null;
    }
  }

  private async explainTerm(term: string) {
    if (!this.nar) return null;
    const { termParser } = await import('../../terms/index.js');
    const parsed = termParser.parse(term);
    if (!parsed) return null;
    const result = this.nar.query.query(parsed, { truthRange: [0, 1], limit: 1 });
    if (!result.beliefs.length) return null;
    const item = result.beliefs[0]!;
    return {
      explanation: item.term.toString(),
      confidence: item.truth?.c ?? 0,
      premises: [item.term.toString()],
    };
  }
}
