import {CalculateTool, ReadFileTool, Registry, SleepTool, ToolManager, WriteFileTool} from '../../../src/nar/tools';
import {EventBus} from '../../../src/nar/types';

describe('Tool Framework', () => {
    describe('Registry', () => {
        it('should register and retrieve tools', () => {
            const registry = new Registry();
            const tool = new CalculateTool();

            registry.register(tool);
            const retrieved = registry.get('calculate');

            expect(retrieved).toBe(tool);
        });

        it('should list all registered tools', () => {
            const registry = new Registry();
            registry.register(new CalculateTool());
            registry.register(new SleepTool());

            const tools = registry.list();
            expect(tools).toHaveLength(2);
        });

        it('should throw error on duplicate registration', () => {
            const registry = new Registry();
            const tool = new CalculateTool();

            registry.register(tool);

            expect(() => registry.register(tool)).toThrow();
        });
    });

    describe('CalculateTool', () => {
        it('should evaluate mathematical expressions', async () => {
            const tool = new CalculateTool();
            const result = await tool.execute({expression: '2 + 2'});

            expect(result.success).toBe(true);
            expect(result.content).toBe(4);
        });

        it('should handle complex expressions', async () => {
            const tool = new CalculateTool();
            const result = await tool.execute({expression: '(10 * 5) / 2'});

            expect(result.success).toBe(true);
            expect(result.content).toBe(25);
        });

        it('should reject invalid characters', async () => {
            const tool = new CalculateTool();
            const result = await tool.execute({expression: '2 + abc'});

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid characters');
        });

        it('should handle division by zero', async () => {
            const tool = new CalculateTool();
            const result = await tool.execute({expression: '1 / 0'});

            expect(result.success).toBe(true);
            expect(result.content).toBe(Infinity);
        });
    });

    describe('SleepTool', () => {
        it('should delay execution', async () => {
            const tool = new SleepTool();
            const start = Date.now();

            const result = await tool.execute({duration: 100});

            expect(result.success).toBe(true);
            expect(Date.now() - start).toBeGreaterThanOrEqual(95);
        });

        it('should reject negative duration', async () => {
            const registry = new Registry();
            const tool = new SleepTool();
            registry.register(tool);

            const result = await registry.execute('sleep', {duration: -100});
            expect(result.success).toBe(false);
        });

        it('should reject duration exceeding maximum', async () => {
            const registry = new Registry();
            const tool = new SleepTool();
            registry.register(tool);

            const result = await registry.execute('sleep', {duration: 70000});
            expect(result.success).toBe(false);
        });
    });

    describe('ReadFileTool', () => {
        it('should read file contents', async () => {
            const tool = new ReadFileTool();
            const result = await tool.execute({path: '/etc/hosts'});

            expect(result.success).toBe(true);
            expect((result.content as any).path).toBe('/etc/hosts');
            expect((result.content as any).content).toBeDefined();
        });

        it('should handle missing files', async () => {
            const tool = new ReadFileTool();
            const result = await tool.execute({path: '/nonexistent/file.txt'});

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('WriteFileTool', () => {
        it('should write to file', async () => {
            const tool = new WriteFileTool();
            const testPath = '/tmp/test_write.txt';
            const testContent = 'test content';

            const result = await tool.execute({path: testPath, content: testContent});

            expect(result.success).toBe(true);
            expect((result.content as any).written).toBe(testContent.length);
        });
    });

    describe('ToolManager', () => {
        it('should register tools', () => {
            const manager = new ToolManager();
            manager.register(new CalculateTool());

            expect(manager.list()).toHaveLength(1);
        });

        it('should execute tools', async () => {
            const manager = new ToolManager();
            manager.register(new CalculateTool());

            const result = await manager.execute('calculate', {expression: '10 + 5'});

            expect(result.success).toBe(true);
            expect(result.content).toBe(15);
        });

        it('should emit events on tool execution', async () => {
            const eventBus = new EventBus();
            const manager = new ToolManager({ eventBus });
            manager.register(new CalculateTool());

            const events: string[] = [];
            manager.on('tool:call', () => events.push('call'));
            manager.on('tool:result', () => events.push('result'));

            await manager.execute('calculate', {expression: '1 + 1'});

            expect(events).toEqual(['call', 'result']);
        });

        it('should track execution history', async () => {
            const manager = new ToolManager();
            manager.register(new CalculateTool());

            await manager.execute('calculate', {expression: '1 + 1'});
            await manager.execute('calculate', {expression: '2 + 2'});

            const history = manager.getHistory();
            expect(history).toHaveLength(4);
        });

        it('should limit history size', async () => {
            const manager = new ToolManager();
            manager.register(new CalculateTool());

            for (let i = 0; i < 150; i++) {
                await manager.execute('calculate', {expression: '1 + 1'});
            }

            const history = manager.getHistory(200);
            expect(history.length).toBeLessThanOrEqual(100);
        });
    });
});
