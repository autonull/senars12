import type {NAR} from '../nar/nar.js';
import type {Belief, CognitiveSnapshot, ContextOptions} from './types.js';

export class CognitiveContextBuilder {
  constructor(private readonly nar: NAR) {}

  async buildContext(options: ContextOptions = {}): Promise<string> {
    const snapshot = this.buildSnapshot(options);
    return this.formatContext(snapshot);
  }

  private buildSnapshot(options: ContextOptions): CognitiveSnapshot {
    const attention = this.nar.attentionReport();
    const beliefs = this.nar.getBeliefs();
    const stats = this.nar.getStatistics();

    const workingBeliefs: Belief[] = [];
    for (const c of attention.concepts) {
      if (c.priority >= (options.minPriority ?? 0.5)) {
        const belief = beliefs.find(b => b.term.toString() === c.term);
        if (belief) {
          workingBeliefs.push({
            term: belief.term.toString(),
            truth: belief.truth ? {frequency: belief.truth.f, confidence: belief.truth.c} : undefined
          });
        }
      }
    }

    const recentDerivations: string[] = [];
    const questions = this.nar.getQuestions().slice(0, options.maxQuestions ?? 5).map(q => q.term.toString());
    const goals = this.nar.getGoals().slice(0, options.maxGoals ?? 3).map(g => g.term.toString());

    return {
      attention,
      workingBeliefs,
      recentDerivations,
      unansweredQuestions: questions,
      activeGoals: goals,
      memoryState: {
        totalConcepts: stats.totalConcepts,
        totalTasks: stats.totalTasks,
        workingMemorySize: this.nar.workingMemory.size(),
      },
    };
  }

  private formatContext(snapshot: CognitiveSnapshot): string {
    const parts: string[] = [];

    if (snapshot.attention.concepts.length > 0) {
      parts.push('## Current Attention Focus');
      parts.push(snapshot.attention.concepts
        .map(c => {
          const belief = snapshot.workingBeliefs.find(b => b.term === c.term);
          const truthStr = belief?.truth ? ` (f=${belief.truth.frequency.toFixed(2)}, c=${belief.truth.confidence.toFixed(2)})` : '';
          return `- **${c.term}**: priority=${c.priority.toFixed(2)}${truthStr}`;
        })
        .join('\n')
      );
    }

    if (snapshot.workingBeliefs.length > 0) {
      parts.push('\n## Active Beliefs');
      parts.push(snapshot.workingBeliefs.slice(0, 10).map(b => {
        const truthStr = b.truth ? ` :${b.truth.frequency.toFixed(2)}:${b.truth.confidence.toFixed(2)}` : '';
        return `- ${b.term}${truthStr}`;
      }).join('\n'));
    }

    if (snapshot.recentDerivations.length > 0) {
      parts.push('\n## Recent Reasoning Steps');
      snapshot.recentDerivations.forEach(d => parts.push(`- ${d}`));
    }

    if (snapshot.unansweredQuestions.length > 0) {
      parts.push('\n## Unanswered Questions');
      snapshot.unansweredQuestions.forEach(q => parts.push(`- ${q}`));
    }

    if (snapshot.activeGoals.length > 0) {
      parts.push('\n## Active Goals');
      snapshot.activeGoals.forEach(g => parts.push(`- ${g}`));
    }

    parts.push(`\n## Memory State`);
    parts.push(`- Concepts: ${snapshot.memoryState.totalConcepts}`);
    parts.push(`- Tasks: ${snapshot.memoryState.totalTasks}`);
    parts.push(`- Working Memory: ${snapshot.memoryState.workingMemorySize}`);

    return parts.join('\n');
  }

  checkGoalSatisfaction(goalTerm: string): { satisfied: boolean; truthFreq: number; truthConf: number } {
    const beliefs = this.nar.getBeliefs()
    const belief = beliefs.find(b => b.term.toString() === goalTerm)
    return {
      satisfied: belief !== undefined && belief.truth.f > 0.8,
      truthFreq: belief?.truth.f ?? 0,
      truthConf: belief?.truth.c ?? 0,
    }
  }

  primeAttention(input: string): void {
    const terms = this.extractTerms(input);
    for (const termStr of terms) {
      const concepts = this.nar.listConcepts();
      const concept = concepts.find(c => c.term.toString() === termStr);
      if (concept) {
        concept.priority = Math.min(1.0, concept.priority + 0.1);
      }
    }
  }

  private extractTerms(input: string): string[] {
    const matches = input.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
    return [...new Set(matches)];
  }
}