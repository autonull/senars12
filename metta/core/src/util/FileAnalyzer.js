import {spawnSync} from 'child_process';
import fs from 'fs';
import path from 'path';

export class TestUtils {
    static async runTestsAndGetCoverage() {
        // Try running tests with coverage enabled
        const testResult = spawnSync('npx', ['jest', '--config', 'jest.config.cjs', '--json', '--coverage', '--coverageReporters=json-summary'], {
            cwd: process.cwd(),
            timeout: 180000,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                NODE_NO_WARNINGS: '1',
                NODE_OPTIONS: '--experimental-vm-modules'
            }
        });

        return testResult;
    }
}

export class FileAnalyzer {
    static collectTestFiles() {
        const testFiles = [];
        const searchPaths = ['./tests', './test', './src'];

        const isTestFile = (fileName) => {
            return fileName.endsWith('.test.js') ||
                fileName.endsWith('.spec.js') ||
                fileName.includes('_test.js') ||
                fileName.includes('_spec.js');
        };

        for (const searchPath of searchPaths) {
            if (fs.existsSync(searchPath)) {
                this._collectTestFilesRecursively(searchPath, testFiles, isTestFile);
            }
        }

        return testFiles;
    }

    static _collectTestFilesRecursively(dir, testFiles, isTestFile) {
        if (!fs.existsSync(dir)) {
            return;
        }

        const items = fs.readdirSync(dir, {withFileTypes: true});

        for (const item of items) {
            const fullPath = path.join(dir, item.name);

            if (item.isDirectory()) {
                this._collectTestFilesRecursively(fullPath, testFiles, isTestFile);
            } else if (item.isFile() && isTestFile(item.name)) {
                const relPath = path.relative('.', fullPath);
                testFiles.push(relPath);
            }
        }
    }
}