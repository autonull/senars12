import type {EnhancedMCPAdapter} from './mcp/enhanced-adapter.js';
import type {NAR} from '../nar/nar.js';

export function registerMCPResources(adapter: EnhancedMCPAdapter, _nar: NAR): void {
    adapter.registerCapability({
        name: 'nar://beliefs',
        description: 'All stored beliefs with truth values',
        inputSchema: {type: 'object', properties: {}} as any,
    });

    adapter.registerCapability({
        name: 'nar://concepts',
        description: 'Active concepts with attention priorities',
        inputSchema: {type: 'object', properties: {}} as any,
    });

    adapter.registerCapability({
        name: 'nar://attention',
        description: 'Current attention snapshot',
        inputSchema: {type: 'object', properties: {}} as any,
    });

    adapter.registerCapability({
        name: 'nar://episodes',
        description: 'Recent episodic memory entries',
        inputSchema: {type: 'object', properties: {}} as any,
    });

    adapter.registerCapability({
        name: 'nar://benchmarks',
        description: 'Benchmark history and scores',
        inputSchema: {type: 'object', properties: {}} as any,
    });

    adapter.registerCapability({
        name: 'nar://config',
        description: 'Current configuration',
        inputSchema: {type: 'object', properties: {}} as any,
    });

    adapter.registerCapability({
        name: 'nar://tools',
        description: 'Available tools with schemas',
        inputSchema: {type: 'object', properties: {}} as any,
    });
}

export function getResourceContent(adapter: EnhancedMCPAdapter, nar: NAR, uri: string): string {
    switch (uri) {
        case 'nar://beliefs': {
            const beliefs = nar.getBeliefs();
            return JSON.stringify(beliefs.map(b => ({term: b.term.toString(), truth: b.truth})), null, 2);
        }
        case 'nar://concepts':
        case 'nar://attention': {
            const report = nar.attentionReport();
            return JSON.stringify(report, null, 2);
        }
        case 'nar://episodes':
            return JSON.stringify({episodes: []}, null, 2);
        case 'nar://benchmarks':
            return JSON.stringify({history: []}, null, 2);
        case 'nar://config':
            return JSON.stringify(nar.getConfig(), null, 2);
        case 'nar://tools': {
            const tools = nar.tools.list();
            return JSON.stringify(tools.map(t => ({name: t.name, description: t.description})), null, 2);
        }
        default:
            return `Unknown resource: ${uri}`;
    }
}
