/**
 * §3.3 kernel boundary: the domain kernel is chrome-agnostic. `src/client/kernel/**`
 * must not import lenses, layouts, panels, renderers or any component/HUD module —
 * the kernel is the substrate the chrome is layered *on top of*, never the reverse.
 *
 * The check is a direct-import scan; it deliberately ignores type-only imports
 * from `@senars/*` (the engine) and the shared `core/store` state layer.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const KERNEL_DIR = resolve(process.cwd(), 'src/client/kernel');

const FORBIDDEN: readonly RegExp[] = [
  /(^|\/)(components|apps|layouts)\//,
  /lens-catalog/,
  /layout-registry/,
  /panel-defs/,
  /graph-layer/,
  /renderer-defs/,
  /overlay-registry/,
  /surface-registry/,
  /workspace-hud/,
];

const IMPORT_RE = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g;

/** The chrome imports a kernel source string reaches (directly). */
export function chromeViolations(source: string): string[] {
  const violations: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1];
    if (specifier && FORBIDDEN.some((pattern) => pattern.test(specifier))) violations.push(specifier);
  }
  return violations;
}

describe('kernel boundary (§3.3)', () => {
  it('kernel modules never import UI chrome', () => {
    const files = readdirSync(KERNEL_DIR).filter((name) => name.endsWith('.ts'));
    const violations: string[] = [];
    for (const name of files) {
      const source = readFileSync(resolve(KERNEL_DIR, name), 'utf8');
      for (const specifier of chromeViolations(source)) violations.push(`${name} -> ${specifier}`);
    }
    expect(violations).toEqual([]);
  });

  it('flags a chrome import and allows the substrate', () => {
    expect(chromeViolations(`import { x } from '../components/foo.js';`)).toEqual(['../components/foo.js']);
    expect(chromeViolations(`import type { GraphLayer } from '../core/graph-layer-defs.js';`)).toEqual([
      '../core/graph-layer-defs.js',
    ]);
    expect(chromeViolations(`import { connect } from './transport.js';`)).toEqual([]);
    expect(chromeViolations(`import { $workspaceGraph } from '../core/store.js';`)).toEqual([]);
  });
});
