import {PolicyOptimizer, PreferenceCollector, RewardModel, RLFPLearner, TrajectoryStep} from '../nar/rlfp';

export class RLFPCLI {
    private collector: PreferenceCollector;
    private readonly rewardModel: RewardModel;
    private policyOptimizer: PolicyOptimizer;
    private learner: RLFPLearner;
    private currentTrajectory: TrajectoryStep[] = [];

    constructor() {
        this.collector = new PreferenceCollector();
        this.rewardModel = new RewardModel();
        this.policyOptimizer = new PolicyOptimizer(this.rewardModel);
        this.learner = new RLFPLearner();
    }

    async collectPreference(pathA: string, pathB: string): Promise<void> {
        console.log(`\nCollecting preference between ${pathA} and ${pathB}...`);
        const result = await this.collector.collectPreference(pathA, pathB);

        if (result) {
            this.learner.updateModel(result);
            console.log('✓ Preference recorded and training data saved');
        } else {
            console.log('○ Preference collection skipped');
        }
    }

    async compareTrajectories(trajectoryA: TrajectoryStep[], trajectoryB: TrajectoryStep[]): Promise<void> {
        const comparison = this.rewardModel.compare(trajectoryA, trajectoryB);

        console.log('\n=== Trajectory Comparison ===');
        console.log(`Trajectory A reward: ${comparison.rewardA.toFixed(4)}`);
        console.log(`Trajectory B reward: ${comparison.rewardB.toFixed(4)}`);
        console.log(`Preferred: ${comparison.preferred}`);
        console.log(`Confidence: ${(comparison.confidence * 100).toFixed(1)}%`);
        console.log();
    }

    addStrategy(name: string, params: Map<string, unknown> = new Map()): void {
        this.policyOptimizer.addStrategy(name, params);
        console.log(`✓ Strategy "${name}" added`);
    }

    selectStrategy(context: string): string {
        const selected = this.policyOptimizer.selectStrategy(context);
        console.log(`Selected strategy: ${selected}`);
        return selected;
    }

    showStrategies(): void {
        const strategies = this.policyOptimizer.getAllStrategies();

        if (strategies.length === 0) {
            console.log('No strategies registered');
            return;
        }

        console.log('\n=== Registered Strategies ===');
        for (const name of strategies) {
            const stats = this.policyOptimizer.getStrategyStats(name);
            if (stats) {
                console.log(`- ${name}:`);
                console.log(`  Priority: ${(stats.priority ?? 0).toFixed(2)}`);
                console.log(`  Success Rate: ${((stats.successRate ?? 0) * 100).toFixed(1)}%`);
                console.log(`  Avg Reward: ${(stats.avgReward ?? 0).toFixed(4)}`);
            }
        }
        console.log();
    }

    optimizePolicies(iterations: number = 10): void {
        const updates = this.policyOptimizer.optimize(iterations);

        if (updates.length === 0) {
            console.log('○ No policy updates (insufficient history)');
            return;
        }

        console.log(`\n✓ Applied ${updates.length} policy update(s):`);
        for (const update of updates) {
            console.log(`  - ${update.key}: ${update.reason} (Δ: ${update.rewardDelta.toFixed(4)})`);
        }
        console.log();
    }

    detectImplicitPreference(trajectoryA: TrajectoryStep[], trajectoryB: TrajectoryStep[]): void {
        const preference = this.collector.detectImplicitPreference(trajectoryA, trajectoryB);
        console.log(`\nImplicit preference detected: ${preference}`);
    }

    aggregatePreferences(prefs: Array<{ preference: 'A' | 'B' | 'SKIP'; weight?: number }>): void {
        const result = this.collector.aggregatePreferences(prefs);
        console.log('\n=== Preference Aggregation ===');
        console.log(`Result: ${result.result}`);
        console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`Distribution: A=${(result.distribution.A * 100).toFixed(1)}%, B=${(result.distribution.B * 100).toFixed(1)}%, SKIP=${(result.distribution.SKIP * 100).toFixed(1)}%`);
        console.log();
    }

    showRewardFeatures(trajectory: TrajectoryStep[]): void {
        const prediction = this.rewardModel.predict(trajectory);

        console.log('\n=== Trajectory Features ===');
        console.log(`Reward: ${prediction.reward.toFixed(4)}`);
        console.log(`Steps: ${prediction.features.trajectoryLength}`);
        console.log(`Tool calls: ${prediction.features.toolCallsCount}`);
        console.log(`LM responses: ${prediction.features.lmResponsesCount}`);
        console.log(`Errors: ${prediction.features.errorCount}`);
        console.log(`Unique tools: ${prediction.features.uniqueTools}`);
        console.log(`Completion length: ${prediction.features.completionLength}`);
        console.log();
    }

    startNewTrajectory(): void {
        this.currentTrajectory = [];
        console.log('✓ New trajectory started');
    }

    addToTrajectory(step: TrajectoryStep): void {
        this.currentTrajectory.push(step);
    }

    getCurrentTrajectory(): TrajectoryStep[] {
        return this.currentTrajectory;
    }

    clearTrajectory(): void {
        this.currentTrajectory = [];
        console.log('✓ Trajectory cleared');
    }
}
