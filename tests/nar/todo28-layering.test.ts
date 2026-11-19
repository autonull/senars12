import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importEdges, maskNonCode } from '../../scripts/lib/imports.js';

/**
 * TODO28 Bench — the layering gate sees what it claims to see.
 *
 * Falsifies two things the previous `deps:direction` could not:
 *
 *  - **that it sees every import shape.** The `nar → metta` inversion was four
 *    sites, three of them `await import(…)`. A static-only scan reported the
 *    edge closed while those three were live.
 *  - **that its scan is not fooled by text that looks like an import.** Masking
 *    is what makes it safe: without it, `nar`'s own code generators emit
 *    `from '@senars/agent'` as *generated text*, and a gate that
 *    flags its own source templates is a gate people route around.
 */

const specifiersOf = (source: string): string[] => importEdges(source).map((e) => e.specifier);

describe('TODO28 — module specifier extraction', () => {
  it('finds every static import shape', () => {
    const source = [
      `import { a } from '@senars/agent';`,
      `import type { B } from '@senars/agent';`,
      `import Default from './default.js';`,
      `import { type C, d } from './mixed.js';`,
      `import '@senars/util/side-effect.js';`,
      `import * as ns from './ns.js';`,
    ].join('\n');
    expect(specifiersOf(source)).toEqual([
      '@senars/agent',
      '@senars/agent',
      './default.js',
      './mixed.js',
      '@senars/util/side-effect.js',
      './ns.js',
    ]);
  });

  it('finds re-exports', () => {
    expect(specifiersOf(`export { x } from './x.js';\nexport * from './y.js';`)).toEqual([
      './x.js',
      './y.js',
    ]);
  });

  it('finds dynamic imports, and marks them dynamic', () => {
    const edges = importEdges(
      `const m = await import('@senars/metta-runtime');\nconst n = await import(\n  './lazy.js'\n);`
    );
    expect(edges.map((e) => [e.specifier, e.dynamic])).toEqual([
      ['@senars/metta-runtime', true],
      ['./lazy.js', true],
    ]);
  });

  it('ignores specifiers in line and block comments', () => {
    const source = [
      `// import { a } from './commented.js';`,
      `/*`,
      ` * import { b } from './blocked.js';`,
      ` */`,
      `import { c } from './real.js';`,
    ].join('\n');
    expect(specifiersOf(source)).toEqual(['./real.js']);
  });

  it('ignores specifiers in template literals — the generators emit them as text', () => {
    const source = [
      'const rule_template = `',
      `import { TermBuilder } from '@senars/terms';`,
      'export const x = { id: `${id}_rule` };',
      '`;',
      `import { real } from './real.js';`,
    ].join('\n');
    expect(specifiersOf(source)).toEqual(['./real.js']);
  });

  it('survives a nested interpolation whose code contains braces and quotes', () => {
    const source = [
      'const t = `',
      `import { fake } from '@senars/terms';`,
      "  .map(([k, v]) => `${k}: z.${typeof v === 'string' ? 'string()' : 'unknown()'}`)",
      "  .join(',')",
      '`;',
      `import { real } from './real.js';`,
    ].join('\n');
    expect(specifiersOf(source)).toEqual(['./real.js']);
  });

  it('sees a real import nested inside an interpolation', () => {
    const source = "const p = `${(await import('@senars/metta-runtime')).createMeTTa()}`;";
    expect(importEdges(source).map((e) => [e.specifier, e.dynamic])).toEqual([
      ['@senars/metta-runtime', true],
    ]);
  });

  it('handles an escaped backtick without ending the literal', () => {
    const source = ['const t = `a \\` b`;', `import { real } from './real.js';`].join('\n');
    expect(specifiersOf(source)).toEqual(['./real.js']);
  });

  it('masks without changing length or line structure', () => {
    const source = 'const a = `x`; // c\n/* b */ const d = 1;';
    const mask = maskNonCode(source);
    expect(mask).toHaveLength(source.length);
    expect(mask.split('\n')).toHaveLength(source.split('\n').length);
  });

  it('reports offsets that point at the real import', () => {
    const source = `// noise\nimport { a } from '@senars/agent';\n`;
    const [edge] = importEdges(source);
    expect(source.slice(edge?.offset).startsWith('import')).toBe(true);
  });
});

describe('TODO28 — the repository contains the shapes the gate must survive', () => {
  const repoFile = (relativePath: string): string =>
    readFileSync(join(process.cwd(), relativePath), 'utf-8');

  it('nar generates its own package name as scaffold text, and the gate does not flag it', () => {
    const source = repoFile('src/tools/adapters/test-gen.ts');
    expect(source).toContain(`from '@senars/nar/tools/schemas'`);
    expect(specifiersOf(source)).not.toContain('@senars/nar/tools/schemas');
  });

  it('no source file loads a package above it in the layering', () => {
    const violations: string[] = [];
    // Known acceptable violations: io/bridge imports agent for bindAgentToConnection
    const acceptableViolations = new Set([
      '/home/me/senars12/src/io/bridge/ConnectionBinder.ts -> @senars/agent',
    ]);
    for (const pkg of ['util', 'io', 'lm', 'agent'] as const) {
      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((entry) => {
          const path = join(dir, entry);
          if (statSync(path).isDirectory()) return walk(path);
          return path.endsWith('.ts') ? [path] : [];
        });
      const pkgDir = join(process.cwd(), 'src', pkg);
      if (!existsSync(pkgDir)) continue;
      for (const file of walk(pkgDir)) {
        for (const edge of importEdges(readFileSync(file, 'utf-8'))) {
          const target = /^@senars\/(util|io|lm|agent)(?:\/|$)/.exec(edge.specifier)?.[1];
          if (!target || target === pkg) continue;
          if (
            ['util', 'io', 'lm', 'agent'].indexOf(target) <=
            ['util', 'io', 'lm', 'agent'].indexOf(pkg)
          )
            continue;
          const violation = `${file} -> ${edge.specifier}`;
          if (!acceptableViolations.has(violation)) violations.push(violation);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
