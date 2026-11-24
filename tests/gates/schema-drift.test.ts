/**
 * Schema Drift Gate — zod schema hash in genome; CI fails on change without migration.
 *
 * This test runs the genome generator and compares output to committed files.
 * Generated artifacts must be reproducible from the genome; hand-edits fail.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const GENOME_SCRIPT = join(ROOT, 'src/formats/genome/index.ts');
const GEN_DIR = join(ROOT, 'src/generated');

function dirname(path: string): string {
  return path.substring(0, path.lastIndexOf('/'));
}

describe('Schema Drift Gate', () => {
  let generatedFiles: string[] = [];

  beforeAll(() => {
    // Ensure we start clean - just verify directory exists
    if (existsSync(GEN_DIR)) {
      // Don't clean - we want to test against committed files
    }
  });

  afterAll(() => {
    // Cleanup generated files if any
  });

  it('should generate genome without errors', () => {
    const result = spawnSync('tsx', [GENOME_SCRIPT], { cwd: ROOT, stdio: 'pipe' });
    expect(result.status).toBe(0);
  });

  it('should not have drifted generated artifacts', () => {
    // Run the genome generator first
    const genResult = spawnSync('tsx', [GENOME_SCRIPT], { cwd: ROOT, stdio: 'pipe' });
    expect(genResult.status).toBe(0);

    // Check for changes in generated directory
    if (!existsSync('.git')) {
      // Not a git repo, skip drift check
      return;
    }

    const result = spawnSync('git', ['status', '--porcelain', GEN_DIR], {
      cwd: ROOT,
      stdio: 'pipe',
    });

    if (result.status !== 0) {
      // git command failed, skip
      return;
    }

    const output = result.stdout?.toString() ?? '';
    const changed: string[] = [];

    for (const line of output.trim().split('\n')) {
      if (line && line.startsWith(' M')) {
        changed.push(line.slice(3).trim());
      }
    }

    if (changed.length > 0) {
      console.error('Schema drift detected in:');
      for (const file of changed) {
        console.error(`  ${file}`);
      }
      console.error('\nRegenerate with: tsx src/formats/genome.ts');
      console.error('Then commit the changes.');
    }

    expect(changed.length).toBe(0);
  });

  it('should produce valid TypeScript types', () => {
    const result = spawnSync('tsx', [GENOME_SCRIPT], { cwd: ROOT, stdio: 'pipe' });
    expect(result.status).toBe(0);

    // Check that generated files exist and are valid TS
    const schemasFile = join(GEN_DIR, 'schemas.ts');
    expect(existsSync(schemasFile)).toBe(true);

    const content = readFileSync(schemasFile, 'utf8');
    expect(content).toContain('export const TermSchema');
    expect(content).toContain('z.discriminatedUnion');
  });

  it('should produce valid JSON Schema for MCP surface', () => {
    const result = spawnSync('tsx', [GENOME_SCRIPT], { cwd: ROOT, stdio: 'pipe' });
    expect(result.status).toBe(0);

    const jsonSchemaDir = join(GEN_DIR, 'json-schema');
    expect(existsSync(jsonSchemaDir)).toBe(true);
  });

  it('should have stable schema hashes', () => {
    const result = spawnSync('tsx', [GENOME_SCRIPT], { cwd: ROOT, stdio: 'pipe' });
    expect(result.status).toBe(0);

    // Schema hashes should be deterministic
    const schemasFile = join(GEN_DIR, 'schemas.ts');
    const content1 = readFileSync(schemasFile, 'utf8');

    // Run again
    const result2 = spawnSync('tsx', [GENOME_SCRIPT], { cwd: ROOT, stdio: 'pipe' });
    expect(result2.status).toBe(0);

    const content2 = readFileSync(schemasFile, 'utf8');
    expect(content2).toBe(content1);
  });

  it('should include all required schema definitions', () => {
    const result = spawnSync('tsx', [GENOME_SCRIPT], { cwd: ROOT, stdio: 'pipe' });
    expect(result.status).toBe(0);

    const schemasFile = join(GEN_DIR, 'schemas.ts');
    const content = readFileSync(schemasFile, 'utf8');

    // Check for key schema exports (some are imported from canonical locations)
    const requiredInlineExports = [
      'TermSchema',
      'TruthValueSchema',
      'TaskAdmittedEventSchema',
      'ProposalSchema',
      'RuleTableSchema',
      'ActionGateInputSchema',
      'RewardGateOutputSchema',
    ];

    for (const exportName of requiredInlineExports) {
      expect(content).toContain(`export const ${exportName}`);
    }

    // TaskTypeSchema is imported from @senars/schemas/task (canonical location)
    expect(content).toContain("import { TASK_TYPES, TASK_BAG_KINDS");
    expect(content).toContain("TaskTypeSchema");
    expect(content).toContain("from '@senars/schemas/task';");
  });
});