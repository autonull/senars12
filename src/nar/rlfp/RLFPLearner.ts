import {appendFileSync} from 'fs';
import {PreferenceData} from './PreferenceCollector.js';
import {TrajectoryStep} from './ReasoningTrajectoryLogger.js';

export interface TrainingEntry {
    timestamp: number;
    prompt: unknown;
    chosen: string;
    rejected: string;
    full_chosen_trajectory: TrajectoryStep[];
    full_rejected_trajectory: TrajectoryStep[];
}

export class RLFPLearner {
    private outputFile = 'rlfp_training_data.jsonl';

    updateModel(preferences: PreferenceData[] | PreferenceData): void {
        const prefs = Array.isArray(preferences) ? preferences : [preferences];
        const validPrefs = prefs.filter(p => p?.preference && p.preference !== 'SKIP');
        if (!validPrefs.length) return;
        console.info(`RLFPLearner: Processing ${validPrefs.length} preference(s)...`);
        let count = 0;
        for (const pref of validPrefs) {
            const entry = this.prepareTrainingEntry(pref);
            if (entry) {
                this.appendToFile(entry);
                count++;
            }
        }
        console.info(`RLFPLearner: Appended ${count} examples to ${this.outputFile}`);
    }

    private prepareTrainingEntry(pref: PreferenceData): TrainingEntry | null {
        const promptStep = pref.trajectoryA.find(s => s.type === 'llm_prompt');
        const prompt = promptStep?.data || 'unknown_prompt';
        const [chosen, rejected] = pref.preference === 'A'
            ? [pref.trajectoryA, pref.trajectoryB]
            : [pref.trajectoryB, pref.trajectoryA];
        return {
            timestamp: Date.now(),
            prompt,
            chosen: this.extractCompletion(chosen),
            rejected: this.extractCompletion(rejected),
            full_chosen_trajectory: chosen,
            full_rejected_trajectory: rejected
        };
    }

    private extractCompletion(trajectory: TrajectoryStep[]): string {
        return trajectory
            .filter(s => s.type !== 'llm_prompt')
            .map(s => {
                if (s.type === 'tool_call') {
                    const data = s.data as any;
                    return `<tool_call>${data?.name}(${JSON.stringify(data?.args)})\nResponse: ${JSON.stringify(data?.content ?? data)}`;
                }
                return '';
            })
            .join('\n');
    }

    private appendToFile(entry: TrainingEntry): void {
        try {
            appendFileSync(this.outputFile, JSON.stringify(entry) + '\n');
        } catch (error) {
            console.error(`RLFPLearner write error: ${(error as Error).message}`);
        }
    }
}
