#!/usr/bin/env node

import {chromium} from 'playwright';
import fs from 'fs/promises';
import path from 'path';

class ScreenshotGenerator {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.screenshots = [];
        this.outputDir = 'test-results/screenshots';
        this.lastBuffer = null;
    }

    async initialize(outputDir, options = {}) {
        console.log('Initializing screenshot generator (Playwright)...');

        if (outputDir) {
            this.outputDir = outputDir;
        }

        // Create output directories
        await fs.mkdir(this.outputDir, {recursive: true});

        // Launch browser
        this.browser = await chromium.launch({
            headless: true // Run headless for CI/server environments
        });

        const contextOptions = {
            viewport: {width: 1280, height: 720}
        };

        if (options.recordVideo) {
            contextOptions.recordVideo = {
                dir: this.outputDir,
                size: {width: 1280, height: 720}
            };
            console.log(`🎥 Video recording enabled in ${this.outputDir}`);
        }

        this.context = await this.browser.newContext(contextOptions);
        this.page = await this.context.newPage();

        console.log(`✓ Screenshot generator initialized. Output: ${this.outputDir}`);
    }

    async recordSession(url, duration) {
        console.log(`Recording session from ${url} for ${duration}ms...`);
        try {
            await this.page.goto(url, {waitUntil: 'networkidle'});
        } catch (e) {
            console.log(`Navigation note: ${e.message}`);
        }
        await this.delay(duration);
        console.log('Recording finished.');
    }

    async captureScreenshots(url, duration = 30000, interval = 2000, prefix = 'screenshot') {
        console.log(`Capturing screenshots from ${url} for ${duration}ms...`);

        try {
            await this.page.goto(url, {waitUntil: 'networkidle'});
        } catch (e) {
            console.log(`Navigation note: ${e.message} - continuing anyway`);
        }

        const startTime = Date.now();
        let count = 0;
        let skipped = 0;
        this.lastBuffer = null;

        while (Date.now() - startTime < duration) {
            const timestamp = Date.now();
            const screenshotPath = path.join(this.outputDir, `${prefix}_${count.toString().padStart(3, '0')}_${timestamp}.png`);

            const buffer = await this.page.screenshot({
                fullPage: true
            });

            if (this.lastBuffer && buffer.equals(this.lastBuffer)) {
                skipped++;
            } else {
                await fs.writeFile(screenshotPath, buffer);
                this.screenshots.push(screenshotPath);
                console.log(`✓ Screenshot ${count + 1} saved: ${screenshotPath}`);
                this.lastBuffer = buffer;
            }

            count++;
            await this.delay(interval);
        }

        console.log(`\n📊 Captured ${this.screenshots.length} screenshots (skipped ${skipped} duplicates)`);
        return this.screenshots;
    }

    // Added function to capture a single screenshot
    async captureSingleScreenshot(url, outputPath, prefix = 'single') {
        console.log(`Capturing single screenshot from ${url}...`);

        try {
            await this.page.goto(url, {waitUntil: 'networkidle'});
        } catch (e) {
            console.log(`Navigation note: ${e.message} - continuing anyway`);
        }

        const timestamp = Date.now();
        const screenshotPath = outputPath || path.join(this.outputDir, `${prefix}_${timestamp}.png`);

        const buffer = await this.page.screenshot({
            fullPage: true
        });

        await fs.writeFile(screenshotPath, buffer);
        this.screenshots.push(screenshotPath);
        console.log(`✓ Single screenshot saved: ${screenshotPath}`);

        return screenshotPath;
    }

    async capturePriorityFluctuations(url, duration = 30000) {
        console.log('Capturing priority fluctuation visualizations...');

        try {
            await this.page.goto(url, {waitUntil: 'networkidle'});
            // Wait for page to load completely
            await this.page.waitForSelector('[data-testid="task-monitor-container"]', {timeout: 10000});
        } catch (e) {
            console.log(`Navigation/Selector note: ${e.message} - continuing anyway`);
        }

        const startTime = Date.now();
        let count = 0;
        let skipped = 0;
        this.lastBuffer = null;

        while (Date.now() - startTime < duration) {
            // Look for elements that show priority changes
            const timestamp = Date.now();
            const screenshotPath = path.join(this.outputDir, `priority_fluctuation_${count.toString().padStart(3, '0')}_${timestamp}.png`);

            // Highlight priority-related elements temporarily
            await this.page.evaluate(() => {
                // Add temporary visual indicators for priority elements
                const priorityElements = document.querySelectorAll('[data-testid*="task-priority"]');
                priorityElements.forEach(el => {
                    el.style.border = '2px solid #ff0000';
                    el.style.backgroundColor = '#ffe6e6';
                });
            });

            const buffer = await this.page.screenshot({
                fullPage: true
            });

            // Remove highlights
            await this.page.evaluate(() => {
                const priorityElements = document.querySelectorAll('[data-testid*="task-priority"]');
                priorityElements.forEach(el => {
                    el.style.border = '';
                    el.style.backgroundColor = '';
                });
            });

            if (this.lastBuffer && buffer.equals(this.lastBuffer)) {
                skipped++;
            } else {
                await fs.writeFile(screenshotPath, buffer);
                this.screenshots.push(screenshotPath);
                console.log(`✓ Priority screenshot ${count + 1} saved: ${screenshotPath}`);
                this.lastBuffer = buffer;
            }

            count++;
            await this.delay(1500); // 1.5 second interval for priority changes
        }

        console.log(`\n📊 Captured ${this.screenshots.length} priority fluctuation screenshots (skipped ${skipped} duplicates)`);
        return this.screenshots;
    }

    async captureDerivations(url, duration = 30000) {
        console.log('Capturing derivation process...');

        try {
            await this.page.goto(url, {waitUntil: 'networkidle'});
            // Wait for page to load
            await this.page.waitForSelector('[data-testid="narsese-input-container"]', {timeout: 10000});
        } catch (e) {
            console.log(`Navigation/Selector note: ${e.message} - continuing anyway`);
        }

        const startTime = Date.now();
        let count = 0;
        let skipped = 0;
        this.lastBuffer = null;

        while (Date.now() - startTime < duration) {
            const timestamp = Date.now();
            const screenshotPath = path.join(this.outputDir, `derivation_${count.toString().padStart(3, '0')}_${timestamp}.png`);

            // Highlight derivation-related elements
            await this.page.evaluate(() => {
                // Add temporary highlights for derivation elements
                const derivationElements = document.querySelectorAll('[data-testid*="task-"]'); // All task elements
                derivationElements.forEach(el => {
                    el.style.border = '2px solid #00ff00';
                    el.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.5)';
                });
            });

            const buffer = await this.page.screenshot({
                fullPage: true
            });

            // Remove highlights
            await this.page.evaluate(() => {
                const derivationElements = document.querySelectorAll('[data-testid*="task-"]');
                derivationElements.forEach(el => {
                    el.style.border = '';
                    el.style.boxShadow = '';
                });
            });

            if (this.lastBuffer && buffer.equals(this.lastBuffer)) {
                skipped++;
            } else {
                await fs.writeFile(screenshotPath, buffer);
                this.screenshots.push(screenshotPath);
                console.log(`✓ Derivation screenshot ${count + 1} saved: ${screenshotPath}`);
                this.lastBuffer = buffer;
            }

            count++;
            await this.delay(2000); // 2 second interval for derivations
        }

        console.log(`\n📊 Captured ${this.screenshots.length} derivation screenshots (skipped ${skipped} duplicates)`);
        return this.screenshots;
    }

    async generateMovie(outputPath = 'test-results/videos/demo-movie.mp4', fps = 2) {
        console.log('⚠️ Movie generation skipped as per configuration.');
        return null;
    }

    async generateGif(outputPath = 'test-results/videos/demo-animation.gif', fps = 2) {
        console.log('⚠️ GIF generation skipped as per configuration.');
        return null;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
        console.log('✓ Screenshot generator cleaned up');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Command line interface
async function runGenerator() {
    const generator = new ScreenshotGenerator();

    try {
        const args = process.argv.slice(2);

        let mode = 'all';
        let url = 'http://localhost:5173';
        let duration = 30000;
        let interval = 2000;
        let outputDir = null;

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--type' && args[i + 1]) {
                mode = args[i + 1];
                i++;
            } else if (args[i] === '--url' && args[i + 1]) {
                url = args[i + 1];
                i++;
            } else if (args[i] === '--duration' && args[i + 1]) {
                duration = parseInt(args[i + 1]);
                i++;
            } else if (args[i] === '--interval' && args[i + 1]) {
                interval = parseInt(args[i + 1]);
                i++;
            } else if (args[i] === '--output' && args[i + 1]) {
                outputDir = args[i + 1];
                i++;
            }
            // Backward compatibility for positional args if not flagged
            else if (i === 0 && !args[i].startsWith('-')) {
                mode = args[i];
            } else if (i === 1 && !args[i].startsWith('-')) {
                url = args[i];
            }
        }

        await generator.initialize(outputDir, {
            recordVideo: mode === 'movie'
        });

        switch (mode) {
            case 'screenshots':
                await generator.captureScreenshots(url, duration, interval, 'demo');
                break;

            case 'single-screenshot':
                // For single screenshot mode, capture just one screenshot
                await generator.captureSingleScreenshot(url, outputDir, 'single');
                break;

            case 'priority':
                await generator.capturePriorityFluctuations(url, duration);
                break;

            case 'derivations':
                await generator.captureDerivations(url, duration);
                break;

            case 'movie':
                await generator.recordSession(url, duration);
                break;

            case 'gif':
                console.log('GIF mode requested: generating screenshots only.');
                await generator.captureScreenshots(url, duration / 2, 500, 'gif_frame');
                break;

            case 'all':
            default:
                // Capture different types of visualizations
                // Note: 'all' mode might be tricky with deduplication and shared output dir,
                // but we will proceed.
                await generator.captureScreenshots(url, duration / 3, interval, 'overview');
                await generator.capturePriorityFluctuations(url, duration / 3);
                await generator.captureDerivations(url, duration / 3);
                break;
        }

        console.log('\n🎉 Screenshot generation completed!');
        console.log(`📁 Screenshots: ${generator.screenshots.length} files`);

    } catch (error) {
        console.error('❌ Generator error:', error);
        process.exit(1);
    } finally {
        await generator.cleanup();
    }
}

// Execute
runGenerator();
