/**
 * End-to-end integration test for the cognitive pipeline. Spawns
 * `scripts/cli-smoke.ts` as a child process because Jest's VM breaks
 * ONNX's cross-realm Float32Array checks.
 *
 * Asserts:
 *  - the smoke exits 0
 *  - the multi-hop Narsese question ran
 *  - the belief-record probe ran (tool-call may be 0 on the 135M model)
 *  - the contradiction probe ran
 *  - episodic memory recorded both `input` and `response`
 *
 * Skipped cleanly when the model weights are not present locally.
 */

import {existsSync} from 'fs';
import {join} from 'path';
import {spawn} from 'child_process';
import {beforeAll, describe, expect, test} from '@jest/globals';

const MODEL_ONNX = join(
    process.cwd(),
    'node_modules', '.pnpm',
    '@huggingface+transformers@3.8.1',
    'node_modules', '@huggingface', 'transformers',
    '.cache', 'HuggingFaceTB', 'SmolLM2-135M-Instruct',
    'onnx', 'model.onnx',
);

const candidates = [
    MODEL_ONNX,
    join(process.env.HF_HOME ?? '', 'HuggingFaceTB', 'SmolLM2-135M-Instruct', 'onnx', 'model.onnx'),
    join(process.env.HOME ?? '/root', '.cache', 'huggingface', 'hub', 'HuggingFaceTB--SmolLM2-135M-Instruct', 'onnx', 'model.onnx'),
];

const modelCached = candidates.some((p) => p && existsSync(p));
const describeIfCached = modelCached ? describe : describe.skip;

describeIfCached('CLI smoke: cognitive pipeline (real LM, child process)', () => {
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

    test('multihop-narsese probe ran', () => {
        const probe = stdout.match(/probe="multihop-narsese"[\s\S]*?text=/);
        expect(probe).not.toBeNull();
    });

    test('belief-record probe ran (tool-call may be 0 on small LM)', () => {
        const probe = stdout.match(/probe="belief-record"[\s\S]*?tools=(\d+)/);
        expect(probe).not.toBeNull();
        const tools = parseInt(probe![1], 10);
        if (tools < 1) {
            console.warn(`Small LM did not dispatch a tool call (tools=${tools}). Framework wiring is still verified by the smoke exit code.`);
        }
    });

    test('contradiction probe ran with verdict', () => {
        const probe = stdout.match(/probe="contradiction"[\s\S]*?verdict=(\w+)/);
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
            ['--import', 'tsx', 'scripts/cli-smoke.ts'],
            {cwd: process.cwd(), env: {...process.env, NODE_NO_WARNINGS: '1'}, stdio: ['ignore', 'pipe', 'pipe']},
        );
        let out = '';
        let err = '';
        child.stdout.on('data', (d) => { out += d.toString(); });
        child.stderr.on('data', (d) => { err += d.toString(); });
        child.on('close', (code) => resolve({code, stdout: out, stderr: err}));
    });
}
