/**
 * Argument Parser utility for SeNARS Self-Analyzer
 */
import {Logger} from './Logger.js';

export class ArgParser {
    static getOptionsDefinition() {
        return {
            tests: {flags: ['--tests', '-t'], description: 'Run only test analysis'},
            coverage: {flags: ['--coverage', '-c'], description: 'Run only coverage analysis'},
            testcoverage: {
                flags: ['--testcoverage', '--tc'],
                description: 'Run test coverage analysis with causal relationships'
            },
            static: {flags: ['--static', '-s'], description: 'Run only static code analysis'},
            project: {flags: ['--project', '-p'], description: 'Run only project info analysis'},
            requirements: {flags: ['--requirements', '-r'], description: 'Run only requirements analysis'},
            featurespecs: {
                flags: ['--features', '--featurespecs', '-f'],
                description: 'Run only feature specifications analysis'
            },
            technicaldebt: {
                flags: ['--technicaldebt', '--debt', '-d'],
                description: 'Run only technical debt analysis'
            },
            architecture: {
                flags: ['--architecture', '--arch', '-ar'],
                description: 'Run only architecture analysis'
            },
            planning: {
                flags: ['--planning', '--plan', '-pl'],
                description: 'Run only planning indicators analysis'
            },
            slowest: {flags: ['--slowest', '-sl'], description: 'Show slowest tests analysis'},
            verbose: {flags: ['--verbose', '-v'], description: 'Verbose output'},
            summaryOnly: {flags: ['--summary-only', '-S'], description: 'Show only summary output'},
            all: {flags: ['--all', '-a'], description: 'Run all analyses (default behavior)'},
            help: {flags: ['--help', '-h'], description: 'Show this help message'}
        };
    }

    static parse(args) {
        const options = this.getDefaultOptions();
        const optionDefs = this.getOptionsDefinition();

        // Process each argument
        for (const arg of args) {
            let matched = false;

            for (const [option, def] of Object.entries(optionDefs)) {
                if (def.flags.includes(arg)) {
                    options[option] = true;
                    matched = true;

                    // If a specific analysis flag is set, turn off 'all' mode
                    if (option !== 'all' && option !== 'help' && option !== 'slowest' &&
                        option !== 'verbose' && option !== 'summaryOnly') {
                        options.all = false;
                    }
                    break;
                }
            }

            if (!matched) {
                Logger.error(`Unknown option: ${arg}`);
                options.help = true;
                break;
            }
        }

        return options;
    }

    static getDefaultOptions() {
        const optionDefs = this.getOptionsDefinition();
        const options = {};

        for (const [option,] of Object.entries(optionDefs)) {
            options[option] = false;
        }

        // 'all' is default behavior
        options.all = true;

        return options;
    }

    static getHelpMessage() {
        const optionDefs = this.getOptionsDefinition();
        const flagsList = [];

        for (const [option, def] of Object.entries(optionDefs)) {
            const flags = def.flags.join(', ');
            flagsList.push(`  ${flags.padEnd(25)} ${def.description}`);
        }

        return `
SeNARS Self-Analysis Script
Uses the system to analyze its own development status and provide insights

Usage: node scripts/analysis/self-analyze.js [options]

Options:
${flagsList.join('\n')}

Examples:
  node scripts/analysis/self-analyze.js                    # Run all analyses (default)
  node scripts/analysis/self-analyze.js -t -v              # Verbose test analysis only
  node scripts/analysis/self-analyze.js --coverage --slowest # Coverage + slowest tests
  node scripts/analysis/self-analyze.js -S                 # Summary output only
  node scripts/analysis/self-analyze.js -f                 # Feature specifications analysis only
  node scripts/analysis/self-analyze.js -d                 # Technical debt analysis only
  node scripts/analysis/self-analyze.js -ar                # Architecture analysis only
  node scripts/analysis/self-analyze.js -pl                # Planning indicators analysis only
  node scripts/analysis/self-analyze.js --testcoverage     # Test coverage analysis with causal relationships
`;
    }
}