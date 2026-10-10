#!/usr/bin/env tsx
/**
 * Generate surface documentation from the surface registry and write to docs/readme/ui-gallery.md.
 * Run with: pnpm --dir ui generate:surface-docs
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSurfaces } from '../src/client/core/surface-codegen.js';

// Import surfaces to trigger registration
import '../src/client/components/overlays/index.js';
import '../src/client/components/renderers/graph.js';
import '../src/client/components/renderers/notebook.js';
import '../src/client/components/renderers/graph3d.js';
import '../src/client/components/views/index.js';
import '../src/client/core/view-host.js';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const DOCS_DIR = join(__dirname, '../../docs/readme');
const OUTPUT_FILE = join(DOCS_DIR, 'ui-gallery.md');

function generateSurfaceDocsMarkdown(): string {
  const artifacts = generateSurfaces();
  const docs = artifacts.docs;

  // Group by group
  const groups = new Map<string, typeof docs>();
  for (const doc of docs) {
    const group = doc.group;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(doc);
  }

  const lines: string[] = [
    '## UI Gallery',
    '',
    'The Web UI is verified *at a glance*: every registered surface — overlay, renderer, layout, view',
    'shape, panel — has a committed screenshot baseline, and the coverage test fails the moment one is',
    'registered without a cell. The contract is data, not a hand-kept checklist:',
    '',
    '- The cell matrix — [`ui/tests/visual/matrix.ts`](ui/tests/visual/matrix.ts)',
    '- The coverage gate — [`ui/tests/components/visual-coverage.test.ts`](ui/tests/components/visual-coverage.test.ts)',
    '- The sheet builder — [`ui/scripts/build-gallery.ts`](ui/scripts/build-gallery.ts)',
    '',
    'Run the whole contract locally with `pnpm ui:verify` (typecheck + unit + committed baselines + the',
    'contact sheet); the fast type+unit gate is `pnpm ui:gate`. Update baselines with',
    '`pnpm --dir ui test:visual:update` and rebuild the sheet alone with `pnpm ui:gallery`.',
    '`README.md` is likewise generated; edit a section under `docs/readme/` and run `pnpm readme`.',
    '',
    '---',
    '',
    '## Registered Surfaces',
    '',
    'Auto-generated from surface descriptors. Do not edit manually.',
    '',
  ];

  const groupOrder = ['Views', 'workspace', 'overlay', 'component', 'panel', 'layout'];

  for (const groupName of groupOrder) {
    const groupDocs = groups.get(groupName);
    if (!groupDocs || groupDocs.length === 0) continue;

    const displayName = groupName === 'workspace' ? 'Renderers' :
                        groupName === 'overlay' ? 'Overlays' :
                        groupName === 'component' ? 'Components' :
                        groupName === 'panel' ? 'Panels' :
                        groupName === 'layout' ? 'Layouts' :
                        groupName;

    lines.push(`### ${displayName}`);
    lines.push('');

    // Table header
    lines.push('| Surface | Tag | Bindings |');
    lines.push('|---------|-----|----------|');

    for (const doc of groupDocs.sort((a, b) => a.title.localeCompare(b.title))) {
      const bindings = doc.bindings.length > 0 ? doc.bindings.join(', ') : '—';
      lines.push(`| ${doc.title} | \`${doc.tag}\` | ${bindings} |`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

function main(): void {
  const markdown = generateSurfaceDocsMarkdown();
  writeFileSync(OUTPUT_FILE, markdown, 'utf8');
  console.log(`Generated ${OUTPUT_FILE}`);
}

main();