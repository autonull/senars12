/**
 * K2 (TODO20 Phase 9): generate Mermaid architecture diagrams from real imports.
 * Emits folder-level graphs (module directory → module directory edges) for nar
 * internals plus a public-surface view (barrels → top-level folders). Checked
 * into docs/architecture/ so drift is reviewable; CI can diff the output.
 */
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const NAR_SRC = join(ROOT, 'nar/src');
const OUT_DIR = join(ROOT, 'docs/architecture');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() && !p.includes('peggy-generated')
      ? walk(p)
      : p.endsWith('.ts')
        ? [p]
        : [];
  });

const IMPORT_RE = /from\s+['"](\.[^'"]+)['"]/g;

/** folder of a file relative to nar/src ('' for root files); unknown targets → null */
function resolveTarget(fromFile: string, spec: string): string | null {
  const target = join(dirname(fromFile), spec).replace(/\.js$/, '.ts');
  try {
    return statSync(target).isFile() ? target : null;
  } catch {
    try {
      return statSync(`${target}/index.ts`).isFile() ? `${target}/index.ts` : null;
    } catch {
      return null;
    }
  }
}

/** folder of a file relative to nar/src ('' for root files) */
const folderOf = (file: string): string => dirname(relative(NAR_SRC, file));

function collectEdges(): Map<string, Set<string>> {
  const edges = new Map<string, Set<string>>();
  for (const file of walk(NAR_SRC)) {
    const from = folderOf(file);
    const src = readFileSync(file, 'utf-8');
    for (const m of src.matchAll(IMPORT_RE)) {
      const target = resolveTarget(file, m[1]!);
      if (!target) continue;
      const to = folderOf(target);
      if (to === from) continue;
      if (!edges.has(from)) edges.set(from, new Set());
      edges.get(from)!.add(to);
    }
  }
  return edges;
}

const sanitize = (s: string): string => s.replace(/[^a-z0-9_-]/gi, '_') || 'root';

function mermaid(edges: Map<string, Set<string>>, keep: (folder: string) => boolean): string {
  const nodes = new Set<string>();
  for (const [from, tos] of edges) {
    if (keep(from)) nodes.add(from);
    for (const to of tos) if (keep(to)) nodes.add(to);
  }
  const lines = ['graph TD'];
  for (const n of [...nodes].sort()) lines.push(`  ${sanitize(n)}["${n || 'nar/src (root)'}"]`);
  for (const from of [...nodes].sort())
    for (const to of [...(edges.get(from) ?? [])].sort())
      if (nodes.has(to)) lines.push(`  ${sanitize(from)} --> ${sanitize(to)}`);
  return `${lines.join('\n')}\n`;
}

const all = collectEdges();
const internal = mermaid(all, () => true);
// Public view: only the module directories reachable at the nar surface (kernel + subsystem folders).
const KERNEL_ONLY = (f: string) => f === '' || f === 'kernel';
const kernelEdges = new Map<string, Set<string>>(
  [...all].map(([from, tos]) => [from, new Set([...tos].filter(KERNEL_ONLY))])
);
const kernel = mermaid(kernelEdges, KERNEL_ONLY);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'nar-modules.mmd'), internal);
writeFileSync(join(OUT_DIR, 'kernel-boundaries.mmd'), kernel);
writeFileSync(
  join(OUT_DIR, 'README.md'),
  `# Architecture Diagrams

Generated from real imports by \`pnpm docs:architecture\` (\`scripts/generate-architecture.ts\`).
Do not edit by hand — regenerate and review the diff.

- \`nar-modules.mmd\` — folder-level import graph of all \`nar/src\` modules.
- \`kernel-boundaries.mmd\` — the kernel boundary view: kernel plus root surface only.

Render with any Mermaid viewer (GitHub renders \`.mmd\` in markdown fences).
`
);
console.log(`docs:architecture ok — ${all.size} source folders, 2 diagrams written`);
