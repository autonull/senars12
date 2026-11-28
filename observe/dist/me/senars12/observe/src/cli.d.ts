import type { ScenarioRunnerDeps } from '@senars/tools/adapters/scenario-execute';
export interface ObserveCLIOptions {
    deps: ScenarioRunnerDeps;
}
export declare function observeCLI(argv: string[], options: ObserveCLIOptions): Promise<number>;
//# sourceMappingURL=cli.d.ts.map