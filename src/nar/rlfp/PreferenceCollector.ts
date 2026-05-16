import {promises as fs} from 'fs';
import {TrajectoryStep} from './ReasoningTrajectoryLogger.js';
import {extractTrajectoryFeatures} from './utils.js';
import {OperationError} from '../types';

export interface PreferenceData {
    trajectoryA: TrajectoryStep[];
    trajectoryB: TrajectoryStep[];
    preference: 'A' | 'B' | 'SKIP';
    timestamp: number;
    files: { A: string; B: string };
}

export class PreferenceCollector {
    private preferences: PreferenceData[] = [];
    private implicitWeight = 0.3;

    async collectPreference(pathA: string, pathB: string): Promise<PreferenceData | null> {
        let trajectoryA: TrajectoryStep[], trajectoryB: TrajectoryStep[];
        try {
            trajectoryA = await this.loadTrajectory(pathA);
            trajectoryB = await this.loadTrajectory(pathB);
        } catch (error) {
            throw new OperationError(`Error loading trajectories: ${(error as Error).message}`, {pathA, pathB});
        }

        // Debug: Compare trajectories A and B
        // console.log('\n==========================================');
        // console.log('=== Trajectory A ===');
        // console.log(this.formatTrajectory(trajectoryA));
        // console.log('\n=== Trajectory B ===');
        // console.log(this.formatTrajectory(trajectoryB));
        // console.log('==========================================\n');

        const preference = await this.promptUser();
        if (preference === 'SKIP') return null;

        const data: PreferenceData = {
            trajectoryA,
            trajectoryB,
            preference,
            timestamp: Date.now(),
            files: {A: pathA, B: pathB}
        };

        this.preferences.push(data);
        return data;
    }

    addPreference(preferenceData: Omit<PreferenceData, 'timestamp'>): void {
        this.preferences.push({...preferenceData, timestamp: Date.now()});
    }

    async loadTrajectory(path: string): Promise<TrajectoryStep[]> {
        try {
            const data = await fs.readFile(path, 'utf-8');
            return JSON.parse(data) as TrajectoryStep[];
        } catch (error) {
            throw new OperationError(`Failed to load trajectory from ${path}: ${(error as Error).message}`, {path});
        }
    }

    formatTrajectory(traj: TrajectoryStep[]): string {
        if (!Array.isArray(traj)) return 'Invalid trajectory';

        return traj.map(step => {
            const ts = step.timestamp ? new Date(step.timestamp).toISOString().split('T')?.[1]?.split('.')?.[0] : '';
            let content = JSON.stringify(step);

            if (step.type === 'llm_prompt') {
                const msg = (step.data as Record<string, unknown>)?.messages ?? step.data ?? '';
                const txt = typeof msg === 'string' ? msg.slice(0, 100) : JSON.stringify(msg);
                content = `LLM Prompt: "${txt.replace(/\n/g, ' ')}..."`;
            } else if (step.type === 'tool_call') {
                content = `Tool: ${(step.data as Record<string, unknown>)?.name}(${JSON.stringify((step.data as Record<string, unknown>)?.args)})`;
            } else if (step.type === 'lm_response') {
                content = `Response: ${JSON.stringify((step.data as Record<string, unknown>)?.content ?? step.data)}`;
            }
            return `${ts} [${step.type}] ${content}`;
        }).join('\n');
    }

    async savePreferences(path: string): Promise<void> {
        await fs.writeFile(path, JSON.stringify(this.preferences, null, 2));
    }

    getPreferences(): PreferenceData[] {
        return this.preferences;
    }

    detectImplicitPreference(trajectoryA: TrajectoryStep[], trajectoryB: TrajectoryStep[]): 'A' | 'B' | 'SKIP' {
        const scoreA = this.computeImplicitScore(trajectoryA);
        const scoreB = this.computeImplicitScore(trajectoryB);

        const threshold = 0.1;
        const diff = scoreA - scoreB;

        if (Math.abs(diff) < threshold) return 'SKIP';
        return diff > 0 ? 'A' : 'B';
    }

    aggregatePreferences(
        prefs: Array<{ preference: 'A' | 'B' | 'SKIP'; weight?: number }>
    ): { result: 'A' | 'B' | 'SKIP'; confidence: number; distribution: Record<'A' | 'B' | 'SKIP', number> } {
        if (prefs.length === 0) {
            return {result: 'SKIP', confidence: 0, distribution: {A: 0, B: 0, SKIP: 0}};
        }

        let scoreA = 0;
        let scoreB = 0;
        let scoreSkip = 0;
        let totalWeight = 0;

        for (const pref of prefs) {
            const weight = pref.weight ?? 1;
            totalWeight += weight;

            if (pref.preference === 'A') scoreA += weight;
            else if (pref.preference === 'B') scoreB += weight;
            else scoreSkip += weight;
        }

        const normalizedA = scoreA / totalWeight;
        const normalizedB = scoreB / totalWeight;
        const normalizedSkip = scoreSkip / totalWeight;

        const maxScore = Math.max(normalizedA, normalizedB, normalizedSkip);
        const threshold = 0.4;

        if (maxScore < threshold || normalizedSkip > 0.5) {
            return {
                result: 'SKIP',
                confidence: normalizedSkip,
                distribution: {A: normalizedA, B: normalizedB, SKIP: normalizedSkip}
            };
        }

        return {
            result: normalizedA > normalizedB ? 'A' : 'B',
            confidence: maxScore,
            distribution: {A: normalizedA, B: normalizedB, SKIP: normalizedSkip}
        };
    }

    setImplicitWeight(weight: number): void {
        this.implicitWeight = Math.max(0, Math.min(1, weight));
    }

    getImplicitWeight(): number {
        return this.implicitWeight;
    }

    private computeImplicitScore(trajectory: TrajectoryStep[]): number {
        let score = 0;

        const {toolCalls, lmResponses, errors, uniqueTools} = extractTrajectoryFeatures(trajectory);

        score += toolCalls.length * 0.2;
        score += lmResponses.length * 0.3;
        score -= errors.length * 0.5;
        score += uniqueTools.size * 0.1;

        if (trajectory.length > 0) {
            const lastStep = trajectory[trajectory.length - 1]!;
            if (lastStep.type === 'lm_response') {
                const content = (lastStep.data as Record<string, unknown>)?.content || '';
                const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
                score += Math.min(contentStr.length / 1000, 1) * 0.3;
            }
        }

        return score;
    }

    private async promptUser(): Promise<'A' | 'B' | 'SKIP'> {
        return new Promise((resolve) => {
            void import('readline').then((readline) => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                rl.question('Which trajectory do you prefer? (A/B/Skip): ', (answer) => {
                    rl.close();
                    const choice = answer.toUpperCase().trim();
                    if (choice === 'A' || choice === 'B') resolve(choice as 'A' | 'B');
                    else resolve('SKIP');
                });
            });
        });
    }
}
