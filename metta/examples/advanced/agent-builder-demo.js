/**
 * Example demonstrating the AgentBuilder functionality
 */
import {AgentBuilder} from '../../agent/src/index.js';

async function main() {
    console.log('=== Creating agent with default configuration ===');
    const defaultAgent = await new AgentBuilder().build();
    printAgentStats(defaultAgent);

    console.log('\n=== Creating agent with metrics and embeddings enabled ===');
    const customAgent = await new AgentBuilder()
        .withMetrics(true)
        .withEmbeddings({model: 'text-embedding-ada-002', enabled: true})
        .withLM(true)
        .withTools(false)
        .withFunctors(['core-arithmetic'])
        .build();
    printAgentStats(customAgent);

    console.log('\n=== Creating agent with configuration object ===');
    const configAgent = await new AgentBuilder({
        subsystems: {
            metrics: true,
            embeddingLayer: {enabled: true, model: 'test-model'},
            functors: ['core-arithmetic', 'set-operations'],
            rules: ['syllogistic-core'],
            tools: false,
            lm: true
        }
    }).build();
    printAgentStats(configAgent);

    console.log('\n=== Creating minimal agent ===');
    const minimalAgent = await new AgentBuilder({
        subsystems: {
            metrics: false,
            embeddingLayer: false,
            functors: [],
            rules: [],
            tools: false,
            lm: false
        }
    }).build();
    printAgentStats(minimalAgent);

    console.log('\n=== All examples completed successfully ===');
}

function printAgentStats(agent) {
    console.log('Agent created with:');
    console.log(`- Metrics: ${agent.metrics ? 'enabled' : 'disabled'}`);
    console.log(`- Embeddings: ${agent.embeddingLayer ? 'enabled' : 'disabled'}`);
    console.log(`- Language Model: ${agent.lm ? 'enabled' : 'disabled'}`);
    console.log(`- Tools: ${agent.tools ? 'enabled' : 'disabled'}`);
}

main().catch(console.error);