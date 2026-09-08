export interface MemoryHealth {
    isHealthy: boolean;
    pressureLevel: number;
    consolidationNeeded: boolean;
    forgettingNeeded: boolean;
    recommendations: string[];
}
