export const TOURS = [
    {id: 'basic-reasoning', duration: 30000},
    {id: 'decision-making', duration: 30000},
    {id: 'syllogistic-reasoning', duration: 30000},
    {id: 'temporal-reasoning', duration: 30000},
    {id: 'operator-examples', duration: 30000},
    {id: 'multi-step-inference', duration: 40000},
    {
        id: 'hybrid-reasoning',
        duration: 60000,
        provider: 'transformers',
        model: 'Xenova/flan-t5-small'
    },
    {id: 'procedural-learning', duration: 30000},
    {id: 'causal-reasoning', duration: 30000},
    {id: 'truth-value-reasoning', duration: 30000},
    {
        id: 'lm-demo',
        duration: 120000,  // Increased to 2 minutes to allow for LM processing
        provider: 'transformers',
        model: 'Xenova/flan-t5-small'
    },
    {
        id: 'layers-demo',
        duration: 20000
    },
    {
        id: 'hybrid-reasoning-showcase',
        duration: 90000,
        provider: 'transformers',
        model: 'Xenova/flan-t5-small',
        embedding: true,
        embeddingModel: 'Xenova/all-MiniLM-L6-v2'
    }
];
