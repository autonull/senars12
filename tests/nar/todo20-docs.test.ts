/** Bench 70 — Documentation & Knowledge Transfer (TODO20 Phase 9: K1 adr, K2 diagrams, K3 guides, K4 runbook). */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');

const listFiles = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile()) : [];

describe('Bench 70 — K1: ADR log', () => {
  const adrDir = join(ROOT, 'docs/adr');
  const adrs = listFiles(adrDir).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f));

  it('covers the eight ADR topics from the plan', () => {
    const required = [
      'kernel-gates',
      'epistemic-firewall',
      'aikr-bounds',
      'builder-pattern',
      'component-library',
      'reasoning-as-game',
      'schema-persistence',
      'gpu-offload',
    ];
    for (const slug of required) {
      expect(adrs.some((f) => f.endsWith(`-${slug}.md`)), `missing ADR: ${slug}`).toBe(true);
    }
  });

  it('template exists and every ADR has Status/Context/Decision/Consequences', () => {
    expect(existsSync(join(adrDir, 'template.md'))).toBe(true);
    for (const adr of adrs) {
      const text = readFileSync(join(adrDir, adr), 'utf-8');
      for (const section of ['Status', 'Context', 'Decision', 'Consequences']) {
        expect(text, `${adr} missing ${section}`).toContain(section);
      }
    }
  });

  it('ADR references point at files that exist', () => {
    for (const adr of adrs) {
      const text = readFileSync(join(adrDir, adr), 'utf-8');
      const refs = [...text.matchAll(/`(nar|core|util|io|metta|src|scripts)\/[^`\s]+\.ts`/g)].map(
        (m) => m[0]!.slice(1, -1)
      );
      for (const ref of refs) {
        expect(existsSync(join(ROOT, ref)), `${adr} references missing file ${ref}`).toBe(true);
      }
    }
  });
});

describe('Bench 70 — K2: architecture diagrams', () => {
  it('diagrams generate and are checked in', () => {
    expect(existsSync(join(ROOT, 'scripts/generate-architecture.ts'))).toBe(true);
    for (const f of ['nar-modules.mmd', 'kernel-boundaries.mmd']) {
      expect(existsSync(join(ROOT, 'docs/architecture', f)), `missing ${f}`).toBe(true);
    }
  });

  it('diagrams are Mermaid graphs derived from real modules', () => {
    const modules = readFileSync(join(ROOT, 'docs/architecture/nar-modules.mmd'), 'utf-8');
    expect(modules).toMatch(/^graph TD/);
    expect(modules).toContain('kernel');
    expect(modules).toContain('-->');
    const kernelView = readFileSync(join(ROOT, 'docs/architecture/kernel-boundaries.mmd'), 'utf-8');
    expect(kernelView).toContain('kernel');
  });
});

describe('Bench 70 — K3: contributor guides', () => {
  const guideDir = join(ROOT, 'docs/contributing');

  it('all five guides exist, are <200 lines, and include runnable examples + checklists', () => {
    const required = [
      'add-game.md',
      'add-reflex.md',
      'add-systemone-head.md',
      'add-tool.md',
      'add-lm-rule.md',
    ];
    for (const guide of required) {
      const text = readFileSync(join(guideDir, guide), 'utf-8');
      const lines = text.split('\n').length;
      expect(lines, `${guide} too long: ${lines}`).toBeLessThan(200);
      expect(text, `${guide} missing code example`).toContain('```');
      expect(text, `${guide} missing checklist`).toContain('Checklist');
    }
  });

  it('guide tool examples use strict schemas (Phase 7 requirement)', () => {
    const addTool = readFileSync(join(guideDir, 'add-tool.md'), 'utf-8');
    expect(addTool).toContain('z.strictObject');
  });
});

describe('Bench 70 — K4: runbook', () => {
  const runbookDir = join(ROOT, 'docs/runbook');

  it('covers the six incidents from the plan', () => {
    const required = [
      'lm-provider-failure.md',
      'gate-deadlock.md',
      'schema-store-corruption.md',
      'budget-exhaustion.md',
      'veto-storm.md',
      'config-migration-failure.md',
    ];
    for (const doc of required) {
      expect(existsSync(join(runbookDir, doc)), `missing runbook: ${doc}`).toBe(true);
    }
  });

  it('each incident has Symptom/Diagnosis/Remediation sections and an index exists', () => {
    expect(existsSync(join(runbookDir, 'README.md'))).toBe(true);
    for (const doc of listFiles(runbookDir).filter((f) => f !== 'README.md')) {
      const text = readFileSync(join(runbookDir, doc), 'utf-8');
      for (const section of ['Symptom', 'Diagnosis', 'Remediation']) {
        expect(text, `${doc} missing ${section}`).toContain(section);
      }
    }
  });
});
