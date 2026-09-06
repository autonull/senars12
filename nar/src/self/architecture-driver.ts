import { promises as fs } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { NAR } from '../nar.js';
import type { StressMetrics, DegradationCurve, ArchitectureGap } from '../imagination/types.js';
import { ReasoningAboutReasoning } from './ReasoningAboutReasoning.js';
import type { GapReport } from './ReasoningAboutReasoning.js';

export class ArchitectureDriver {
  private readonly nar: NAR;
  private readonly selfAnalyzer: ReasoningAboutReasoning;
  private readonly proposalsDir: string;

  constructor(nar: NAR, proposalsDir = 'docs/proposals') {
    this.nar = nar;
    this.selfAnalyzer = new ReasoningAboutReasoning(nar);
    this.proposalsDir = proposalsDir;
  }

  async analyzeStressResults(
    metrics: StressMetrics,
    degradationCurve: DegradationCurve
  ): Promise<ArchitectureGap[]> {
    const gaps: ArchitectureGap[] = [];

    if (metrics.latencyP95 > 100) {
      gaps.push(this.createGap(
        'high_latency',
        `P95 latency ${metrics.latencyP95.toFixed(0)}ms exceeds 100ms threshold`,
        'high',
        'latency_degradation',
        'implement_async_pipeline',
        0.85
      ));
    }

    if (metrics.contradictionRate > 0.1) {
      gaps.push(this.createGap(
        'high_contradiction_rate',
        `Contradiction rate ${(metrics.contradictionRate * 100).toFixed(1)}% exceeds 10%`,
        'medium',
        'contradiction_storm',
        'improve_revision_strategy',
        0.8
      ));
    }

    if (metrics.priorityOscillation > 0.3) {
      gaps.push(this.createGap(
        'priority_oscillation',
        `Priority oscillation ${metrics.priorityOscillation.toFixed(2)} indicates instability`,
        'medium',
        'priority_instability',
        'add_priority_damping',
        0.75
      ));
    }

    if (metrics.memoryPressure > 0.8) {
      gaps.push(this.createGap(
        'memory_pressure',
        `Memory pressure ${(metrics.memoryPressure * 100).toFixed(0)}% near capacity`,
        'high',
        'memory_exhaustion',
        'implement_queue_shedding',
        0.9
      ));
    }

    if (degradationCurve.kneePoint) {
      gaps.push(this.createGap(
        'capacity_knee',
        `Capacity knee at ${degradationCurve.kneePoint.multiplier}x load (quality: ${degradationCurve.kneePoint.quality.toFixed(2)})`,
        'critical',
        'overload_knee_detected',
        'scale_derivation_capacity',
        0.95
      ));
    }

    if (metrics.derivationQuality < 0.5) {
      gaps.push(this.createGap(
        'low_derivation_quality',
        `Derivation quality ${metrics.derivationQuality.toFixed(2)} below 0.5 threshold`,
        'medium',
        'quality_degradation',
        'optimize_sampling_strategy',
        0.7
      ));
    }

    for (const gap of gaps) {
      await this.injectSelfBeliefs(gap);
      await this.writeProposal(gap);
    }

    return gaps;
  }

  private createGap(
    id: string,
    description: string,
    severity: ArchitectureGap['severity'],
    trigger: string,
    proposedFix: string,
    confidence: number
  ): ArchitectureGap {
    const confPct = Math.round(confidence * 100);
    return {
      id: `${id}_${Date.now()}`,
      description,
      severity,
      trigger,
      proposedFix,
      confidence,
      narseseBelief: `(${trigger} --> gap_${proposedFix}). %${confidence.toFixed(2)};${confidence.toFixed(2)}%`,
      narseseGoal: `(^implement_${proposedFix})!`,
    };
  }

  private async injectSelfBeliefs(gap: ArchitectureGap): Promise<void> {
    try {
      await this.nar.believe(gap.narseseBelief);
      const { Truth } = await import('../terms/truth.js');
      await this.nar.goal(gap.narseseGoal, Truth.create(0.8, 0.9));
    } catch (error) {
      console.warn('Failed to inject self-beliefs:', error);
    }
  }

  private async writeProposal(gap: ArchitectureGap): Promise<void> {
    const proposalContent = this.generateProposalMarkdown(gap);
    const fileName = `P-${gap.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    const filePath = resolve(this.proposalsDir, fileName);

    try {
      await fs.mkdir(dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, proposalContent, 'utf-8');
      console.log(`📝 Proposal written: ${filePath}`);
    } catch (error) {
      console.warn('Failed to write proposal:', error);
    }
  }

  private generateProposalMarkdown(gap: ArchitectureGap): string {
    return `# Proposal: ${gap.proposedFix}

**ID:** ${gap.id}
**Severity:** ${gap.severity.toUpperCase()}
**Confidence:** ${(gap.confidence * 100).toFixed(0)}%
**Trigger:** ${gap.trigger}

## Description
${gap.description}

## Self-Belief (NARSESE)
\`\`\`narsese
${gap.narseseBelief}
\`\`\`

## Self-Goal (NARSESE)
\`\`\`narsese
${gap.narseseGoal}
\`\`\`

## Proposed Implementation
Implement \`${gap.proposedFix}\` to address the detected architecture gap.

### Approach
1. Analyze the root cause of \`${gap.trigger}\`
2. Design solution: \`${gap.proposedFix}\`
3. Implement with minimal invasive changes
4. Validate via treadmill stress test
5. Gate deployment via ApprovalManager

## Acceptance Criteria
- [ ] Treadmill stress test shows improved metrics
- [ ] No regression in baseline scenarios
- [ ] Proposal reviewed and approved
- [ ] Changes merged and deployed

---
*Auto-generated by ArchitectureDriver on ${new Date().toISOString()}*
`;
  }

  async generateProposalsFromSelfAnalysis(): Promise<ArchitectureGap[]> {
    const gapReport = await this.selfAnalyzer.analyzeReasoningGaps();
    const architectureGaps: ArchitectureGap[] = [];

    if (gapReport.missingRules.length > 0) {
      const gap = this.createGapFromReport(
        'missing_rules',
        `Missing rules: ${gapReport.missingRules.join(', ')}`,
        'medium',
        'missing_rules',
        'add_missing_rules',
        0.75
      );
      await this.injectSelfBeliefs(gap);
      await this.writeProposal(gap);
      architectureGaps.push(gap);
    }

    if (gapReport.lowConfidenceBeliefs.length > 0) {
      const gap = this.createGapFromReport(
        'low_confidence',
        `Low confidence beliefs: ${gapReport.lowConfidenceBeliefs.length}`,
        'medium',
        'low_confidence_beliefs',
        'increase_confidence',
        0.7
      );
      await this.injectSelfBeliefs(gap);
      await this.writeProposal(gap);
      architectureGaps.push(gap);
    }

    if (gapReport.repeatedFailures.length > 0) {
      const gap = this.createGapFromReport(
        'repeated_failures',
        `Repeated failures: ${gapReport.repeatedFailures.join(', ')}`,
        'high',
        'repeated_failures',
        'fix_failure_patterns',
        0.8
      );
      await this.injectSelfBeliefs(gap);
      await this.writeProposal(gap);
      architectureGaps.push(gap);
    }

    return architectureGaps;
  }

  private createGapFromReport(
    id: string,
    description: string,
    severity: ArchitectureGap['severity'],
    trigger: string,
    proposedFix: string,
    confidence: number
  ): ArchitectureGap {
    return {
      id: `${id}_${Date.now()}`,
      description,
      severity,
      trigger,
      proposedFix,
      confidence,
      narseseBelief: `(${trigger} --> gap_${proposedFix}). %${confidence.toFixed(2)};${confidence.toFixed(2)}%`,
      narseseGoal: `(^implement_${proposedFix})!`,
    };
  }

  getProposalsDir(): string {
    return this.proposalsDir;
  }
}

export function createArchitectureDriver(nar: NAR, proposalsDir?: string): ArchitectureDriver {
  return new ArchitectureDriver(nar, proposalsDir);
}