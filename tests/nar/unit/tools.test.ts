import {Registry, SleepTool, TimerTool, ToolManager} from '../../../src/nar/tools';
import {EventBus} from '../../../src/nar/types';

describe('Tool Framework', () => {
    describe('Registry', () => {
        it('should register and retrieve tools', () => {
            const registry = new Registry();
            const tool = new SleepTool();

            registry.register(tool);
            const retrieved = registry.get('sleep');

            expect(retrieved).toBe(tool);
        });

        it('should list all registered tools', () => {
            const registry = new Registry();
            registry.register(new SleepTool());
            registry.register(new TimerTool());

            const tools = registry.list();
            expect(tools).toHaveLength(2);
        });

        it('should throw error on duplicate registration', () => {
            const registry = new Registry();
            const tool = new SleepTool();

            registry.register(tool);

            expect(() => registry.register(tool)).toThrow();
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

    describe('TimerTool', () => {
        it('should schedule a delayed action', async () => {
            const tool = new TimerTool();
            const result = await tool.execute({action: 'start', name: 'test', delay: 50, callback: 'test'});

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
        });

        it('should reject invalid action', async () => {
            const tool = new TimerTool();
            const result = await tool.execute({action: 'invalid'});

            expect(result.success).toBe(false);
        });
    });

    describe('ToolManager', () => {
        it('should register tools', () => {
            const manager = new ToolManager();
            manager.register(new SleepTool());

            expect(manager.list()).toHaveLength(1);
        });

        it('should execute tools', async () => {
            const manager = new ToolManager();
            manager.register(new SleepTool());

            const result = await manager.execute('sleep', {duration: 10});

            expect(result.success).toBe(true);
        });

        it('should emit events on tool execution', async () => {
            const eventBus = new EventBus();
            const manager = new ToolManager({ eventBus });
            manager.register(new SleepTool());

            const events: string[] = [];
            manager.on('tool:call', () => events.push('call'));
            manager.on('tool:result', () => events.push('result'));

            await manager.execute('sleep', {duration: 10});

            expect(events).toEqual(['call', 'result']);
        });

        it('should track execution history', async () => {
            const manager = new ToolManager();
            manager.register(new SleepTool());

            await manager.execute('sleep', {duration: 10});
            await manager.execute('sleep', {duration: 10});

            const history = manager.getHistory();
            expect(history).toHaveLength(4);
        });

        it('should limit history size', async () => {
            const manager = new ToolManager();
            manager.register(new SleepTool());

            for (let i = 0; i < 150; i++) {
                await manager.execute('sleep', {duration: 1});
            }

            const history = manager.getHistory(200);
            expect(history.length).toBeLessThanOrEqual(100);
        });
    });
});