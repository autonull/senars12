#!/usr/bin/env node
import {BaseTool} from '@senars/core/src/tool/BaseTool.js';
import {App} from '@senars/agent';
import {exec} from 'child_process';
import {promisify} from 'util';

const execAsync = promisify(exec);
const section = (title) => console.log(`\n${'═'.repeat(60)}\n${title}\n${'═'.repeat(60)}`);
const log = (...args) => console.log('  ', ...args);

// Custom Tool 1: Math Operations
class MathTool extends BaseTool {
    constructor(config = {}) {
        super('math', {
            description: 'Performs mathematical operations',
            schema: {
                type: 'object',
                properties: {
                    operation: {type: 'string', enum: ['add', 'subtract', 'multiply', 'divide', 'power']},
                    a: {type: 'number'},
                    b: {type: 'number'}
                },
                required: ['operation', 'a', 'b']
            },
            ...config
        });
    }

    async execute({operation, a, b}) {
        const ops = {
            add: (x, y) => x + y,
            subtract: (x, y) => x - y,
            multiply: (x, y) => x * y,
            divide: (x, y) => y !== 0 ? x / y : null,
            power: (x, y) => Math.pow(x, y)
        };

        const result = ops[operation]?.(a, b);
        return {
            success: result !== null,
            operation,
            operands: [a, b],
            result,
            error: result === null ? 'Division by zero' : undefined
        };
    }
}

// Custom Tool 2: JSON Validator
class JSONValidatorTool extends BaseTool {
    constructor(config = {}) {
        super('json-validator', {
            description: 'Validates and parses JSON strings',
            schema: {
                type: 'object',
                properties: {
                    json: {type: 'string'}
                },
                required: ['json']
            },
            ...config
        });
    }

    async execute({json}) {
        try {
            const parsed = JSON.parse(json);
            return {
                success: true,
                valid: true,
                parsed,
                keys: Object.keys(parsed),
                type: Array.isArray(parsed) ? 'array' : typeof parsed
            };
        } catch (error) {
            return {
                success: false,
                valid: false,
                error: error.message,
                position: error.message.match(/position (\d+)/)?.[1]
            };
        }
    }

    getDescription() {
        return this.config.description || 'Validates and parses JSON strings';
    }
}

// Custom Tool 3: Git Operations (with error handling)
class GitTool extends BaseTool {
    constructor(config = {}) {
        super('git', {
            description: 'Execute safe git commands',
            schema: {
                type: 'object',
                properties: {
                    command: {type: 'string', enum: ['status', 'log', 'branch', 'diff']},
                    args: {type: 'array', items: {type: 'string'}}
                },
                required: ['command']
            },
            ...config
        });
        this.timeout = config.timeout || 5000;
    }

    async execute({command, args = []}) {
        try {
            const gitCmd = `git ${command} ${args.join(' ')}`;
            const {stdout, stderr} = await execAsync(gitCmd, {
                timeout: this.timeout,
                maxBuffer: 1024 * 1024
            });

            return {
                success: true,
                command: gitCmd,
                stdout: stdout.trim(),
                stderr: stderr.trim()
            };
        } catch (error) {
            return {
                success: false,
                command,
                error: error.message,
                code: error.code
            };
        }
    }
}

async function demonstrateCustomTools() {
    section('Custom Tool Demo');
    log('Demonstrating custom tool creation by extending BaseTool\n');

    // 1. Math Tool
    section('1️⃣  MathTool - Simple Custom Tool');
    const mathTool = new MathTool();

    const results = [
        await mathTool.execute({operation: 'add', a: 5, b: 3}),
        await mathTool.execute({operation: 'multiply', a: 4, b: 7}),
        await mathTool.execute({operation: 'power', a: 2, b: 8}),
        await mathTool.execute({operation: 'divide', a: 10, b: 0})
    ];

    results.forEach(r => {
        log(`${r.operation}(${r.operands.join(', ')}) = ${r.result ?? `Error: ${r.error}`}`);
    });

    // 2. JSON Validator Tool
    section('2️⃣  JSONValidatorTool - Validation Logic');
    const jsonTool = new JSONValidatorTool();

    const validJSON = '{"name": "SeNARS", "type": "reasoning-system"}';
    const invalidJSON = '{invalid json}';

    const validResult = await jsonTool.execute({json: validJSON});
    log(`Valid JSON: ${validResult.valid ? '✅' : '❌'}`);
    log(`  Keys: ${validResult.keys?.join(', ')}`);
    log(`  Type: ${validResult.type}`);

    const invalidResult = await jsonTool.execute({json: invalidJSON});
    log(`\nInvalid JSON: ${invalidResult.valid ? '✅' : '❌'}`);
    log(`  Error: ${invalidResult.error}`);

    // 3. Git Tool (with error handling)
    section('3️⃣  GitTool - External Command Integration');
    const gitTool = new GitTool();

    try {
        const statusResult = await gitTool.execute({command: 'status', args: ['--short']});
        if (statusResult.success) {
            log('Git status: ✅');
            const lines = statusResult.stdout.split('\n').slice(0, 5);
            lines.forEach(line => log(`  ${line || '(clean)'}`));
        } else {
            log(`Git status: ❌ ${statusResult.error}`);
        }

        const branchResult = await gitTool.execute({command: 'branch', args: ['--show-current']});
        if (branchResult.success) {
            log(`\nCurrent branch: ${branchResult.stdout}`);
        }
    } catch (error) {
        log(`Git operations unavailable: ${error.message}`);
    }

    // 4. Integration with Agent
    section('4️⃣  Registering Custom Tools with Agent');
    const app = new App({lm: {enabled: false}, subsystems: {tools: true}});
    await app.initialize();

    const agent = app.agent;
    if (agent?.toolEngine) {
        agent.toolEngine.registerTool('math', mathTool);
        agent.toolEngine.registerTool('json-validator', jsonTool);
        agent.toolEngine.registerTool('git', gitTool);

        const registered = agent.toolEngine.getRegisteredTools();
        log(`Registered tools: ${registered.join(', ')}`);

        // Execute via agent
        const mathResult = await agent.toolEngine.executeTool('math', {
            operation: 'add',
            a: 100,
            b: 200
        });
        log(`\nAgent execution: add(100, 200) = ${mathResult.result}`);
    }

    await app.shutdown();

    section('✨ Key Takeaways');
    log('• Extend BaseTool to create custom tools');
    log('• Override _execute() with tool logic');
    log('• Define schema for parameter validation');
    log('• Use try-catch for robust error handling');
    log('• Register with toolEngine for agent integration');
    log('• Tools can wrap any functionality: math, validation, external commands\n');
}

demonstrateCustomTools().catch(console.error);
