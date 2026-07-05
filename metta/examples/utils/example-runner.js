import {App} from '@senars/agent';
import {Config} from '@senars/core';

process.env.ORT_LOG_LEVEL = 'error';

export async function runExample({model, inputs, onStep, tools}) {
    console.log(`🚀 Starting SeNARS Agent Example Runner with ${model}...`);

    const config = new Config({
        provider: 'transformers',
        model,
        temperature: 0,
        nar: {tools: {enabled: true}},
        subsystems: {tools: true, lm: true},
        tools: tools,
    });

    const app = new App(config);
    const agent = await app.start();
    console.log("✅ Agent initialized.");

    for (const input of inputs) {
        console.log(`\n--------------------------------------------------`);
        console.log(`👤 User: ${input}`);
        console.log(`--------------------------------------------------`);

        try {
            await agent.processInputStreaming(input, process.stdout.write.bind(process.stdout), onStep);
            process.stdout.write("\n");
        } catch (e) {
            console.error(`❌ Error processing input:`, {message: e.message, stack: e.stack});
        }
    }

    console.log(`\n--------------------------------------------------`);
    await app.shutdown();
    console.log("👋 Example finished.");
}
