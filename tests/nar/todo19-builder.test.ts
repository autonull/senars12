import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NARBuilder, BuilderError, resolveProfile } from '../../nar/src/agent/builder.js';
import type { WiredNAR } from '../../nar/src/agent/builder.js';
import { gateRegistry } from '../../nar/src/kernel/index.js';
import { NAR } from '../../nar/src/nar.js';

/**
 * Bench 41 — Assembly Integrity (TODO19 F1–F3)
 * Builder graph accurate; BuilderError on inconsistent specs; absent step ⇒
 * absent subsystem; profiles resolve; entry points build via NARBuilder.
 */

const built: WiredNAR[] = [];
afterEach(async () => {
  while (built.length) {
    const w = built.pop()!;
    await w.agent.stop();
  }
});

describe('Bench 41 — Assembly Integrity', () => {
  it('F1 — inconsistent specs throw BuilderError (tier-2 cortex / self without LM)', async () => {
    await expect(
      new NARBuilder().withSystemOne({ tier: 2 }).build()
    ).rejects.toThrowError(BuilderError);
    await expect(
      new NARBuilder().withCapabilities({ self: { enabled: true } }).build()
    ).rejects.toThrowError(BuilderError);
  });

  it('F1 — absent step ⇒ absent subsystem, present steps appear in describe()', async () => {
    const wired = await new NARBuilder().build();
    built.push(wired);
    expect(wired.describe().subsystems).toEqual([]);
    expect(wired.describe().steps.every((s) => !s.present || s.step !== 'lm')).toBe(true);

    const full = await new NARBuilder()
      .withLM({} as never)
      .withSystemOne({ tier: 2 })
      .withCapabilities({ self: { enabled: true }, rlfp: { enabled: true } })
      .withParameters({} as never)
      .build();
    built.push(full);
    expect(full.describe().subsystems).toEqual([
      'lm',
      'systemOne',
      'self',
      'rlfp',
      'cognitiveParameters',
    ]);
    expect(full.describe().steps.map((s) => s.step)).toContain('lm');
  });

  it('F2 — each build owns an isolated gate registry (never the process-global singleton)', async () => {
    const a = await new NARBuilder().build();
    const b = await new NARBuilder().build();
    built.push(a, b);
    expect(a.gates).not.toBe(b.gates);
    expect(a.gates).not.toBe(gateRegistry);
    expect(a.nar.gates).toBe(a.gates);
  });

  it('F3 — profiles are data: device resolves tier-0 with no LM; unknown profile rejected', async () => {
    expect(resolveProfile('device').tier).toBe(0);
    expect(resolveProfile('conversation').tier).toBe(2);
    expect(() => resolveProfile('no-such-profile')).toThrow(/unknown NAR profile/);

    const device = await NARBuilder.fromProfile('device').build();
    built.push(device);
    const subsystems = device.describe().subsystems;
    expect(subsystems).not.toContain('lm');
    expect(subsystems).not.toContain('systemOne');
    expect(device.lmService).toBeUndefined();

    // conversation profile demands an LM — building without one fails honestly
    await expect(NARBuilder.fromProfile('conversation').build()).rejects.toThrowError(BuilderError);
  });

  it('F1 — per-NAR gates: two NARs default to distinct isolated registries', () => {
    const a = new NAR();
    const b = new NAR();
    expect(a.gates).not.toBe(b.gates);
    expect(a.gates).not.toBe(gateRegistry);
  });

  it('grep-guard — entry points build via NARBuilder; no bespoke RecordingReflex in arcade', () => {
    const lifecycle = readFileSync('src/bin/lib/lifecycle.ts', 'utf8');
    expect(lifecycle).toContain('NARBuilder');
    expect(lifecycle).not.toContain('SeNARSFactory.createDefault');
    expect(lifecycle).not.toMatch(/\bcreateAgent\(/);

    const arcade = readFileSync('scripts/arcade.ts', 'utf8');
    expect(arcade).toContain('wrapReflex');
    expect(arcade).not.toContain('class RecordingReflex');
  });
});
