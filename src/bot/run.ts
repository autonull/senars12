#!/usr/bin/env node
import {loadConfig, mergeConfig} from './config.js';
import {createBot} from './index.js';

(async () => {
    const args = process.argv.slice(2);
    const profileArg = args.find(a => a.startsWith('--profile='));
    const profile = (profileArg ? profileArg.split('=')[1] : 'minimal') as 'minimal' | 'standard' | 'full';

    const fileConfig = loadConfig(args.find(a => a.startsWith('--config='))?.split('=')[1]);
    const config = mergeConfig(fileConfig, {profile});

    if (config.debug) {
        console.log('[Bot] Starting with profile:', config.profile || 'minimal');
    }

    const bot = await createBot(config);

    process.on('SIGINT', async () => {
        console.log('\n[Bot] Shutting down...');
        await bot.shutdown();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await bot.shutdown();
        process.exit(0);
    });

    await bot.start();
})();
