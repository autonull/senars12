import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditPackages } from '../../scripts/exports-audit.js';

/** Bench 67 — Public API Surface & Versioning (TODO20 Phase 6: A1/A3). */

const ROOT = join(import.meta.dirname, '../..');

describe('Bench 67 — A1 consumer-aware export audit', () => {
  it('every declared @senars/* export has a consumer or PUBLIC_API declaration', () => {
    expect(auditPackages(ROOT, ['nar', 'util', 'core', 'io', 'metta'])).toEqual([]);
  });

  it('fails on an export with no consumer (gate must gate)', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'bench67-'));
    mkdirSync(join(fixture, 'pkg/src'), { recursive: true });
    mkdirSync(join(fixture, 'src'), { recursive: true });
    writeFileSync(
      join(fixture, 'pkg/package.json'),
      JSON.stringify({
        name: '@x/pkg',
        exports: { '.': './src/index.ts', './ghost': './src/ghost.ts' },
      })
    );
    writeFileSync(join(fixture, 'pkg/src/index.ts'), 'export const a = 1;\n');
    writeFileSync(join(fixture, 'pkg/src/ghost.ts'), 'export const ghost = 1;\n');
    writeFileSync(join(fixture, 'src/app.ts'), "import { a } from '@x/pkg';\n");
    try {
      const violations = auditPackages(fixture, ['pkg'], ['src']);
      expect(violations).toEqual([
        `pkg: export "." has no consumer and is not in PUBLIC_API`,
        `pkg: export "./ghost" has no consumer and is not in PUBLIC_API`,
      ]);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('exports:audit CLI is green (CI gate parity)', () => {
    execFileSync('npx', ['tsx', 'scripts/exports-audit.ts'], { cwd: ROOT, stdio: 'pipe' });
  });
});

describe('Bench 67 — A2 API docs', () => {
  it('docs/api renders every package with symbol entries', () => {
    for (const pkg of ['nar', 'core', 'util', 'io', 'metta']) {
      const md = readFileSync(join(ROOT, 'docs/api', `${pkg}.md`), 'utf-8');
      expect(md).toContain(`# @senars/${pkg} — public API`);
      expect(md.length).toBeGreaterThan(200);
    }
  });
});

describe('Bench 67 — A4 deprecation lifecycle', () => {
  it('live deprecations carry the @deprecated since tag', () => {
    const schema = readFileSync(join(ROOT, 'src/config/schema.ts'), 'utf-8');
    expect(schema).toMatch(/@deprecated since [\d.]+ — /);
  });
});
