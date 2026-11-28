import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'crypto';
import { EventBus } from '@senars/events/event-bus';
import type { CognitiveEvent } from '@senars/schemas/cognitive-events';
import { getLogger } from './logger.js';
import type { Manifest, Mark } from './schema.js';

const logger = getLogger('ObserveRecorder');

export interface RecorderOptions {
  bundleDir: string;
  surfaces: ('console' | 'ui')[];
  keyframeMarks: string[];
  maxFrames: number;
  lane: 'hermetic' | 'live';
  eventBus: EventBus;
  uiUrl?: string;
}

interface FrameHash {
  hash: string;
  timestamp: number;
  markId?: string;
}

export class Recorder {
  #options: RecorderOptions;
  #castFile: string;
  #eventsFile: string;
  #marksFile: string;
  #framesDir: string;
  #frameHashes: FrameHash[] = [];
  #marks: Mark[] = [];
  #castStartTime: number;
  #videoStartTime: number;
  #frameCounter = 0;
  #eventSeq = 0;
  #lastFrameHash = '';
  #identicalFrameCount = 0;
  #consolePty: any = null;
  #playwrightContext: any = null;
  #page: any = null;
  #videoPath: string = '';
  #tracePath: string = '';

  constructor(options: RecorderOptions) {
    this.#options = options;
    this.#castFile = join(options.bundleDir, 'console.cast');
    this.#eventsFile = join(options.bundleDir, 'events.jsonl');
    this.#marksFile = join(options.bundleDir, 'marks.jsonl');
    this.#framesDir = join(options.bundleDir, 'frames');
    this.#castStartTime = Date.now();
    this.#videoStartTime = Date.now();
  }

  async start(): Promise<void> {
    await fs.mkdir(this.#framesDir, { recursive: true });

    if (this.#options.surfaces.includes('console')) {
      await this.#startConsoleRecording();
    }

    if (this.#options.surfaces.includes('ui')) {
      await this.#startUIRecording();
    }

    this.#subscribeToEvents();
    this.#subscribeToMarks();
  }

  async #startConsoleRecording(): Promise<void> {
    try {
      const { spawn } = await import('node-pty');
      this.#consolePty = spawn('bash', [], {
        name: 'xterm-color',
        cols: 120,
        rows: 32,
        cwd: process.cwd(),
        env: { ...process.env, TERM: 'xterm-color' },
      });

      this.#consolePty.onData((data: string) => {
        const t = (Date.now() - this.#castStartTime) / 1000;
        this.#writeCastFrame(t, 'o', data);
      });

      this.#consolePty.onExit(() => {
        logger.debug('Console PTY exited');
      });
    } catch (error) {
      logger.warn('Failed to start console recording', { error });
    }
  }

  async #startUIRecording(): Promise<void> {
    try {
      const { chromium } = await import('playwright-core');
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        recordVideo: { dir: this.#options.bundleDir, size: { width: 1280, height: 720 } },
        viewport: { width: 1280, height: 720 },
      });

      await context.tracing.start({ screenshots: true, snapshots: true });

      this.#playwrightContext = context;
      this.#page = await context.newPage();

      this.#page.on('websocket', (ws: any) => {
        logger.debug('WebSocket connection opened');
      });

      this.#page.on('framenavigated', () => {
        this.#captureKeyframe('navigation');
      });

      // Navigate to UI URL if provided
      if (this.#options.uiUrl) {
        try {
          await this.#page.goto(this.#options.uiUrl, { waitUntil: 'networkidle', timeout: 30000 });
          logger.info('Navigated to UI URL', { url: this.#options.uiUrl });
        } catch (error) {
          logger.warn('Failed to navigate to UI URL', { url: this.#options.uiUrl, error });
        }
      }

      this.#videoPath = join(this.#options.bundleDir, 'ui.webm');
      this.#tracePath = join(this.#options.bundleDir, 'ui-trace.zip');
    } catch (error) {
      logger.warn('Failed to start UI recording', { error });
    }
  }

  #subscribeToEvents(): void {
    this.#options.eventBus.on('*', (event: CognitiveEvent) => {
      this.#writeEvent(event);
    });
  }

  #subscribeToMarks(): void {
    this.#options.eventBus.on('mark', (mark: { id: string; label: string }) => {
      this.#recordMark(mark.id, mark.label);
    });
  }

  #writeCastFrame(time: number, type: 'o' | 'i', data: string): void {
    const frame = [time, type, data];
    const line = JSON.stringify(frame) + '\n';
    fs.appendFile(this.#castFile, line).catch((err) => logger.warn('Failed to write cast frame', { err }));
  }

  #writeEvent(event: CognitiveEvent): void {
    this.#eventSeq++;
    const entry = {
      seq: this.#eventSeq,
      ts: Date.now(),
      event,
    };
    const line = JSON.stringify(entry) + '\n';
    fs.appendFile(this.#eventsFile, line).catch((err) => logger.warn('Failed to write event', { err }));
  }

  #recordMark(id: string, label: string): void {
    const castT = (Date.now() - this.#castStartTime) / 1000;
    const videoT = (Date.now() - this.#videoStartTime) / 1000;
    const mark: Mark = { id, label, t: Date.now(), castT, videoT };
    this.#marks.push(mark);

    const line = JSON.stringify(mark) + '\n';
    fs.appendFile(this.#marksFile, line).catch((err) => logger.warn('Failed to write mark', { err }));

    if (this.#options.keyframeMarks.includes(id)) {
      this.#captureKeyframe(id);
    }
  }

  async #captureKeyframe(markId: string): Promise<void> {
    if (this.#frameCounter >= this.#options.maxFrames) return;

    try {
      let screenshot: Buffer;

      if (this.#page) {
        screenshot = await this.#page.screenshot({ fullPage: true, type: 'jpeg', quality: 80 });
      } else {
        return;
      }

      const hash = createHash('sha256').update(screenshot).digest('hex').slice(0, 16);

      if (hash === this.#lastFrameHash) {
        this.#identicalFrameCount++;
        if (this.#identicalFrameCount >= 6) {
          logger.debug('Frozen UI detected', { markId, identicalFrames: this.#identicalFrameCount });
        }
        return;
      }

      this.#identicalFrameCount = 0;
      this.#lastFrameHash = hash;

      const frameName = `frame_${this.#frameCounter.toString().padStart(4, '0')}_${markId}.jpg`;
      const framePath = join(this.#framesDir, frameName);
      await fs.writeFile(framePath, screenshot);

      this.#frameHashes.push({
        hash,
        timestamp: Date.now(),
        markId,
      });
      this.#frameCounter++;
    } catch (error) {
      logger.warn('Failed to capture keyframe', { markId, error });
    }
  }

  async stop(): Promise<{ manifest: Manifest; eventDigest: string }> {
    if (this.#consolePty) {
      this.#consolePty.kill();
      this.#consolePty = null;
    }

    if (this.#playwrightContext) {
      await this.#playwrightContext.tracing.stop({ path: this.#tracePath });
      await this.#playwrightContext.close();
      this.#playwrightContext = null;
      this.#page = null;
    }

    const marksContent = await fs.readFile(this.#marksFile, 'utf-8').catch(() => '');
    const marks = marksContent.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));

    const eventsContent = await fs.readFile(this.#eventsFile, 'utf-8').catch(() => '');
    const eventLines = eventsContent.trim().split('\n').filter(Boolean);
    const eventDigest = createHash('sha256').update(eventsContent).digest('hex');

    const manifest: Manifest = {
      runId: this.#options.bundleDir.split('/').pop() ?? 'unknown',
      program: {},
      gitSha: await this.#getGitSha(),
      seed: '',
      lane: this.#options.lane,
      marks,
      artifactHashes: {
        'console.cast': await this.#hashFile(this.#castFile),
        'ui.webm': await this.#hashFile(this.#videoPath),
        'ui-trace.zip': await this.#hashFile(this.#tracePath),
        'events.jsonl': eventDigest,
        'frames': createHash('sha256').update(JSON.stringify(this.#frameHashes)).digest('hex'),
      },
      eventDigest,
      fromSeq: 1,
      toSeq: this.#eventSeq,
    };

    await fs.writeFile(join(this.#options.bundleDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await fs.writeFile(join(this.#options.bundleDir, 'frames.json'), JSON.stringify(this.#frameHashes, null, 2));

    return { manifest, eventDigest };
  }

  async #getGitSha(): Promise<string> {
    try {
      const { execSync } = await import('node:child_process');
      return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  async #hashFile(path: string): Promise<string> {
    try {
      const content = await fs.readFile(path);
      return createHash('sha256').update(content).digest('hex');
    } catch {
      return 'missing';
    }
  }

  getMarks(): Mark[] {
    return [...this.#marks];
  }

  getFrameHashes(): FrameHash[] {
    return [...this.#frameHashes];
  }

  getEventSeq(): number {
    return this.#eventSeq;
  }
}

export async function createRecorder(options: RecorderOptions): Promise<Recorder> {
  const recorder = new Recorder(options);
  await recorder.start();
  return recorder;
}