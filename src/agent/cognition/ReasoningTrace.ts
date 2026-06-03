import type {Route, ReasoningArtifact, ToolError, ComposedRequest} from '../types.js';
import type {ModelEvent} from '../model/ModelRunner.js';
import type {ReflectionVerdict} from './ReflectionStage.js';

export type ReasoningStepKind =
    | 'route'
    | 'prepare-wm'
    | 'autonomy-incorporate'
    | 'compose'
    | 'text-delta'
    | 'tool-call'
    | 'tool-result'
    | 'tool-error'
    | 'reflect'
    | 'finalize';

export interface ReasoningStep {
    kind: ReasoningStepKind;
    ts: number;
    data: Record<string, unknown>;
}

export interface TraceChunk {
    type: 'reasoning' | 'text' | 'tool' | 'status';
    content: string;
    done: boolean;
    metadata?: Record<string, unknown>;
}

export class ReasoningTrace {
    readonly steps: ReasoningStep[] = [];
    readonly startedAt: number;
    private readonly now: () => number;

    constructor(opts: {now?: () => number} = {}) {
        this.now = opts.now ?? (() => Date.now());
        this.startedAt = this.now();
    }

    recordRoute(route: Route): void {
        this.steps.push({kind: 'route', ts: this.now(), data: {route}});
    }

    recordPrepareWM(slotCount: number, slots: Record<string, unknown>): void {
        this.steps.push({kind: 'prepare-wm', ts: this.now(), data: {slotCount, slots}});
    }

    recordAutonomyIncorporate(insightCount: number): void {
        this.steps.push({kind: 'autonomy-incorporate', ts: this.now(), data: {insightCount}});
    }

    recordCompose(composed: ComposedRequest): void {
        this.steps.push({kind: 'compose', ts: this.now(), data: {ctxHash: composed.ctxHash, budget: composed.budget}});
    }

    recordEvent(event: ModelEvent): void {
        if (event.kind === 'text-delta') {
            this.steps.push({kind: 'text-delta', ts: this.now(), data: {text: event.text}});
        } else if (event.kind === 'tool-call') {
            this.steps.push({kind: 'tool-call', ts: this.now(), data: {name: event.call.toolName, args: event.call.args}});
        } else if (event.kind === 'tool-result') {
            this.steps.push({kind: 'tool-result', ts: this.now(), data: {name: event.call.toolName, result: event.result}});
        } else if (event.kind === 'tool-error') {
            this.steps.push({kind: 'tool-error', ts: this.now(), data: {name: event.call.toolName, error: event.error}});
        }
    }

    recordReflect(verdict: ReflectionVerdict): void {
        this.steps.push({kind: 'reflect', ts: this.now(), data: {verdict}});
    }

    recordFinalize(artifacts: ReasoningArtifact[], errors: ToolError[]): void {
        this.steps.push({kind: 'finalize', ts: this.now(), data: {artifactCount: artifacts.length, errorCount: errors.length}});
    }

    getEvents(): TraceChunk[] {
        const chunks: TraceChunk[] = [];
        for (const s of this.steps) {
            switch (s.kind) {
                case 'route':
                    chunks.push({type: 'reasoning', content: `route: ${(s.data.route as Route).kind}`, done: false, metadata: {step: 'route'}});
                    break;
                case 'prepare-wm':
                    chunks.push({type: 'reasoning', content: `working memory: ${s.data.slotCount} slot(s)`, done: false, metadata: {step: 'prepare-wm'}});
                    break;
                case 'autonomy-incorporate':
                    chunks.push({type: 'reasoning', content: `autonomy: +${s.data.insightCount} insight(s)`, done: false, metadata: {step: 'autonomy-incorporate'}});
                    break;
                case 'compose':
                    chunks.push({type: 'reasoning', content: `compose: ${JSON.stringify(s.data.budget)}`, done: false, metadata: {step: 'compose'}});
                    break;
                case 'text-delta':
                    chunks.push({type: 'text', content: s.data.text as string, done: false, metadata: {step: 'text-delta'}});
                    break;
                case 'tool-call':
                    chunks.push({type: 'tool', content: `→ ${s.data.name}(${JSON.stringify(s.data.args)})`, done: false, metadata: {step: 'tool-call'}});
                    break;
                case 'tool-result':
                    chunks.push({type: 'tool', content: `← ${s.data.name}: ${JSON.stringify(s.data.result)}`, done: false, metadata: {step: 'tool-result'}});
                    break;
                case 'tool-error':
                    chunks.push({type: 'tool', content: `✗ ${s.data.name}: ${s.data.error}`, done: false, metadata: {step: 'tool-error'}});
                    break;
                case 'reflect':
                    chunks.push({type: 'reasoning', content: `reflect: ${(s.data.verdict as ReflectionVerdict).action}`, done: false, metadata: {step: 'reflect'}});
                    break;
                case 'finalize':
                    chunks.push({type: 'status', content: `finalize: ${s.data.artifactCount} artifact(s), ${s.data.errorCount} error(s)`, done: true, metadata: {step: 'finalize'}});
                    break;
            }
        }
        return chunks;
    }

    toMarkdown(): string {
        const lines: string[] = ['# Reasoning Trace', ''];
        for (const s of this.steps) {
            const t = new Date(s.ts).toISOString();
            switch (s.kind) {
                case 'route':
                    lines.push(`- **${t}** route → \`${(s.data.route as Route).kind}\``);
                    break;
                case 'prepare-wm':
                    lines.push(`- **${t}** prepare-wm → ${s.data.slotCount} slot(s)`);
                    break;
                case 'autonomy-incorporate':
                    lines.push(`- **${t}** autonomy-incorporate → ${s.data.insightCount} insight(s)`);
                    break;
                case 'compose':
                    lines.push(`- **${t}** compose → budget ${JSON.stringify(s.data.budget)}`);
                    break;
                case 'text-delta':
                    lines.push(`- **${t}** text → "${s.data.text}"`);
                    break;
                case 'tool-call':
                    lines.push(`- **${t}** tool-call → \`${s.data.name}(${JSON.stringify(s.data.args)})\``);
                    break;
                case 'tool-result':
                    lines.push(`- **${t}** tool-result ← \`${s.data.name}\`: ${JSON.stringify(s.data.result)}`);
                    break;
                case 'tool-error':
                    lines.push(`- **${t}** tool-error ✗ \`${s.data.name}\`: ${s.data.error}`);
                    break;
                case 'reflect':
                    lines.push(`- **${t}** reflect → \`${(s.data.verdict as ReflectionVerdict).action}\``);
                    break;
                case 'finalize':
                    lines.push(`- **${t}** finalize → ${s.data.artifactCount} artifact(s), ${s.data.errorCount} error(s)`);
                    break;
            }
        }
        return lines.join('\n');
    }

    toJSON(): {steps: ReasoningStep[]; startedAt: number} {
        return {steps: [...this.steps], startedAt: this.startedAt};
    }
}
