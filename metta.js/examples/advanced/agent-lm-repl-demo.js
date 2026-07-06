import {runExample} from './utils/example-runner.js';

async function main() {
    const example = {
        model: 'Xenova/LaMini-Flan-T5-248M',
        inputs: [
            "The sky is blue.",
            "What color is the sky?",
            "You have a tool named 'is_sky_blue' that can check if the sky is blue. Use it."
        ],
        tools: [
            {
                name: 'is_sky_blue',
                description: 'Checks if the sky is blue.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                },
                handler: async () => "The sky is indeed blue."
            }
        ]
    };

    await runExample(example);
}

main().catch(console.error);
