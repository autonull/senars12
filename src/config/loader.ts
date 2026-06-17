import {promises as fs} from 'fs';
import {resolve} from 'path';
import {appConfigSchema} from './schema.js';
import type {AppConfig} from './schema.js';

export type {AppConfig, BotConfig, BotProfile, NarCoreConfig, LmConfig} from './schema.js';

const ENV_OVERRIDES: Record<string, (env: string) => unknown> = {
    'SENARS_LM_ENABLED': v => v.toLowerCase() === 'true' || v === '1',
    'SENARS_LM_PROVIDER': v => v,
    'SENARS_LM_MODEL': v => v,
    'SENARS_SENARS_ENABLED': v => v.toLowerCase() === 'true' || v === '1',
    'SENARS_REASONING_AUTO_TRIGGER': v => v.toLowerCase() === 'true' || v === '1',
    'SENARS_REASONING_TRIGGER_THRESHOLD': v => parseFloat(v),
    'SENARS_STREAMING_ENABLED': v => v.toLowerCase() === 'true' || v === '1',
    'SENARS_TUI_COLORS': v => v.toLowerCase() === 'true' || v === '1',
    'SENARS_TUI_TYPING_INDICATOR': v => v.toLowerCase() === 'true' || v === '1',
};

const applyEnvOverrides = (raw: Record<string, unknown>): Record<string, unknown> => {
    const out = {...raw};
    const caps = (out.capabilities as Record<string, unknown> | undefined) ?? {};
    const lm = {...(caps.lm as Record<string, unknown> | undefined ?? {})};
    const senars = {...(caps.senars as Record<string, unknown> | undefined ?? {})};
    const reasoning = {...((out.bot as Record<string, unknown> | undefined)?.reasoning as Record<string, unknown> | undefined ?? {})};
    const streaming = {...((out.bot as Record<string, unknown> | undefined)?.streaming as Record<string, unknown> | undefined ?? {})};
    const tui = {...((out.bot as Record<string, unknown> | undefined)?.tui as Record<string, unknown> | undefined ?? {})};

    if (process.env.SENARS_LM_ENABLED) lm.enabled = ENV_OVERRIDES['SENARS_LM_ENABLED']!(process.env.SENARS_LM_ENABLED);
    if (process.env.SENARS_LM_PROVIDER) lm.provider = process.env.SENARS_LM_PROVIDER;
    if (process.env.SENARS_LM_MODEL) lm.model = process.env.SENARS_LM_MODEL;
    if (process.env.SENARS_SENARS_ENABLED) senars.enabled = ENV_OVERRIDES['SENARS_SENARS_ENABLED']!(process.env.SENARS_SENARS_ENABLED);
    if (process.env.SENARS_REASONING_AUTO_TRIGGER) reasoning.autoTrigger = ENV_OVERRIDES['SENARS_REASONING_AUTO_TRIGGER']!(process.env.SENARS_REASONING_AUTO_TRIGGER);
    if (process.env.SENARS_REASONING_TRIGGER_THRESHOLD) reasoning.triggerThreshold = ENV_OVERRIDES['SENARS_REASONING_TRIGGER_THRESHOLD']!(process.env.SENARS_REASONING_TRIGGER_THRESHOLD);
    if (process.env.SENARS_STREAMING_ENABLED) streaming.enabled = ENV_OVERRIDES['SENARS_STREAMING_ENABLED']!(process.env.SENARS_STREAMING_ENABLED);
    if (process.env.SENARS_TUI_COLORS) tui.colors = ENV_OVERRIDES['SENARS_TUI_COLORS']!(process.env.SENARS_TUI_COLORS);
    if (process.env.SENARS_TUI_TYPING_INDICATOR) tui.typingIndicator = ENV_OVERRIDES['SENARS_TUI_TYPING_INDICATOR']!(process.env.SENARS_TUI_TYPING_INDICATOR);

    return {
        ...out,
        capabilities: {...caps, lm, senars},
        bot: {...(out.bot as Record<string, unknown> | undefined ?? {}), reasoning, streaming, tui},
    };
};

const deepMerge = <T>(defaults: T, overrides: Partial<T> | undefined): T => {
    if (!overrides) return defaults;
    const out: Record<string, unknown> = {...(defaults as Record<string, unknown>)};
    for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
        const cur = out[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' && !Array.isArray(cur)) {
            out[k] = deepMerge(cur, v as Record<string, unknown>);
        } else if (v !== undefined) {
            out[k] = v;
        }
    }
    return out as T;
};

export const loadConfig = async (path?: string): Promise<AppConfig> => {
    let raw: Record<string, unknown> = {};
    const filePath = path ?? process.env.SENARS_CONFIG ?? 'senars.config.json';
    try {
        const absolutePath = resolve(process.cwd(), filePath);
        const content = await fs.readFile(absolutePath, 'utf-8');
        raw = JSON.parse(content);
    } catch (e) {
        const err = e as NodeJS.ErrnoException;
        if (err.code !== 'ENOENT') {
            console.warn(`Failed to load config from ${filePath}: ${err.message}\nUsing default configuration`);
        }
    }
    const merged = applyEnvOverrides(raw);
    return appConfigSchema.parse(merged);
};

export const loadConfigFromEnv = async (): Promise<AppConfig> => {
    return appConfigSchema.parse(applyEnvOverrides({}));
};

export const deepMergeConfig = deepMerge;
