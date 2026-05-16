/**
 * MCP Server Advanced Example
 * Demonstrates advanced features: progress reporting, resources, prompts
 */

import {SeNARSMCPServer} from '../api/mcp-server.js';
import {APIRegistry} from '../api/registry.js';
import {EnhancedMCPAdapter} from '../api/mcp/enhanced-adapter.js';
import {ResourceManager} from '../api/mcp/resource-manager.js';
import {PromptManager} from '../api/mcp/prompt-manager.js';
import {z} from 'zod';

async function main() {
    console.log('Starting MCP Server Advanced Example...\n');

    const registry = APIRegistry.getInstance();

    // 1. Register handlers with progress reporting
    registry.register('long-operation', {
        description: 'Long-running operation with progress reporting',
        params: z.object({
            steps: z.number().default(10),
            duration: z.number().default(1000),
        }),
        returns: z.any(),
        handler: async (args: { steps: number; duration?: number }) => {
            // Simulate long operation with progress
            const results = [];
            for (let i = 0; i < args.steps; i++) {
                await new Promise((resolve) =>
                    setTimeout(resolve, args.duration || 100)
                );
                results.push(`Completed step ${i + 1}/${args.steps}`);
            }
            return {
                completed: true,
                results,
            };
        },
    });

    // 2. Setup Resource Manager
    const resourceManager = new ResourceManager();

    // Register belief resource
    resourceManager.registerResource({
        uriTemplate: 'senars://beliefs/{id}',
        name: 'Belief Resource',
        description: 'Access individual beliefs',
        mimeType: 'application/json',
        listable: true,
    });

    // Register resolver
    resourceManager.registerResolver('senars://beliefs/', {
        async resolve(uri) {
            const beliefId = uri.split('/').pop();
            return {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                    id: beliefId,
                    belief: `(belief-${beliefId} --> truth)`,
                    confidence: 0.9,
                }),
            };
        },
        async list(_template) {
            return [
                {
                    uriTemplate: 'senars://beliefs/1',
                    name: 'Belief 1',
                },
                {
                    uriTemplate: 'senars://beliefs/2',
                    name: 'Belief 2',
                },
            ];
        },
    });

    // 3. Setup Prompt Manager
    const promptManager = new PromptManager();

    // Register reasoning guidance prompt
    promptManager.registerPrompt({
        name: 'reasoning-guidance',
        description: 'Provides guidance for reasoning tasks',
        arguments: [
            {
                name: 'domain',
                description: 'Domain of reasoning (e.g., mathematics, logic)',
                required: true,
            },
            {
                name: 'complexity',
                description: 'Complexity level (1-10)',
                required: false,
            },
        ],
    });

    // Register analysis prompt
    promptManager.registerPrompt({
        name: 'analyze-belief',
        description: 'Analyze a belief statement',
        arguments: [
            {
                name: 'belief',
                description: 'The belief statement to analyze',
                required: true,
            },
        ],
    });

    // Create server
    const server = new SeNARSMCPServer(registry, {
        name: 'senars-advanced',
        version: '1.0.0',
        transport: 'stdio',
    });

    try {
        await server.start();

        console.log('✓ MCP Server started with advanced features');
        console.log(
            `Available tools: ${server.listTools().map((t) => t.name).join(', ')}`
        );

        // Get adapter for advanced features
        const adapter = server.getAdapter() as EnhancedMCPAdapter;

        // Example: Progress reporting
        console.log('\n--- Progress Reporting Example ---');
        const {reporter, token} = adapter.createProgressReporter('demo-op');

        let progressUpdates = 0;
        adapter.onProgress(token, (update) => {
            progressUpdates++;
            console.log(`Progress: ${update.current}/${update.total} - ${update.message}`);
        });

        // Simulate progress
        reporter({
            token,
            current: 5,
            total: 10,
            message: 'Processing...',
        });

        reporter({
            token,
            current: 10,
            total: 10,
            message: 'Complete!',
        });

        // Example: Resource listing
        console.log('\n--- Resource Management Example ---');
        const resources = await resourceManager.listResourcesByTemplate(
            'senars://beliefs/{id}'
        );
        console.log('Available resources:', resources.map((r) => r.name).join(', '));

        // Example: Resource resolution
        const resolved = await resourceManager.resolve('senars://beliefs/1');
        console.log('Resolved resource:', resolved);

        // Example: Prompt rendering
        console.log('\n--- Prompt Management Example ---');
        const prompt = promptManager.getPrompt('reasoning-guidance');
        if (prompt) {
            const messages = promptManager.render(prompt, {
                domain: 'mathematics',
                complexity: '7',
            });
            console.log('Rendered prompt messages:', messages.length);
        }

        console.log('\n✓ All advanced features demonstrated');
        console.log('\nServer is running. Press Ctrl+C to stop.\n');

        // Keep running
        await new Promise(() => {
        });
    } catch (error) {
        console.error('Error:', error);
        await server.stop();
        process.exit(1);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default main;
