#!/usr/bin/env node
import {App} from '@senars/agent';
import {FileOperationsTool} from '../../core/src/tool/FileOperationsTool.js';
import {CommandExecutorTool} from '../../core/src/tool/CommandExecutorTool.js';
import fs from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const section = (title) => console.log(`\n${'═'.repeat(60)}\n${title}\n${'═'.repeat(60)}`);
const log = (...args) => console.log('  ', ...args);

async function demonstrateTools() {
    section('Tool Usage Demo');
    log('Demonstrating built-in tools: FileOperations, CommandExecutor\n');

    const testDir = path.join(__dirname, '.tool-demo-temp');

    try {
        // Setup test directory
        await fs.mkdir(testDir, {recursive: true});

        // 1. FileOperationsTool
        section('1️⃣  FileOperationsTool');
        const fileTool = new FileOperationsTool({baseDir: testDir, allowedOperations: ['read', 'write', 'list']});
        await fileTool.initialize();

        log('Writing test file...');
        const writeResult = await fileTool.execute({
            operation: 'write',
            path: 'test.txt',
            content: 'Hello from FileOperationsTool!'
        });
        log(`Write result: ${writeResult.success ? '✅' : '❌'}`);

        log('\nReading test file...');
        const readResult = await fileTool.execute({
            operation: 'read',
            path: 'test.txt'
        });
        log(`Content: ${readResult.content}`);

        log('\nListing directory...');
        const listResult = await fileTool.execute({
            operation: 'list',
            path: '.'
        });
        log(`Files: ${listResult.files?.join(', ')}`);

        // 2. CommandExecutorTool
        section('2️⃣  CommandExecutorTool');
        const cmdTool = new CommandExecutorTool({
            allowedCommands: ['echo', 'ls', 'pwd', 'date'],
            timeout: 5000
        });
        await cmdTool.initialize();

        log('Running echo command...');
        const echoResult = await cmdTool.execute({
            command: 'echo',
            args: ['Hello', 'from', 'CommandExecutor']
        });
        log(`Output: ${echoResult.stdout?.trim()}`);

        log('\nRunning pwd command...');
        const pwdResult = await cmdTool.execute({
            command: 'pwd',
            args: []
        });
        log(`Current directory: ${pwdResult.stdout?.trim()}`);

        log('\nRunning date command...');
        const dateResult = await cmdTool.execute({
            command: 'date',
            args: ['+%Y-%m-%d']
        });
        log(`Date: ${dateResult.stdout?.trim()}`);

        // 3. Tool Integration with NAR
        section('3️⃣  Tool Integration with NAR');
        const app = new App({
            lm: {enabled: false},
            subsystems: {tools: true}
        });

        await app.initialize();
        log('App initialized with tool subsystem');

        // Register tools
        const agent = app.agent;
        if (agent?.toolEngine) {
            agent.toolEngine.registerTool('file', fileTool);
            agent.toolEngine.registerTool('cmd', cmdTool);
            log('Tools registered with agent');

            const registered = agent.toolEngine.getRegisteredTools();
            log(`Registered tools: ${registered.join(', ')}`);
        }

        // 4. Tool execution via agent
        section('4️⃣  Tool Execution via Agent');
        if (agent?.toolEngine) {
            const result = await agent.toolEngine.executeTool('file', {
                operation: 'write',
                path: 'agent-test.txt',
                content: 'Created via agent tool engine'
            });
            log(`Agent tool execution: ${result.success ? '✅' : '❌'}`);
        }

        await app.shutdown();

        // Cleanup
        await fs.rm(testDir, {recursive: true, force: true});

        section('✨ Key Takeaways');
        log('• FileOperationsTool: safe file read/write/list with baseDir restriction');
        log('• CommandExecutorTool: execute allowed shell commands with timeout');
        log('• tool.initialize() - Setup tool before use');
        log('• tool.execute(params) - Run tool with parameters');
        log('• toolEngine.registerTool() - Register with agent');
        log('• Tools provide safe, controlled access to system resources\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        await fs.rm(testDir, {recursive: true, force: true}).catch(() => {
        });
        throw error;
    }
}

demonstrateTools().catch(console.error);
