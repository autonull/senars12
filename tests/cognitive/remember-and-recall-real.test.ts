/**
 * Real-LM variant of the remember-and-recall cognitive test (DoD #9).
 *
 * Spawns `scripts/real-lm-cognitive-smoke.ts` as a child process because
 * Jest's VM breaks ONNX's cross-realm Float32Array checks. The smoke:
 *   1. Pre-loads NARS with `(cat --> animal).` and `(animal --> living).`
 *   2. Episode 1: asks the LM to record a belief via nar_believe.
 *   3. Episode 2: asks the LM to recall something it should know.
 *   4. Asserts episodic memory recorded both input and response.
 *
 * Skipped cleanly when the model weights are not present locally.
 */

import {existsSync} from 'fs';
import {join} from 'path';
import {spawn} from 'child_process';
import {beforeAll, describe, expect, test} from '@jest/globals';

const MODEL_DIR = join(
    process.cwd(),
    'node_modules', '.pnpm',
    '@huggingface+transformers@3.8.1',
    'node_modules', '@huggingface', 'transformers',
    '.cache', 'HuggingFaceTB', 'SmolLM2-135M-Instruct',
    'onnx', 'model.onnx',
);

const candidates = [
    MODEL_DIR,
    join(process.env.HF_HOME ?? '', 'HuggingFaceTB', 'SmolLM2-135M-Instruct', 'onnx', 'model.onnx'),
    join(process.env.HOME ?? '/root', '.cache', 'huggingface', 'hub', 'HuggingFaceTB--SmolLM2-135M-Instruct', 'onnx', 'model.onnx'),
];

const modelCached = candidates.some((p) => p && existsSync(p));
const describeIfCached = modelCached ? describe : describe.skip;

describeIfCached('Cognitive — remember-and-recall against real TransformersLMClient (I11)', () => {
    let stdout = '';
    let stderr = '';
    let exitCode: number | null = null;

    beforeAll(async () => {
        const result = await runSmoke();
        stdout = result.stdout;
        stderr = result.stderr;
        exitCode = result.code;
    }, 300_000);

    test('smoke exits 0', () => {
        if (exitCode !== 0) {
            console.error('--- STDOUT ---\n' + stdout);
            console.error('--- STDERR ---\n' + stderr);
        }
        expect(exitCode).toBe(0);
    });

    test('episode 1 ran (belief-record probe)', () => {
        const probe = stdout.match(/probe="belief-record"[\s\S]*?tools=(\d+)/);
        expect(probe).not.toBeNull();
    });

    test('episode 2 ran (recall probe)', () => {
        const probe = stdout.match(/probe="recall"[\s\S]*?text=/);
        expect(probe).not.toBeNull();
    });

    test('episodicMemory recorded both input and response', () => {
        expect(stdout).toMatch(/episodicMemory types observed: .*\binput\b/);
        expect(stdout).toMatch(/episodicMemory types observed: .*\bresponse\b/);
    });
});

interface RunResult {
    code: number | null;
    stdout: string;
    stderr: string;
}

function runSmoke(): Promise<RunResult> {
    return new Promise((resolve) => {
        const child = spawn(
            process.execPath,
            ['--import', 'tsx', 'scripts/real-lm-cognitive-smoke.ts'],
            {cwd: process.cwd(), env: {...process.env, NODE_NO_WARNINGS: '1'}, stdio: ['ignore', 'pipe', 'pipe']},
        );
        let out = '';
        let err = '';
        child.stdout.on('data', (d) => { out += d.toString(); });
        child.stderr.on('data', (d) => { err += d.toString(); });
        child.on('close', (code) => resolve({code, stdout: out, stderr: err}));
    });
}
