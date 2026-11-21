/**
 * Capability Manifest — behavior-level capability registry with preservation gate.
 *
 * Each entry = a user-facing behavior with an owner and a behavioral test.
 * Not raw exports. This is the safety net for all later work.
 */

import type { FacultySpec } from '../src/faculties/specs.js';
import type { OracleOperation } from '../src/oracles/oracle.js';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

/** Capability categories aligned with faculty categories. */
export const CAPABILITY_CATEGORIES = [
  'perception',
  'inference',
  'learning',
  'reasoning',
  'planning',
  'evaluation',
  'communication',
  'governance',
  'memory',
  'coordination',
] as const;

export type CapabilityCategory = (typeof CAPABILITY_CATEGORIES)[number];

/** A behavioral test reference. */
export interface BehavioralTest {
  /** Test file path relative to repo root. */
  path: string;
  /** Test suite name (describe block). */
  suite: string;
  /** Test case name (it block). */
  case: string;
  /** What behavior this test verifies. */
  verifies: string;
}

/** Capability manifest entry. */
export interface CapabilityManifestEntry {
  /** Unique capability ID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Category. */
  category: CapabilityCategory;
  /** Owner (team/individual). */
  owner: string;
  /** Description of the user-facing behavior. */
  behavior: string;
  /** Behavioral tests that verify this capability. */
  tests: BehavioralTest[];
  /** Source module(s) implementing this capability. */
  sources: string[];
  /** Dependencies on other capabilities. */
  dependsOn: string[];
  /** Since when this capability exists (version/tag). */
  since: string;
  /** Whether this capability is active. */
  active: boolean;
  /** Content hash for integrity. */
  hash: string;
}

/** The capability manifest. */
export interface CapabilityManifest {
  /** Manifest version. */
  version: number;
  /** Generation timestamp. */
  generatedAt: string;
  /** All capabilities. */
  capabilities: CapabilityManifestEntry[];
  /** Capability index by ID. */
  byId: Record<string, CapabilityManifestEntry>;
}

/** Preservation gate result. */
export interface PreservationGateResult {
  /** Whether the gate passes. */
  pass: boolean;
  /** Missing capabilities (had a home, now lost). */
  missing: CapabilityManifestEntry[];
  /** New capabilities (not in previous manifest). */
  added: CapabilityManifestEntry[];
  /** Modified capabilities (hash changed). */
  modified: { previous: CapabilityManifestEntry; current: CapabilityManifestEntry }[];
  /** Disposition for missing capabilities. */
  dispositions: Record<string, 'archived' | 'moved' | 'consolidated' | 'unknown'>;
}

/** Generate content hash for an entry. */
function hashEntry(entry: Omit<CapabilityManifestEntry, 'hash'>): string {
  return createHash('sha256').update(JSON.stringify(entry)).digest('hex').slice(0, 16);
}

/** Extract capabilities from faculty specifications. */
export function extractFacultyCapabilities(faculties: readonly FacultySpec[]): CapabilityManifestEntry[] {
  const capabilities: CapabilityManifestEntry[] = [];

  for (const spec of faculties) {
    if (!spec.enabled) continue;

    const categoryMap: Record<string, CapabilityCategory> = {
      perception: 'perception',
      inference: 'inference',
      learning: 'learning',
      reasoning: 'reasoning',
      planning: 'planning',
      evaluation: 'evaluation',
      communication: 'communication',
      governance: 'governance',
    };

    const category = categoryMap[spec.category] ?? 'reasoning';

    // Find behavioral tests for this faculty
    const tests = findBehavioralTests(spec.name);

    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `faculty.${spec.name}`,
      name: spec.name,
      category,
      owner: 'faculty-engine',
      behavior: spec.description,
      tests,
      sources: [`src/faculties/fallback.ts`, `src/faculties/specs.ts`],
      dependsOn: spec.oracleOperation ? [`oracle.${spec.oracleOperation}`] : [],
      since: '0.1.0',
      active: true,
    };

    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Extract capabilities from oracle operations. */
export function extractOracleCapabilities(operations: readonly OracleOperation[]): CapabilityManifestEntry[] {
  const providerMap: Record<OracleOperation, { provider: string; description: string }> = {
    'lm.generateText': { provider: 'lm', description: 'Text generation via language model' },
    'lm.generateObject': { provider: 'lm', description: 'Structured object generation via language model' },
    'lm.stream': { provider: 'lm', description: 'Streaming language model output' },
    'retrieval.query': { provider: 'retrieval', description: 'Semantic retrieval query' },
    'engine.z3': { provider: 'z3', description: 'SMT solving via Z3' },
    'engine.clingo': { provider: 'clingo', description: 'ASP solving via Clingo' },
    'engine.minisat': { provider: 'minisat', description: 'SAT solving via MiniSat' },
    'engine.tau-prolog': { provider: 'tau-prolog', description: 'Prolog reasoning via Tau Prolog' },
    'engine.custom': { provider: 'custom', description: 'Custom engine oracle' },
  };

  const capabilities: CapabilityManifestEntry[] = [];

  for (const op of operations) {
    const info = providerMap[op];
    if (!info) continue;

    const tests = findOracleBehavioralTests(op);

    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `oracle.${op}`,
      name: op,
      category: 'coordination',
      owner: 'oracle-seam',
      behavior: info.description,
      tests,
      sources: [`src/oracles/engines/${info.provider}.ts`, `src/oracles/oracle.ts`],
      dependsOn: [],
      since: '0.1.0',
      active: true,
    };

    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Find behavioral tests for a faculty. */
function findBehavioralTests(facultyName: string): BehavioralTest[] {
  // Known behavioral tests per faculty
  const testMap: Record<string, BehavioralTest[]> = {
    grounding: [
      { path: 'tests/e2e/belief-import-export.test.ts', suite: 'Belief Import/Export', case: 'grounding round-trips', verifies: 'Perceptual grounding produces stable referents' },
      { path: 'tests/obligations/06-seeded-replay.test.ts', suite: 'W1 — seeded end-to-end replay', case: 'replays byte-identically from the same seed', verifies: 'Grounding integrates with deterministic replay' },
    ],
    inference: [
      { path: 'tests/logic/verdict.test.ts', suite: 'Logic verdict', case: 'proves a simple inheritance chain', verifies: 'SLD resolution derives correct conclusions' },
    ],
    abduction: [
      { path: 'tests/logic/registry.test.ts', suite: 'W1 — per-instance registries', case: 'creates an isolated faculty registry with the core faculties', verifies: 'Abduction faculty registers and isolates correctly' },
    ],
    induction: [],
    analogy: [],
    revision: [],
    planning: [
      { path: 'tests/unit/nar/weighted-sample.test.ts', suite: 'Weighted sampling', case: 'samples proportionally to weights', verifies: 'Planning selects actions by utility' },
    ],
    evaluation: [],
    communication: [],
    governance: [],
  };

  return testMap[facultyName] ?? [];
}

/** Find behavioral tests for an oracle operation. */
function findOracleBehavioralTests(operation: OracleOperation): BehavioralTest[] {
  const testMap: Record<OracleOperation, BehavioralTest[]> = {
    'engine.tau-prolog': [
      { path: 'tests/logic/verdict.test.ts', suite: 'Logic verdict', case: 'proves a simple inheritance chain', verifies: 'Tau Prolog resolves SLD proofs correctly' },
    ],
    'engine.z3': [],
    'engine.clingo': [],
    'engine.minisat': [],
    'lm.generateText': [],
    'lm.generateObject': [],
    'lm.stream': [],
    'retrieval.query': [],
    'engine.custom': [],
  };

  return testMap[operation] ?? [];
}

/** Build the capability manifest from all registries. */
export async function buildCapabilityManifest(): Promise<CapabilityManifest> {
  const { CORE_FACULTIES } = await import('../src/faculties/specs.js');
  const { ORACLE_OPERATIONS } = await import('../src/oracles/oracle.js');

  const facultyCapabilities = extractFacultyCapabilities(CORE_FACULTIES);
  const oracleCapabilities = extractOracleCapabilities(ORACLE_OPERATIONS);

  const allCapabilities = [...facultyCapabilities, ...oracleCapabilities];

  const byId: Record<string, CapabilityManifestEntry> = {};
  for (const cap of allCapabilities) {
    byId[cap.id] = cap;
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    capabilities: allCapabilities,
    byId,
  };
}

/** Write manifest to disk. */
export async function writeManifest(manifest: CapabilityManifest, path?: string): Promise<void> {
  const outputPath = path ?? join(REPO_ROOT, 'capability-manifest.json');
  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2) + '\n');
}

/** Read manifest from disk. */
export async function readManifest(path?: string): Promise<CapabilityManifest | null> {
  const inputPath = path ?? join(REPO_ROOT, 'capability-manifest.json');
  try {
    const content = await fs.readFile(inputPath, 'utf-8');
    return JSON.parse(content) as CapabilityManifest;
  } catch {
    return null;
  }
}

/** Run the preservation gate against a previous manifest. */
export async function runPreservationGate(
  current: CapabilityManifest,
  previousPath?: string
): Promise<PreservationGateResult> {
  const previous = await readManifest(previousPath);

  if (!previous) {
    return {
      pass: true,
      missing: [],
      added: current.capabilities,
      modified: [],
      dispositions: {},
    };
  }

  const missing: CapabilityManifestEntry[] = [];
  const added: CapabilityManifestEntry[] = [];
  const modified: { previous: CapabilityManifestEntry; current: CapabilityManifestEntry }[] = [];
  const dispositions: Record<string, 'archived' | 'moved' | 'consolidated' | 'unknown'> = {};

  // Check for missing capabilities
  for (const prevCap of previous.capabilities) {
    const currentCap = current.byId[prevCap.id];
    if (!currentCap) {
      missing.push(prevCap);
      dispositions[prevCap.id] = 'unknown';
    } else if (currentCap.hash !== prevCap.hash) {
      modified.push({ previous: prevCap, current: currentCap });
    }
  }

  // Check for added capabilities
  for (const currentCap of current.capabilities) {
    if (!previous.byId[currentCap.id]) {
      added.push(currentCap);
    }
  }

  // Gate passes if no missing capabilities without approved disposition
  const unapprovedMissing = missing.filter(c => dispositions[c.id] === 'unknown');
  const pass = unapprovedMissing.length === 0;

  return { pass, missing, added, modified, dispositions };
}

/** CLI for generating the manifest. */
export async function generateManifestCLI(): Promise<void> {
  const manifest = await buildCapabilityManifest();
  await writeManifest(manifest);
  console.log(`Capability manifest generated: ${manifest.capabilities.length} capabilities`);
}

/** CLI for running the preservation gate. */
export async function preservationGateCLI(): Promise<void> {
  const current = await buildCapabilityManifest();
  const result = await runPreservationGate(current);

  console.log('Preservation Gate:', result.pass ? 'PASS' : 'FAIL');
  console.log(`  Current capabilities: ${current.capabilities.length}`);
  console.log(`  Missing: ${result.missing.length}`);
  console.log(`  Added: ${result.added.length}`);
  console.log(`  Modified: ${result.modified.length}`);

  if (result.missing.length > 0) {
    console.log('\nMissing capabilities (require disposition):');
    for (const cap of result.missing) {
      console.log(`  - ${cap.id}: ${cap.behavior}`);
    }
  }

  if (!result.pass) {
    process.exit(1);
  }
}