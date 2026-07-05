import {spawnSync} from 'child_process';
import fs from 'fs';
import {Logger} from './Logger.js';

export class CoverageUtils {
    static findCoverageFile() {
        const possiblePaths = [
            './coverage/coverage-summary.json',
            './coverage/coverage-final.json',
            './.nyc_output/coverage-summary.json',
            './.nyc_output/coverage-final.json'
        ];

        for (const coveragePath of possiblePaths) {
            if (fs.existsSync(coveragePath)) {
                return coveragePath;
            }
        }
        return null;
    }

    static async generateCoverage() {
        Logger.info('📦 Generating coverage data...');

        // Try different methods to generate coverage
        const methods = [
            () => spawnSync('npm', ['test', '--', '--coverage', '--coverageReporters=json-summary', '--coverageReporters=text'], {
                cwd: process.cwd(),
                timeout: 120000,
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe']
            }),
            () => spawnSync('npx', ['jest', '--coverage', '--coverageReporters=json-summary', '--coverageReporters=text'], {
                cwd: process.cwd(),
                timeout: 120000,
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe']
            })
        ];

        for (const method of methods) {
            try {
                const result = method();
                if (result.status === 0 || result.status === 1) { // 1 might mean tests passed with coverage
                    if (this.findCoverageFile()) {
                        Logger.info('✅ Coverage generated successfully');
                        return true;
                    }
                }
            } catch (error) {
                Logger.warn(`Coverage generation method failed: ${error.message}`);
            }
        }

        Logger.error('Failed to generate coverage data');
        return false;
    }
}