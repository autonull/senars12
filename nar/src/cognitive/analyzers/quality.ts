/**
 * Quality assessment - extracted from SelfAnalyzerService
 */
import type { Concept } from '../../memory';
import type { NAR } from '../../nar.js';
import { getSubject, containsSubterm } from '../../terms';
import type { QualityAssessment } from '../types.js';

export const assessQuality = async (nar: NAR | null): Promise<QualityAssessment> => {
  if (!nar) {
    return { overall: 0, coherence: 0, relevance: 0, completeness: 0, timestamp: Date.now() };
  }
  const beliefs = nar.getBeliefs();

  // Coherence: based on contradiction detection
  const contradictions = nar.getConstitution?.()?.length ?? 0;
  const coherence = Math.max(0, 1 - contradictions * 0.1);

  // Relevance: based on active goals and belief alignment
  const goals = nar.getGoals?.() ?? [];
  const relevantBeliefs = beliefs.filter((b) =>
    goals.some((g) => {
      const subject = getSubject(g.term);
      return subject && containsSubterm(b.term, subject);
    })
  ).length;
  const relevance = goals.length > 0 ? Math.min(1, relevantBeliefs / goals.length) : 0.5;

  // Completeness: based on question resolution rate
  const questions = nar.getQuestions?.() ?? [];
  const answeredQuestions = questions.filter((q) =>
    beliefs.some((b) => containsSubterm(b.term, q.term))
  ).length;
  const completeness = questions.length > 0 ? answeredQuestions / questions.length : 0.5;

  // Overall: weighted average
  const overall = coherence * 0.4 + relevance * 0.3 + completeness * 0.3;

  return {
    overall: Math.round(overall * 100) / 100,
    coherence: Math.round(coherence * 100) / 100,
    relevance: Math.round(relevance * 100) / 100,
    completeness: Math.round(completeness * 100) / 100,
    timestamp: Date.now(),
  };
};