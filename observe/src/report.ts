import type { Manifest, Verdict, Finding, CheckResult } from './schema.js';

export function renderReport(manifest: Manifest, verdict: Verdict, checks: CheckResult[]): string {
  const lines: string[] = [];

  lines.push(`# Observe Run Report`);
  lines.push('');
  lines.push(`**Run ID:** ${manifest.runId}`);
  lines.push(`**Program:** ${manifest.program?.name ?? 'unknown'}`);
  lines.push(`**Git SHA:** ${manifest.gitSha}`);
  lines.push(`**Seed:** ${manifest.seed}`);
  lines.push(`**Lane:** ${manifest.lane}`);
  lines.push(`**Event Digest:** ${manifest.eventDigest}`);
  lines.push(`**Sequence Range:** ${manifest.fromSeq} - ${manifest.toSeq}`);
  lines.push('');

  lines.push(`## Verdict`);
  lines.push('');
  lines.push(`**Overall:** ${verdict.overall.toUpperCase()}`);
  lines.push(`**Perception:** ${verdict.perception}`);
  lines.push(`**Findings:** ${verdict.findings.length}`);
  lines.push('');

  if (verdict.findings.length > 0) {
    lines.push(`## Findings`);
    lines.push('');
    for (const finding of verdict.findings) {
      lines.push(`### ${finding.kind} (${finding.severity})`);
      lines.push('');
      lines.push(`**Signature:** \`${finding.signature}\``);
      lines.push(`**Claim:** ${finding.claim}`);
      if (finding.repairHint) lines.push(`**Repair Hint:** ${finding.repairHint}`);
      if (finding.markId) lines.push(`**Mark:** ${finding.markId}`);
      if (finding.expectationId) lines.push(`**Expectation:** ${finding.expectationId}`);
      if (finding.evidence.length > 0) {
        lines.push(`**Evidence:**`);
        for (const ev of finding.evidence) {
          lines.push(`  - [${ev.type}] ${ev.id} @ ${ev.timestamp}${ev.description ? `: ${ev.description}` : ''}`);
        }
      }
      lines.push('');
    }
  }

  lines.push(`## Checks`);
  lines.push('');
  for (const check of checks) {
    const status = check.passed ? '✅' : '❌';
    lines.push(`- ${status} **${check.checkId}** (${check.kind}): ${check.details}`);
  }
  lines.push('');

  lines.push(`## Marks`);
  lines.push('');
  for (const mark of manifest.marks) {
    lines.push(`- \`${mark.id}\` [${mark.label}] @ ${mark.t}${mark.castT ? ` (cast: ${mark.castT.toFixed(3)}s)` : ''}${mark.videoT ? ` (video: ${mark.videoT.toFixed(3)}s)` : ''}`);
  }
  lines.push('');

  lines.push(`## Artifacts`);
  lines.push('');
  for (const [name, hash] of Object.entries(manifest.artifactHashes)) {
    lines.push(`- ${name}: \`${hash}\``);
  }
  lines.push('');

  return lines.join('\n');
}