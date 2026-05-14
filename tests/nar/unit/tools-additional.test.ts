/**
 * Additional Tool Tests
 * Tests for: FileTools, HTTPTool, TimerTool, ProcessTool, LearnTool, ReasonTool
 */

import {beforeEach, describe, expect, it} from '@jest/globals';
import {NAR} from '../../../src/nar/nar.js';
import {ReadFileTool, WriteFileTool} from '../../../src/nar/tools/FileTools.js';
import {HTTPTool} from '../../../src/nar/tools/HTTPTool.js';
import {TimerTool} from '../../../src/nar/tools/TimerTool.js';
import {ProcessTool} from '../../../src/nar/tools/ProcessTool.js';
import {LearnTool} from '../../../src/nar/tools/LearnTool.js';
import {ReasonTool} from '../../../src/nar/tools/ReasonTool.js';

describe('ReadFileTool', () => {
    it('should have correct metadata', () => {
        const tool = new ReadFileTool();
        expect(tool.name).toBe('readFile');
        expect(tool.description).toContain('Read contents');
        expect(tool.parameters).toBeDefined();
    });

    it('should require path parameter', async () => {
        const tool = new ReadFileTool();
        const result = await tool.execute({});
        expect(result.success).toBe(false);
    });

    it('should handle non-existent files', async () => {
        const tool = new ReadFileTool();
        const result = await tool.execute({path: '/nonexistent/file.txt'});
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('should read existing file', async () => {
        const tool = new ReadFileTool();
        const result = await tool.execute({path: '/etc/hosts'});
        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
    });
});

describe('WriteFileTool', () => {
    it('should have correct metadata', () => {
        const tool = new WriteFileTool();
        expect(tool.name).toBe('writeFile');
        expect(tool.description).toContain('Write content');
        expect(tool.parameters).toBeDefined();
    });

    it('should write to file', async () => {
        const tool = new WriteFileTool();
        const testPath = '/tmp/test_write_tool.txt';
        const testContent = 'Test content for WriteFileTool';

        const result = await tool.execute({path: testPath, content: testContent});
        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
    });

    it('should overwrite existing file', async () => {
        const tool = new WriteFileTool();
        const testPath = '/tmp/test_overwrite.txt';

        await tool.execute({path: testPath, content: 'First content'});
        const result2 = await tool.execute({path: testPath, content: 'Second content'});

        expect(result2.success).toBe(true);
    });

    it('should handle missing content parameter', async () => {
        const tool = new WriteFileTool();
        const result = await tool.execute({path: '/tmp/test.txt'});
        expect(result.success).toBe(false);
    });
});

describe('HTTPTool', () => {
    it('should have correct metadata', () => {
        const tool = new HTTPTool();
        expect(tool.name).toBe('http');
        expect(tool.description).toContain('HTTP');
        expect(tool.parameters).toBeDefined();
    });

    it('should require url parameter', async () => {
        const tool = new HTTPTool();
        const result = await tool.execute({});
        expect(result.success).toBe(false);
    });

    it('should validate URL protocol', async () => {
        const tool = new HTTPTool();
        const result = await tool.execute({url: 'ftp://invalid.com'});
        expect(result.success).toBe(false);
    });

    it('should handle invalid URLs', async () => {
        const tool = new HTTPTool();
        const result = await tool.execute({url: 'not-a-valid-url'});
        expect(result.success).toBe(false);
    });

    it('should make GET request', async () => {
        const tool = new HTTPTool();
        const result = await tool.execute({
            url: 'https://httpbin.org/get',
            method: 'GET'
        });

        if (result.success) {
            expect(result.content).toBeDefined();
        } else {
            expect(result.error).toBeDefined();
        }
    });

    it('should handle HTTP errors gracefully', async () => {
        const tool = new HTTPTool();
        const result = await tool.execute({
            url: 'https://httpbin.org/status/404',
            method: 'GET'
        });

        expect(result.success).toBe(true);
    });
});

describe('TimerTool', () => {
    let timerTool: TimerTool;

    beforeEach(() => {
        timerTool = new TimerTool();
    });

    it('should have correct metadata', () => {
        expect(timerTool.name).toBe('timer');
        expect(timerTool.description).toContain('Schedule');
        expect(timerTool.parameters).toBeDefined();
    });

    it('should require action parameter', async () => {
        const result = await timerTool.execute({});
        expect(result.success).toBe(false);
    });

    it('should start timer', async () => {
        const result = await timerTool.execute({
            action: 'start',
            name: 'test-timer',
            delay: 100,
            callback: 'testCallback'
        });

        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
    });

    it('should list timers', async () => {
        await timerTool.execute({
            action: 'start',
            name: 'timer1',
            delay: 1000,
            callback: 'cb1'
        });

        const result = await timerTool.execute({action: 'list'});
        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
    });

    it('should stop timer', async () => {
        await timerTool.execute({
            action: 'start',
            name: 'stoppable-timer',
            delay: 5000,
            callback: 'cb'
        });

        const result = await timerTool.execute({
            action: 'stop',
            name: 'stoppable-timer'
        });

        expect(result.success).toBe(true);
    });

    it('should handle stopping non-existent timer', async () => {
        const result = await timerTool.execute({
            action: 'stop',
            name: 'nonexistent'
        });
        expect(result.success).toBe(false);
    });

    it('should cancel timer', async () => {
        await timerTool.execute({
            action: 'start',
            name: 'cancellable',
            delay: 5000,
            callback: 'cb'
        });

        const result = await timerTool.execute({
            action: 'cancel',
            name: 'cancellable'
        });

        expect(result.success).toBe(true);
    });

    it('should handle missing timer name', async () => {
        const result = await timerTool.execute({action: 'stop'});
        expect(result.success).toBe(false);
    });

    it('should handle unknown action', async () => {
        const result = await timerTool.execute({action: 'invalid'});
        expect(result.success).toBe(false);
    });
});

describe('ProcessTool', () => {
    let processTool: ProcessTool;

    beforeEach(() => {
        processTool = new ProcessTool();
    });

    it('should have correct metadata', () => {
        expect(processTool.name).toBe('process');
        expect(processTool.description).toContain('process');
        expect(processTool.parameters).toBeDefined();
    });

    it('should list processes', async () => {
        const result = await processTool.execute({action: 'list'});
        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
    });

    it('should run simple command', async () => {
        const result = await processTool.execute({
            action: 'run',
            command: 'echo',
            args: ['hello'],
            cwd: '/tmp'
        });

        if (result.success) {
            expect(result.content).toBeDefined();
        }
    });

    it('should handle command execution with timeout', async () => {
        const result = await processTool.execute({
            action: 'run',
            command: 'sleep',
            args: ['0.1'],
            cwd: '/tmp',
            timeout: 5000
        });

        expect(result.success).toBe(true);
    });

    it('should handle missing command', async () => {
        const result = await processTool.execute({action: 'run'});
        expect(result.success).toBe(false);
    });

    it('should kill process', async () => {
        const startResult = await processTool.execute({
            action: 'run',
            command: 'sleep',
            args: ['10']
        });

        if (startResult.success && startResult.content) {
            const content = startResult.content as any;
            const pid = content.pid;

            const killResult = await processTool.execute({
                action: 'kill',
                processId: pid
            });

            expect(killResult.success).toBe(true);
        }
    });

    it('should handle killing non-existent process', async () => {
        const result = await processTool.execute({
            action: 'kill',
            processId: 99999
        });
        expect(result.success).toBe(false);
    });
});

describe('LearnTool', () => {
    let nar: NAR;
    let learnTool: LearnTool;

    beforeEach(() => {
        nar = new NAR();
        learnTool = new LearnTool(nar.memory);
    });

    it('should have correct metadata', () => {
        expect(learnTool.name).toBe('learn');
        expect(learnTool.description).toContain('knowledge');
        expect(learnTool.parameters).toBeDefined();
    });

    it('should learn new belief', async () => {
        const result = await learnTool.execute({
            knowledge: '(cat --> animal)',
            type: 'belief',
            truth: {frequency: 0.9, confidence: 0.9},
            priority: 0.8
        });

        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
    });

    it('should learn with default truth', async () => {
        const result = await learnTool.execute({
            knowledge: '(dog --> mammal)',
            type: 'belief'
        });

        expect(result.success).toBe(true);
    });

    it('should handle invalid narsese', async () => {
        const result = await learnTool.execute({
            knowledge: 'invalid narsese statement',
            type: 'belief'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('should learn goal', async () => {
        const result = await learnTool.execute({
            knowledge: '(goal --> target)',
            type: 'goal',
            truth: {frequency: 0.5, confidence: 0.8}
        });

        expect(result.success).toBe(true);
    });

    it('should learn fact', async () => {
        const result = await learnTool.execute({
            knowledge: '(fact --> knowledge)',
            type: 'fact',
            source: 'test'
        });

        expect(result.success).toBe(true);
    });

    it('should include metadata in result', async () => {
        const result = await learnTool.execute({
            knowledge: '(test --> concept)',
            source: 'unit-test',
            priority: 0.7
        });

        expect(result.success).toBe(true);
        expect(result.metadata).toBeDefined();
    });
});

describe('ReasonTool', () => {
    let nar: NAR;
    let reasonTool: ReasonTool;

    beforeEach(() => {
        nar = new NAR();
        reasonTool = new ReasonTool(nar);
    });

    it('should have correct metadata', () => {
        expect(reasonTool.name).toBe('reason');
        expect(reasonTool.description).toContain('reasoning');
        expect(reasonTool.parameters).toBeDefined();
    });

    it('should reason about statement', async () => {
        const result = await reasonTool.execute({
            statement: '(a --> b)',
            type: 'belief',
            truth: {frequency: 0.9, confidence: 0.9},
            priority: 0.8
        });

        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
    });

    it('should handle invalid statement', async () => {
        const result = await reasonTool.execute({
            statement: 'invalid statement',
            type: 'belief'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('should handle goal type', async () => {
        const result = await reasonTool.execute({
            statement: '(goal --> target)',
            type: 'goal'
        });

        expect(result.success).toBe(true);
    });

    it('should handle question type', async () => {
        const result = await reasonTool.execute({
            statement: '(question --> answer)',
            type: 'question'
        });

        expect(result.success).toBe(true);
    });

    it('should use default truth values', async () => {
        const result = await reasonTool.execute({
            statement: '(default --> truth)'
        });

        expect(result.success).toBe(true);
    });

    it('should include metadata', async () => {
        const result = await reasonTool.execute({
            statement: '(metadata --> test)'
        });

        expect(result.success).toBe(true);
        expect(result.metadata).toBeDefined();
        expect(result.metadata.timestamp).toBeDefined();
    });
});

describe('Tool Integration', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should chain learn and reason operations', async () => {
        const learnTool = new LearnTool(nar.memory);
        const reasonTool = new ReasonTool(nar);

        const learnResult = await learnTool.execute({
            knowledge: '(chain --> test)',
            type: 'belief'
        });

        expect(learnResult.success).toBe(true);

        const reasonResult = await reasonTool.execute({
            statement: '(chain --> test)',
            type: 'belief'
        });

        expect(reasonResult.success).toBe(true);
    });

    it('should handle multiple tool types', async () => {
        const readFileTool = new ReadFileTool();
        const timerTool = new TimerTool();

        const readResult = await readFileTool.execute({path: '/etc/hosts'});
        expect(readResult.success).toBe(true);

        const timerResult = await timerTool.execute({
            action: 'list'
        });
        expect(timerResult.success).toBe(true);
    });
});
