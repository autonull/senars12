#!/usr/bin/env node

import {chromium} from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// Default paths
let screenshotsDir = path.join(rootDir, 'test-results/screenshots');
let outputDir = path.join(rootDir, 'test-results');

// Parse args
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
        screenshotsDir = path.resolve(process.cwd(), args[i + 1]);
        i++;
    } else if (args[i] === '--output' && args[i + 1]) {
        outputDir = path.resolve(process.cwd(), args[i + 1]);
        i++;
    }
}

async function generateComposite() {
    console.log(`Generating composite image...`);
    console.log(`Input: ${screenshotsDir}`);
    console.log(`Output: ${outputDir}`);

    try {
        // Ensure output dir exists
        await fs.mkdir(outputDir, {recursive: true});

        // Check if screenshots directory exists
        try {
            await fs.access(screenshotsDir);
        } catch {
            console.error('❌ Screenshots directory not found.');
            process.exit(1);
        }

        // Get all png files
        const files = await fs.readdir(screenshotsDir);
        const images = files.filter(f => f.endsWith('.png')).sort();

        if (images.length === 0) {
            console.error('❌ No screenshots found to generate composite.');
            process.exit(1);
        }

        console.log(`Found ${images.length} images.`);

        // Create HTML content
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: #1a1a1a;
            font-family: Arial, sans-serif;
            color: #eee;
        }
        h1 { text-align: center; margin-bottom: 20px; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(600px, 1fr)); /* Increased size */
            gap: 15px;
        }
        .card {
            background: #2a2a2a;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            border: 1px solid #444;
        }
        .card img {
            width: 100%;
            height: auto;
            display: block;
        }
        .card-info {
            padding: 10px;
            font-size: 14px;
            color: #aaa;
            background: #333;
            border-top: 1px solid #444;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    </style>
</head>
<body>
    <h1>SeNARS Demo Trajectory</h1>
    <div class="grid">
        ${images.map(img => `
            <div class="card">
                <img src="${path.relative(outputDir, path.join(screenshotsDir, img))}" loading="lazy" alt="${img}">
                <div class="card-info">${img}</div>
            </div>
        `).join('')}
    </div>
</body>
</html>
        `;

        const htmlPath = path.join(outputDir, 'composite.html');
        await fs.writeFile(htmlPath, htmlContent);
        console.log(`✓ HTML generated at ${htmlPath}`);

        // Launch browser to capture the composite
        const browser = await chromium.launch({headless: true});
        const context = await browser.newContext({
            viewport: {width: 1920, height: 1080}, // Start with a reasonable size
            deviceScaleFactor: 1
        });
        const page = await context.newPage();

        // Navigate to local file
        await page.goto(`file://${htmlPath}`, {waitUntil: 'networkidle'});

        // Calculate height needed
        const bodyHandle = await page.$('body');
        const boundingBox = await bodyHandle.boundingBox();
        const height = boundingBox.height + 40; // Add padding

        // Resize viewport to fit full content
        await page.setViewportSize({width: 1920, height: Math.ceil(height)});

        const outputPath = path.join(outputDir, 'composite.png');
        await page.screenshot({path: outputPath, fullPage: true});

        console.log(`✓ Composite image saved to ${outputPath}`);

        await browser.close();

    } catch (error) {
        console.error('❌ Error generating composite:', error);
        process.exit(1);
    }
}

generateComposite();
