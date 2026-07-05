import {spawn} from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import WebSocket from 'ws';
import {waitForWebSocket} from './network-utils.js';
import ProcessUtils from './process-utils.js';

/**
 * Class responsible for running a single tour.
 */
export class TourRunner {
    /**
     * @param {Object} config - Configuration object.
     * @param {string} config.rootDir - The root directory of the project.
     * @param {boolean} config.logOnlyMode - Whether to run in log-only mode.
     * @param {boolean} config.movieMode - Whether to generate a movie.
     * @param {boolean} config.graphMode - Whether to enable graph mode.
     * @param {boolean} config.timedMode - Whether to run in timed mode.
     */
    constructor(config) {
        this.rootDir = config.rootDir;
        this.logOnlyMode = config.logOnlyMode;
        this.movieMode = config.movieMode;
        this.graphMode = config.graphMode;
        this.timedMode = config.timedMode;
    }

    /**
     * Runs a specific tour.
     * @param {Object} tour - The tour definition object.
     * @param {string} tour.id - The tour ID.
     * @param {number} tour.duration - The duration of the tour.
     * @param {number} uiPort - The port for the UI.
     * @param {number} wsPort - The port for the WebSocket server.
     * @param {Function} [onServerStart] - Callback invoked when server process starts (receives process object).
     */
    async run(tour, uiPort, wsPort, onServerStart) {
        console.log(`\nStarting Tour: ${tour.id} (UI: ${uiPort}, WS: ${wsPort})`);

        const outputDir = path.join(this.rootDir, 'test-results', tour.id);
        const screenshotsDir = path.join(outputDir, 'screenshots');
        const logFile = path.join(outputDir, 'demo.log');

        await fs.mkdir(outputDir, {recursive: true});
        const logStream = await fs.open(logFile, 'w');

        const serverArgs = [
            'scripts/ui/launcher.js',
            '--demo', tour.id,
            '--port', uiPort.toString(),
            '--ws-port', wsPort.toString(),
            '--no-open'
        ];

        if (tour.provider) {
            serverArgs.push('--provider', tour.provider);
        } else {
            serverArgs.push('--provider', 'dummy');
        }

        if (tour.model) {
            serverArgs.push('--model', tour.model);
        }

        if (tour.embedding) {
            serverArgs.push('--embedding');
        }
        if (tour.embeddingModel) {
            serverArgs.push('--embedding-model', tour.embeddingModel);
        }

        if (this.graphMode) {
            serverArgs.push('--graph-ui');
        }

        const serverProcess = spawn('node', serverArgs, {
            cwd: this.rootDir,
            stdio: ['ignore', logStream.fd, logStream.fd]
        });

        if (onServerStart) onServerStart(serverProcess);

        console.log(`Server started for ${tour.id} (PID: ${serverProcess.pid})`);

        try {
            const wsUrl = `ws://localhost:${wsPort}/ws`;
            if (!await waitForWebSocket(wsUrl)) {
                throw new Error(`Server for ${tour.id} failed to become ready`);
            }

            console.log(`Server ready for ${tour.id}`);

            if (this.logOnlyMode) {
                await this.waitForCompletion(wsPort, tour.id, tour.duration || 30000);
            } else {
                await this.runVisualization(tour, uiPort, wsPort, outputDir, screenshotsDir);
            }

            await this.checkCpuUsage(serverProcess.pid, logStream);

        } finally {
            serverProcess.kill();
            await logStream.close();
        }

        if (!this.logOnlyMode) {
            await this.generateComposite(outputDir, screenshotsDir, tour.id);
        }
    }

    /**
     * Helper to run a script and throw if it fails.
     */
    async runScript(command, args, options = {}) {
        const {code, stderr} = await ProcessUtils.spawnProcess(command, args, options);
        if (code !== 0) {
            throw new Error(`Command ${command} ${args.join(' ')} failed with code ${code}. Stderr: ${stderr}`);
        }
    }

    async runVisualization(tour, uiPort, wsPort, outputDir, screenshotsDir) {
        if (this.movieMode) {
            await this.runScript('node', [
                'scripts/utils/visualize.js',
                '--type', 'movie',
                '--duration', tour.duration.toString(),
                '--url', `http://localhost:${uiPort}`,
                '--output', outputDir
            ], {cwd: this.rootDir});
        } else if (this.timedMode) {
            await this.runScript('node', [
                'scripts/utils/visualize.js',
                '--type', 'screenshots',
                '--duration', tour.duration.toString(),
                '--interval', '1500',
                '--url', `http://localhost:${uiPort}`,
                '--output', screenshotsDir
            ], {cwd: this.rootDir});
        } else {
            await this.runEventDrivenScreenshots(tour, screenshotsDir, wsPort, `http://localhost:${uiPort}`);
        }
    }

    async waitForCompletion(wsPort, demoId, timeout) {
        return this.runEventDrivenScreenshots({id: demoId}, null, wsPort, null, timeout, true);
    }

    async runEventDrivenScreenshots(tour, screenshotsDir, wsPort, url, maxDuration = 20000, noScreenshots = false) {
        const ws = new WebSocket(`ws://localhost:${wsPort}/ws`);

        let screenshotCount = 0;
        const promises = [];

        return new Promise((resolve) => {
            const finish = async () => {
                ws.terminate();
                await Promise.all(promises);
                resolve();
            };

            const timer = setTimeout(finish, maxDuration);

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    eventTypes: ['demoState', 'nar.cycle.step', 'reasoning.derivation']
                }));
            });

            ws.on('message', async (data) => {
                try {
                    const msg = JSON.parse(data.toString());

                    if (msg.type === 'demoState' && (msg.payload.state === 'completed' || msg.payload.state === 'error')) {
                        clearTimeout(timer);
                        // Wait a bit to capture final outputs
                        await new Promise(r => setTimeout(r, 2000));
                        await finish();
                        return;
                    }

                    if (!noScreenshots && msg.type && ['nar.cycle.step', 'reasoning.derivation'].includes(msg.type)) {
                        screenshotCount++;

                        const p = this.runScript('node', [
                            'scripts/utils/visualize.js',
                            '--type', 'single-screenshot',
                            '--url', url,
                            '--output', path.join(screenshotsDir, `shot_${screenshotCount.toString().padStart(3, '0')}.png`)
                        ], {cwd: this.rootDir}).catch(err => console.error('Screenshot failed:', err.message));

                        promises.push(p);

                        if (screenshotCount >= 20) {
                            clearTimeout(timer);
                            await finish();
                        }
                    }
                } catch (e) {
                    // Ignore transient JSON parse errors or other minor glitches
                }
            });

            ws.on('error', () => {
                clearTimeout(timer);
                resolve();
            });
        });
    }

    async checkCpuUsage(pid, logStream) {
        try {
            const {stdout} = await ProcessUtils.executeCommand(`ps -p ${pid} -o %cpu`);
            const cpuUsage = stdout.trim().split('\n')[1]?.trim() || 'Unknown';
            await logStream.write(`\nFinal CPU Usage: ${cpuUsage}%\n`);
        } catch (e) {
            // Ignore if ps fails (e.g. on Windows or if process is already gone)
        }
    }

    async generateComposite(outputDir, screenshotsDir, tourId) {
        try {
            await this.runScript('node', [
                'scripts/utils/generate-composite.js',
                '--input', screenshotsDir,
                '--output', outputDir
            ], {cwd: this.rootDir});
        } catch (e) {
            console.error(`Composite generation failed for ${tourId}:`, e.message);
        }
    }
}
