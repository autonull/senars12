import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from 'senars/util/logger';
import { type Flags, parseFlags } from 'senars/util/cli';
import { observeRun, observeRecord } from './run.js';
import { verifyTask } from './verify.js';
import { diffRuns, bisect } from './diff.js';
import { promoteRun } from './promote.js';
import { getObserveProgram, listObservePrograms } from './programs.js';
import type { ObserveRunResult } from './run.js';
import type { VerifyResult } from './verify.js';
import type { ScenarioRunnerDeps } from 'senars/tools/adapters/scenario-execute';

const logger = createLogger({ scope: 'ObserveCLI' });

export interface ObserveCLIOptions {
  deps: ScenarioRunnerDeps;
}

export async function observeCLI(argv: string[], options: ObserveCLIOptions): Promise<number> {
  const flags = parseFlags(argv);
  const subcommand = flags._.shift() as string | undefined;

  switch (subcommand) {
    case 'list':
      return await cmdList();
    case 'run':
      return await cmdRun(flags, options.deps);
    case 'record':
      return await cmdRecord(flags);
    case 'review':
      return await cmdReview(flags);
    case 'verify':
      return await cmdVerify(flags);
    case 'diff':
      return await cmdDiff(flags);
    case 'bisect':
      return await cmdBisect(flags);
    case 'promote':
      return await cmdPromote(flags);
    case 'export':
      return await cmdExport(flags);
    case 'replay':
      return await cmdReplay(flags);
    default:
      console.log(observeHelp());
      return 0;
  }
}

function observeHelp(): string {
  return `
senars observe — Self-observation & repair loop

USAGE:
  senars observe <command> [options]

COMMANDS:
  list                    List available observe programs
  run --program <id>      Run a program with observation
  record --command <cmd>  Record any command (debugging/education)
  review <runId>          Review a run bundle
  verify --task <file>    Verify a repair task in shadow worktree
  diff <runA> <runB>      Compare two runs
  bisect --program <id>   Bisect regression
  promote <runId>         Promote verified fix to regression fixture
  export <runId>          Export bundle to GIF/webm/cast/report
  replay <runId>          Replay console cast or serve video

OPTIONS:
  --program, -p       Program ID (for run)
  --live              Use live lane (real-time, non-deterministic)
  --publish           Publish GIF/cast/report to generated/observations
  --surfaces          Comma-separated: console,ui (default: console)
  --task              Repair task JSON file (for verify)
  --worktree          Shadow worktree path (for verify)
  --good              Good commit SHA (for bisect)
  --bad               Bad commit SHA (for bisect)
  --format            Export format: gif|webm|cast|report (for export)
  --output            Output path (for export)
  --speed             Replay speed: 1x|2x|4x (for replay)

EXAMPLES:
  senars observe list
  senars observe run --program contradictory_sensors
  senars observe run --program temporal_reasoning --live
  senars observe record --command "pnpm senars run --profile agent" --name my-debug
  senars observe verify --task .cache/observations/.../repair-task.json --worktree .shadow/abc123
  senars observe diff runA runB
  senars observe bisect --program contradictory_sensors --good abc123 --bad def456
  senars observe promote verify_123
  senars observe export run123 --format gif --output demo.gif
  senars observe replay run123 --speed 2x
`;
}

async function cmdList(): Promise<number> {
  const programs = listObservePrograms();
  console.log('\nAvailable observe programs:');
  for (const program of programs) {
    console.log(`  ${program.name.padEnd(25)} ${program.description}`);
    console.log(`    Success criteria: ${Object.keys(program.success_criteria).filter((k) => program.success_criteria[k as keyof typeof program.success_criteria]).join(', ')}`);
    console.log(`    Keyframe marks: ${program.observe.keyframeMarks.join(', ')}`);
    console.log('');
  }
  return 0;
}

async function cmdRun(flags: Flags, deps: ScenarioRunnerDeps): Promise<number> {
  const programId = flags.str('program', '') || flags.str('p', '');
  if (!programId) {
    console.error('Error: --program required');
    return 1;
  }

  const live = flags.has('live');
  const publish = flags.has('publish');
  const program = getObserveProgram(programId as any, `cli-${Date.now()}`);
  program.observe.lane = live ? 'live' : 'hermetic';

  console.log(`Running observe program: ${program.name} (${program.observe.lane})`);

  const result = await observeRun({ program, deps, runReview: true });

  console.log(`\nRun completed: ${result.runId}`);
  console.log(`Verdict: ${result.verdict.overall.toUpperCase()}`);
  console.log(`Findings: ${result.verdict.findings.length}`);
  console.log(`Bundle: ${result.bundleDir}`);
  console.log(`Report: ${result.reportPath}`);

  if (result.taskPath) {
    console.log(`Repair task: ${result.taskPath}`);
    console.log('\nTo verify a fix:');
    console.log(`  senars observe verify --task ${result.taskPath} --worktree <shadow-worktree-path>`);
  }

  if (publish) {
    await publishRun(result);
  }

  return result.verdict.overall === 'pass' ? 0 : 1;
}

async function cmdRecord(flags: Flags): Promise<number> {
  const command = flags.str('command', '') || flags.str('c', '');
  const name = flags.str('name', '') || flags.str('n', '');
  const surfaces = (flags.str('surfaces', '') || flags.str('s', '') || 'console').split(',') as ('console' | 'ui')[];
  const live = flags.has('live');

  if (!command || !name) {
    console.error('Error: --command and --name required');
    return 1;
  }

  console.log(`Recording: ${command} (as ${name})`);

  const result = await observeRecord(command, name, surfaces, live ? 'live' : 'hermetic');

  console.log(`\nRecording completed: ${result.runId}`);
  console.log(`Bundle: ${result.bundleDir}`);

  return 0;
}

async function cmdReview(flags: Flags): Promise<number> {
  const runId = flags.positional.shift();
  if (!runId) {
    console.error('Error: runId required');
    return 1;
  }

  const bundleDir = findBundle(runId);
  if (!bundleDir) {
    console.error(`Error: Bundle not found: ${runId}`);
    return 1;
  }

  console.log(`Reviewing run: ${runId}`);

  const { reviewBundle } = await import('./review.js');
  const { runChecks } = await import('./checks.js');
  const manifest = JSON.parse(await fs.readFile(join(bundleDir, 'manifest.json'), 'utf-8'));
  const program = manifest.program;
  const checks = await runChecks(bundleDir, program);
  const verdict = await reviewBundle(bundleDir, program, checks);

  console.log(`\nVerdict: ${verdict.overall.toUpperCase()}`);
  console.log(`Findings: ${verdict.findings.length}`);

  for (const finding of verdict.findings) {
    console.log(`  [${finding.severity}] ${finding.kind}: ${finding.claim}`);
  }

  return verdict.overall === 'pass' ? 0 : 1;
}

async function cmdVerify(flags: Flags): Promise<number> {
  const taskPath = flags.str('task', '') || flags.str('t', '');
  const worktreePath = flags.str('worktree', '') || flags.str('w', '');

  if (!taskPath || !worktreePath) {
    console.error('Error: --task and --worktree required');
    return 1;
  }

  console.log(`Verifying task: ${taskPath}`);
  console.log(`Worktree: ${worktreePath}`);

  const result = await verifyTask(taskPath, worktreePath);

  console.log(`\nVerification: ${result.accepted ? 'ACCEPTED' : 'REJECTED'}`);
  console.log(`New run: ${result.runId}`);

  for (const detail of result.details) {
    console.log(`  ${detail}`);
  }

  if (result.accepted) {
    console.log('\nFix accepted. To promote:');
    console.log(`  senars observe promote ${result.runId}`);
  }

  return result.accepted ? 0 : 1;
}

async function cmdDiff(flags: Flags): Promise<number> {
  const runA = flags._.shift();
  const runB = flags._.shift();

  if (!runA || !runB) {
    console.error('Error: Two run IDs required');
    return 1;
  }

  console.log(`Diffing: ${runA} vs ${runB}`);

  const result = await diffRuns(runA, runB);

  console.log(`\nEvent digest match: ${result.eventDigestMatch ? 'YES' : 'NO'}`);
  console.log(`First divergent mark: ${result.firstDivergentMark ?? 'none'}`);
  console.log(`Verdict delta: ${result.verdictDelta.overallA} -> ${result.verdictDelta.overallB}`);
  console.log(`Findings added: ${result.verdictDelta.findingsAdded.length}`);
  console.log(`Findings removed: ${result.verdictDelta.findingsRemoved.length}`);
  console.log(`Frame hash deltas: ${result.frameHashDeltas.length}`);
  console.log(`Gate snapshot deltas: ${result.gateSnapshotDeltas}`);

  return 0;
}

async function cmdBisect(flags: Flags): Promise<number> {
  const programId = flags.str('program', '') || flags.str('p', '');
  const goodSha = flags.str('good', '');
  const badSha = flags.str('bad', '');

  if (!programId || !goodSha || !badSha) {
    console.error('Error: --program, --good, and --bad required');
    return 1;
  }

  console.log(`Bisecting ${programId}: ${goodSha} (good) -> ${badSha} (bad)`);

  try {
    const badCommit = await bisect(programId, goodSha, badSha);
    console.log(`\nRegression introduced in: ${badCommit}`);
    return 0;
  } catch (error) {
    console.error(`Bisect failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

async function cmdPromote(flags: Flags): Promise<number> {
  const runId = flags._.shift();
  if (!runId) {
    console.error('Error: runId required');
    return 1;
  }

  console.log(`Promoting run: ${runId}`);

  const result = await promoteRun(runId);

  console.log(`\nPromoted to fixture: ${result.profileName}`);
  console.log(`Fixture path: ${result.fixturePath}`);

  if (result.hardeningSuggestion) {
    console.log(`\nHardening suggestion written to: ${join(result.fixturePath, 'hardening-suggestion.md')}`);
  }

  console.log('\nTo register in scenario-profiles.ts (manual step):');
  console.log(`  Add '${result.profileName}' to SCENARIO_PROFILES array`);

  return 0;
}

async function cmdExport(flags: Flags): Promise<number> {
  const runId = flags.positional.shift();
  const format = flags.str('format', '') || flags.str('f', '') || 'report';
  const output = flags.str('output', '') || flags.str('o', '');

  if (!runId) {
    console.error('Error: runId required');
    return 1;
  }

  console.log(`Exporting ${runId} as ${format}...`);

  const bundleDir = findBundle(runId);
  if (!bundleDir) {
    console.error(`Error: Bundle not found: ${runId}`);
    return 1;
  }

  const outPath = output || join(process.cwd(), 'generated', 'observations', `${runId}.${format}`);

  switch (format) {
    case 'report': {
      const { renderReport } = await import('./report.js');
      const manifest = JSON.parse(await fs.readFile(join(bundleDir, 'manifest.json'), 'utf-8'));
      const verdict = JSON.parse(await fs.readFile(join(bundleDir, 'verdict.json'), 'utf-8'));
      const checks = JSON.parse(await fs.readFile(join(bundleDir, 'checks.json'), 'utf-8'));
      const report = renderReport(manifest, verdict, checks);
      await fs.writeFile(outPath, report);
      break;
    }
    case 'cast': {
      const castPath = join(bundleDir, 'console.cast');
      await fs.cp(castPath, outPath);
      break;
    }
    case 'webm': {
      const webmPath = join(bundleDir, 'ui.webm');
      await fs.cp(webmPath, outPath);
      break;
    }
    case 'gif': {
      console.log('GIF export requires ffmpeg. Run manually:');
      console.log(`  ffmpeg -i ${join(bundleDir, 'ui.webm')} -vf "fps=10,scale=640:-1:flags=lanczos" -loop 0 ${outPath}`);
      return 1;
    }
    default:
      console.error(`Unknown format: ${format}`);
      return 1;
  }

  console.log(`Exported to: ${outPath}`);
  return 0;
}

async function cmdReplay(flags: Flags): Promise<number> {
  const runId = flags.positional.shift();
  const speed = flags.str('speed', '1x');

  if (!runId) {
    console.error('Error: runId required');
    return 1;
  }

  console.log(`Replaying ${runId} at ${speed}...`);

  const bundleDir = findBundle(runId);
  if (!bundleDir) {
    console.error(`Error: Bundle not found: ${runId}`);
    return 1;
  }

  const castPath = join(bundleDir, 'console.cast');
  console.log(`\nTo replay console cast:`);
  console.log(`  asciinema play ${castPath} --speed ${speed.replace('x', '')}`);

  const webmPath = join(bundleDir, 'ui.webm');
  console.log(`\nTo view UI video:`);
  console.log(`  Open ${webmPath} in browser or:`);
  console.log(`  npx serve ${bundleDir}  # then open http://localhost:3000/ui.webm`);

  return 0;
}

function findBundle(runId: string): string | null {
  const possiblePaths = [
    join(process.cwd(), '.cache', 'observations', runId),
    join(process.cwd(), 'generated', 'observations', runId),
  ];
  for (const path of possiblePaths) {
    try {
      require('node:fs').accessSync(path);
      return path;
    } catch {
      continue;
    }
  }
  return null;
}

async function publishRun(result: ObserveRunResult): Promise<void> {
  const generatedDir = join(process.cwd(), 'generated', 'observations', result.runId);
  await fs.mkdir(generatedDir, { recursive: true });

  await fs.cp(result.reportPath, join(generatedDir, 'report.md'));
  await fs.cp(join(result.bundleDir, 'console.cast'), join(generatedDir, 'console.cast'));

  console.log(`Published to: ${generatedDir}`);
}