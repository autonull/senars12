import { promises as fs } from 'fs';
import { TrajectoryStep } from './ReasoningTrajectoryLogger.js';

export interface PreferenceData {
  trajectoryA: TrajectoryStep[];
  trajectoryB: TrajectoryStep[];
  preference: 'A' | 'B' | 'SKIP';
  timestamp: number;
  files: { A: string; B: string };
}

export class PreferenceCollector {
  private preferences: PreferenceData[] = [];

  async collectPreference(pathA: string, pathB: string): Promise<PreferenceData | null> {
    let trajectoryA: TrajectoryStep[], trajectoryB: TrajectoryStep[];
    try {
      trajectoryA = await this.loadTrajectory(pathA);
      trajectoryB = await this.loadTrajectory(pathB);
    } catch (error) {
      console.error('Error loading trajectories:', (error as Error).message);
      return null;
    }

    console.log('\n==========================================');
    console.log('=== Trajectory A ===');
    console.log(this.formatTrajectory(trajectoryA));
    console.log('\n=== Trajectory B ===');
    console.log(this.formatTrajectory(trajectoryB));
    console.log('==========================================\n');

    const preference = await this.promptUser();
    if (preference === 'SKIP') return null;

    const data: PreferenceData = {
      trajectoryA,
      trajectoryB,
      preference,
      timestamp: Date.now(),
      files: { A: pathA, B: pathB }
    };

    this.preferences.push(data);
    return data;
  }

  private async promptUser(): Promise<'A' | 'B' | 'SKIP'> {
    return new Promise((resolve) => {
      const readline = await import('readline');
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
  }

  addPreference(preferenceData: Omit<PreferenceData, 'timestamp'>): void {
    this.preferences.push({ ...preferenceData, timestamp: Date.now() });
  }

  async loadTrajectory(path: string): Promise<TrajectoryStep[]> {
    const data = await fs.readFile(path, 'utf-8');
    return JSON.parse(data) as TrajectoryStep[];
  }

  formatTrajectory(traj: TrajectoryStep[]): string {
    if (!Array.isArray(traj)) return 'Invalid trajectory';

    return traj.map(step => {
      const ts = step.timestamp ? new Date(step.timestamp).toISOString().split('T')[1].split('.')[0] : '';
      let content = JSON.stringify(step);

      if (step.type === 'llm_prompt') {
        const msg = (step.data as any)?.messages || step.data || '';
        const txt = typeof msg === 'string' ? msg.slice(0, 100) : JSON.stringify(msg);
        content = `LLM Prompt: "${txt.replace(/\n/g, ' ')}..."`;
      } else if (step.type === 'tool_call') {
        content = `Tool: ${(step.data as any)?.name}(${JSON.stringify((step.data as any)?.args)})`;
      } else if (step.type === 'lm_response') {
        content = `Response: ${JSON.stringify((step.data as any)?.content || step.data)}`;
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
}
