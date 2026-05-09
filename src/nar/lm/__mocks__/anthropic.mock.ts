export const anthropic = {
    create: () => ({
        chat: {
            completions: {
                create: async () => ({
                    choices: [{message: {content: 'Mock response'}}],
                }),
            },
        },
    }),
};

export default anthropic;
