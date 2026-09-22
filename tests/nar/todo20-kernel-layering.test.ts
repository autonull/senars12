import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Bench 61b — Kernel Layering (TODO20 X2)
 * Obligation: the epistemic firewall is structural — `nar/src/kernel/` never
 * imports `lm/system-one` (proposer internals); ingress flows through the
 * injected `IngressJudge` boundary (`kernel/ingress.ts`).
 */

const KERNEL_DIR = join(import.meta.dirname, '../../nar/src/kernel');

const kernelSources = readdirSync(KERNEL_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ file: f, src: readFileSync(join(KERNEL_DIR, f), 'utf8') }));

describe('Bench 61b — Kernel Layering (X2)', () => {
  it('nar/src/kernel/ contains no lm/system-one imports', () => {
    const violations = kernelSources.filter((s) => s.src.includes('lm/system-one'));
    expect(violations.map((s) => s.file)).toEqual([]);
  });

  it('the perception gate consumes the IngressJudge boundary, not the manifold', () => {
    const gate = kernelSources.find((s) => s.file === 'KernelPerceptionGate.ts');
    expect(gate).toBeDefined();
    expect(gate!.src).toContain('IngressJudge');
    expect(gate!.src).not.toMatch(/\bjudgeBatch\b/);
    expect(gate!.src).not.toContain('EmbeddingCache');
  });

  it('ingress still fails closed on judge faults (D1 preserved)', async () => {
    const { KernelPerceptionGate } = await import(
      '../../nar/src/kernel/KernelPerceptionGate.js'
    );
    const { SystemOneIngressJudge } = await import(
      '../../nar/src/lm/system-one/ingress-judge.js'
    );
    const gate = new KernelPerceptionGate({
      systemOne: {
        enabled: true,
        judge: new SystemOneIngressJudge({
          manifold: {
            judgeBatch: async () => {
              throw new Error('manifold fault');
            },
            setPropositionCallback: () => {},
          } as never,
          embeddingCache: { write: async () => 0 } as never,
          budget: {
            maxCycles: 10,
            maxDepth: 5,
            maxMemoryOps: 100,
            maxLMCalls: 2,
            consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
          },
        }),
      },
    });
    const result = await gate.admit({
      rawObservation: '(robin --> bird)',
      sourceId: 'test',
      sensorConfidence: 1,
      sourceQuality: 'GENERAL',
    });
    expect(result.admitted).toBe(false);
    expect(result.rejectionReason).toContain('fail-closed');
    const violation = gate
      .getEventLog()
      .find((e) => e.type === 'policy.violation') as { payload: { detail: string } };
    expect(violation).toBeDefined();
    expect(violation.payload.detail).toContain('systemone_ingress_error');
  });
});
