import {Logger} from './Logger.js';
import {getPlatform} from '../platform/index.js';

export class FileUtils {
    static get platform() {
        return getPlatform();
    }

    static get readonlyExclusions() {
        return new Set([
            'src/parser/peggy-parser.js',
            'peggy-parser.js',
            './peggy-parser.js',
            'peggy-parser.js',
            'node_modules/**/*',
            '.git/**/*',
            'dist/**/*',
            'build/**/*',
            '.next/**/*',
            'coverage/**/*',
            'node_modules/*',
            '.git/*',
            'dist/*',
            'build/*',
            '.next/*',
            'coverage/*'
        ]);
    }

    static isExcludedPath(filePath) {
        const normalizedPath = this.platform.path.normalize(filePath).replace(/\\/g, '/');
        return Array.from(this.readonlyExclusions).some(exclusion => {
            if (exclusion.startsWith('**/')) {
                return normalizedPath.includes(exclusion.substring(3));
            } else if (exclusion.endsWith('/*')) {
                const prefix = exclusion.slice(0, -2);
                return normalizedPath.startsWith(prefix) || normalizedPath.includes(`/${prefix}`);
            } else {
                return normalizedPath.includes(exclusion);
            }
        });
    }

    static readJSONFile(filePath) {
        try {
            const content = this.platform.fs.readFile(filePath, 'utf8');
            if (!content.trim()) {
                Logger.warn(`Empty content when parsing JSON from: ${filePath}`);
                return null;
            }
            return JSON.parse(content);
        } catch (error) {
            Logger.error(`Error parsing JSON from ${filePath}:`, {message: error.message});
            return null;
        }
    }

    static analyzeCoverageByFile(verbose = false) {
        const TOP_N = 20;
        try {
            const coverageDetailPath = './coverage/coverage-final.json';
            if (!this.platform.fs.exists(coverageDetailPath)) {
                return [];
            }

            let coverageDetail;
            try {
                const fileContent = this.platform.fs.readFile(coverageDetailPath, 'utf8');
                if (!fileContent.trim()) {
                    Logger.error('Coverage file is empty');
                    return [];
                }
                coverageDetail = JSON.parse(fileContent);
            } catch (parseError) {
                Logger.error('Error parsing coverage-final.json:', {message: parseError.message});
                return [];
            }

            const files = [];
            for (const [rawPath, coverage] of Object.entries(coverageDetail)) {
                try {
                    if (!rawPath || typeof rawPath !== 'string') {
                        continue; // Skip invalid file paths
                    }

                    let filePath = rawPath;
                    if (filePath.startsWith('./')) {
                        filePath = this.platform.path.resolve(filePath);
                    }

                    // Skip excluded files
                    const relativePath = this.platform.path.relative(process.cwd(), filePath);
                    if (this.isExcludedPath(relativePath)) {
                        continue;
                    }

                    // Validate coverage structure before accessing properties
                    if (!coverage || typeof coverage !== 'object' || !coverage.s) {
                        if (verbose) {
                            Logger.warn(`Invalid coverage structure for file: ${filePath}`);
                        }
                        continue;
                    }

                    const summary = coverage.s;
                    if (typeof summary !== 'object') {
                        continue; // Skip if summary is not an object
                    }

                    const statementKeys = Object.keys(summary);
                    const coveredStatements = statementKeys.filter(key => {
                        const value = summary[key];
                        return typeof value === 'number' && value > 0;
                    }).length;
                    const statementCount = statementKeys.length;

                    const lineCoverage = statementCount > 0 ? (coveredStatements / statementCount) * 100 : 100;

                    let fileSize = 0;
                    try {
                        if (this.platform.fs.exists(filePath)) {
                            fileSize = this.platform.fs.statSync(filePath).size;
                        }
                    } catch (e) {
                        // If we can't get file size, continue with 0
                    }

                    files.push({
                        filePath: this.platform.path.relative(process.cwd(), filePath),
                        lineCoverage: parseFloat(lineCoverage.toFixed(2)),
                        statements: statementCount,
                        covered: coveredStatements,
                        uncovered: statementCount - coveredStatements,
                        size: fileSize
                    });
                } catch (fileError) {
                    // Skip this file if there's an error processing it
                    if (verbose) {
                        Logger.warn(`Error processing coverage for ${filePath}:`, {message: fileError.message});
                    }

                }
            }

            files.sort((a, b) => {
                if (a.lineCoverage !== b.lineCoverage) {
                    return a.lineCoverage - b.lineCoverage;
                }
                if (a.size !== b.size) {
                    return b.size - a.size;
                }
                return b.statements - a.statements;
            });

            return files.slice(0, TOP_N);
        } catch (error) {
            Logger.error('Error in analyzeCoverageByFile:', {message: error.message});
            return [];
        }
    }
}
