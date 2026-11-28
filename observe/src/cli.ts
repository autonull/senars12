import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getLogger } from './logger.js';
import { type Flags, parseFlags } from '@senars/util/cli';
import { observeRun, observeRecord } from './run.js';
import { verifyTask } from './verify.js';
import { diffRuns, bisect } from './diff.js';
import { promoteRun } from './promote.js';
import { getObserveProgram, listObservePrograms } from './programs.js';
import type { ScenarioProfile } from './programs.js';
import { runDriftGate } from './drift.js';
import { findBundle, readBundle, Paths } from './bundle.js';
import type { ObserveRunResult } from './run.js';
import type { VerifyResult } from './verify.js';
import type { ScenarioRunnerDeps } from '@senars/tools/adapters/scenario-execute';
import { execSync } from 'node:child_process';

const logger = getLogger('ObserveCLI');

export interface ObserveCLIOptions {
  deps: ScenarioRunnerDeps;
}

export async function observeCLI(argv: string[], options: ObserveCLIOptions): Promise<number> {
  const flags = parseFlags(argv);
  const subcommand = flags.positional.shift() as string | undefined;

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
    case 'drift':
      return await cmdDrift(flags);
    case 'tour':
      return await cmdTour(flags);
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
  drift <runId>           Check for drift against baseline
  tour <runId>            Generate narrative tour from run

OPTIONS:
  --program, -p       Program ID (for run)
  --live              Use live lane (real-time, non-deterministic)
  --publish           Publish GIF/cast/report to generated/observations
  --surfaces          Comma-separated: console,ui (default: console)
  --ui-url, -u        URL to navigate to for UI recording
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
  senars observe run --program contradictory_sensors --surfaces console,ui --ui-url http://localhost:3000
  senars observe record --command "pnpm senars run --profile agent" --name my-debug
  senars observe record --command "npx serve dist" --name ui-demo --surfaces console,ui --ui-url http://localhost:3000
  senars observe verify --task .cache/observations/.../repair-task.json --worktree .shadow/abc123
  senars observe diff runA runB
  senars observe bisect --program contradictory_sensors --good abc123 --bad def456
  senars observe promote verify_123
  senars observe export run123 --format gif --output demo.gif
  senars observe replay run123 --speed 2x --serve
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
  const surfaces = (flags.str('surfaces', '') || flags.str('s', '') || 'console').split(',') as ('console' | 'ui')[];
  const uiUrl = flags.str('ui-url', '') || flags.str('u', '');
  const program = getObserveProgram(programId as ScenarioProfile, `cli-${Date.now()}`);
  program.observe.lane = live ? 'live' : 'hermetic';
  program.observe.surfaces = surfaces;
  if (uiUrl) program.observe.uiUrl = uiUrl;

  console.log(`Running observe program: ${program.name} (${program.observe.lane})`);
  if (surfaces.includes('ui')) {
    console.log(`  UI recording enabled${uiUrl ? ` -> ${uiUrl}` : ''}`);
  }

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
  const uiUrl = flags.str('ui-url', '') || flags.str('u', '');

  if (!command || !name) {
    console.error('Error: --command and --name required');
    return 1;
  }

  console.log(`Recording: ${command} (as ${name})`);
  if (surfaces.includes('ui')) {
    console.log(`  UI recording enabled${uiUrl ? ` -> ${uiUrl}` : ''}`);
  }

  const result = await observeRecord(command, name, surfaces, live ? 'live' : 'hermetic', uiUrl || undefined);

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
  const runA = flags.positional.shift();
  const runB = flags.positional.shift();

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
  const runId = flags.positional.shift();
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

  const outPath = output || join(Paths.generatedObservations, `${runId}.${format}`);

  switch (format) {
    case 'report': {
      const { renderReport } = await import('./report.js');
      const data = await readBundle(bundleDir);
      const report = renderReport(data.manifest!, data.verdict!, data.checks);
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
      try {
        execSync(`ffmpeg -y -i ${join(bundleDir, 'ui.webm')} -vf "fps=10,scale=640:-1:flags=lanczos" -loop 0 ${outPath}`, {
          stdio: 'pipe',
        });
      } catch (error) {
        console.error('GIF export failed. Is ffmpeg installed?');
        console.log(`  Manual: ffmpeg -i ${join(bundleDir, 'ui.webm')} -vf "fps=10,scale=640:-1:flags=lanczos" -loop 0 ${outPath}`);
        return 1;
      }
      break;
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
  const serve = flags.has('serve');
  const port = parseInt(flags.str('port', '3000'), 10);

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

  if (serve) {
    console.log(`  Starting HTTP server on port ${port}...`);
    await serveBundle(bundleDir, port);
  } else {
    console.log(`  npx serve ${bundleDir}  # then open http://localhost:${port}/ui.webm`);
  }

  return 0;
}

async function serveBundle(bundleDir: string, port: number): Promise<void> {
  const http = await import('node:http');
  const { createReadStream, statSync } = await import('node:fs');
  const { extname } = await import('node:path');

  const mimeTypes: Record<string, string> = {
    '.webm': 'video/webm',
    '.cast': 'application/octet-stream',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.jpg': 'image/jpeg',
    '.jsonl': 'application/json',
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    let filePath = join(bundleDir, url.pathname.slice(1));
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(bundleDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    try {
      const stat = statSync(filePath);
      if (stat.isDirectory()) {
        filePath = join(filePath, 'index.html');
      }
    } catch {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(res);
  });

  server.listen(port, () => {
    console.log(`  Server running at http://localhost:${port}`);
    console.log(`  UI video: http://localhost:${port}/ui.webm`);
    console.log(`  Console cast: http://localhost:${port}/console.cast`);
    console.log(`  Report: http://localhost:${port}/report.md`);
    console.log('  Press Ctrl+C to stop');
  });

  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      server.close(() => resolve());
    });
  });
}

async function cmdDrift(flags: Flags): Promise<number> {
  const runId = flags.positional.shift();
  if (!runId) {
    console.error('Error: runId required');
    return 1;
  }

  console.log(`Checking drift for run: ${runId}`);

  const result = await runDriftGate(runId);

  console.log(`\nDrift check: ${result.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Baseline run: ${result.baselineRunId}`);
  console.log(`Current run: ${result.currentRunId}`);
  console.log(`Event digest match: ${result.eventDigestMatch ? 'YES' : 'NO'}`);
  console.log(`Frame similarity: ${(result.frameSimilarity * 100).toFixed(1)}%`);
  console.log(`Gate state match: ${result.gateStateMatch ? 'YES' : 'NO'}`);

  if (result.details.length > 0) {
    console.log('\nDetails:');
    for (const detail of result.details) {
      console.log(`  ${detail}`);
    }
  }

  return result.passed ? 0 : 1;
}

async function cmdTour(flags: Flags): Promise<number> {
  const runId = flags.positional.shift();
  const format = flags.str('format', '') || flags.str('f', '') || 'markdown';
  const output = flags.str('output', '') || flags.str('o', '');

  if (!runId) {
    console.error('Error: runId required');
    return 1;
  }

  console.log(`Generating tour for run: ${runId}`);

  const { generateTour, renderTourMarkdown, saveTour } = await import('./tour.js');

  const tour = await generateTour(runId);

  if (format === 'json') {
    const outPath = output || join(Paths.generatedTours, `${tour.runId}-tour.json`);
    await saveTour(tour, outPath);
    console.log(`Tour saved to: ${outPath}`);
  } else {
    const markdown = await renderTourMarkdown(tour);
    const outPath = output || join(Paths.generatedTours, `${tour.runId}-tour.md`);
    await saveTourMarkdown(markdown, tour.runId, outPath);
    console.log(`Tour saved to: ${outPath}`);
  }

  console.log(`\nSummary: ${tour.summary.split('\n')[0]}`);
  console.log(`Steps: ${tour.steps.length}`);

  return 0;
}

async function publishRun(result: ObserveRunResult): Promise<void> {
  const generatedDir = join(Paths.generatedObservations, result.runId);
  await fs.mkdir(generatedDir, { recursive: true });

  await fs.cp(result.reportPath, join(generatedDir, 'report.md'));
  await fs.cp(join(result.bundleDir, 'console.cast'), join(generatedDir, 'console.cast'));

  console.log(`Published to: ${generatedDir}`);
}