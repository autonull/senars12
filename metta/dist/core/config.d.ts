export interface MeTTaConfig {
    readonly maxSteps: number;
    readonly timeout: number;
    readonly caching: {
        readonly enabled: boolean;
        readonly reductionCacheSize: number;
        readonly memoizationTTL: number;
        readonly weakRefs: boolean;
    };
    readonly interning: {
        readonly enabled: boolean;
        readonly weakRefs: boolean;
    };
    readonly jit: {
        readonly enabled: boolean;
        readonly threshold: number;
    };
    readonly concurrency: {
        readonly workers: number;
        readonly ipc: 'shared-memory' | 'message-port' | 'none';
    };
    readonly types: {
        readonly enabled: boolean;
        readonly strict: boolean;
    };
    readonly debug: {
        readonly enabled: boolean;
        readonly trace: boolean;
        readonly visualizer: boolean;
    };
}
export declare const presets: {
    readonly development: {
        readonly maxSteps: number;
        readonly timeout: number;
        readonly caching: {
            readonly enabled: boolean;
            readonly reductionCacheSize: number;
            readonly memoizationTTL: number;
            readonly weakRefs: boolean;
        };
        readonly interning: {
            readonly enabled: boolean;
            readonly weakRefs: boolean;
        };
        readonly jit: {
            readonly enabled: boolean;
            readonly threshold: number;
        };
        readonly concurrency: {
            readonly workers: number;
            readonly ipc: 'shared-memory' | 'message-port' | 'none';
        };
        readonly debug: {
            readonly enabled: true;
            readonly trace: true;
            readonly visualizer: true;
        };
        readonly types: {
            readonly enabled: true;
            readonly strict: true;
        };
    };
    readonly production: {
        readonly maxSteps: number;
        readonly timeout: number;
        readonly interning: {
            readonly enabled: boolean;
            readonly weakRefs: boolean;
        };
        readonly types: {
            readonly enabled: boolean;
            readonly strict: boolean;
        };
        readonly debug: {
            readonly enabled: boolean;
            readonly trace: boolean;
            readonly visualizer: boolean;
        };
        readonly caching: {
            readonly enabled: boolean;
            readonly reductionCacheSize: number;
            readonly memoizationTTL: number;
            readonly weakRefs: false;
        };
        readonly jit: {
            readonly enabled: true;
            readonly threshold: 50;
        };
        readonly concurrency: {
            readonly workers: 4;
            readonly ipc: 'shared-memory';
        };
    };
    readonly openEnded: {
        readonly jit: {
            readonly enabled: boolean;
            readonly threshold: number;
        };
        readonly concurrency: {
            readonly workers: number;
            readonly ipc: 'shared-memory' | 'message-port' | 'none';
        };
        readonly types: {
            readonly enabled: boolean;
            readonly strict: boolean;
        };
        readonly debug: {
            readonly enabled: boolean;
            readonly trace: boolean;
            readonly visualizer: boolean;
        };
        readonly maxSteps: number;
        readonly timeout: number;
        readonly caching: {
            readonly enabled: boolean;
            readonly reductionCacheSize: number;
            readonly memoizationTTL: number;
            readonly weakRefs: true;
        };
        readonly interning: {
            readonly enabled: true;
            readonly weakRefs: true;
        };
    };
};
export declare function createConfig(overrides?: Partial<MeTTaConfig>): MeTTaConfig;
//# sourceMappingURL=config.d.ts.map