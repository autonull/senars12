/**
 * Profiling session management
 */
import type {NAR} from '../nar';

interface ProfileSession {
  startTime: number;
  startStats: ReturnType<NAR['getStatistics']>;
}

export class ProfileManager {
    private session: ProfileSession | null = null;

    start(nar: NAR): void {
        if (this.session) {
            console.log('Profile session already running');
            return;
        }
        this.session = {
            startTime: Date.now(),
            startStats: nar.getStatistics()
        };
        console.log('✓ Profile started');
    }

    stop(nar: NAR): void {
        if (!this.session) {
            console.log('No profile session running');
            return;
        }
        const duration = Date.now() - this.session.startTime;
        const endStats = nar.getStatistics();
        console.log('\nProfile Results:');
        console.log(` Duration: ${duration}ms`);
        console.log(` Concepts: ${endStats.totalConcepts - (this.session.startStats.totalConcepts || 0)}`);
        console.log(` Tasks: ${endStats.totalTasks - (this.session.startStats.totalTasks || 0)}`);
        this.session = null;
        console.log();
    }

    isRunning(): boolean {
        return this.session !== null;
    }
}
