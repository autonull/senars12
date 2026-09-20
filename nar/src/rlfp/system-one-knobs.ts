export interface SystemOneKnobSpec {
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export const systemOneKnobSchema: readonly SystemOneKnobSpec[] = [
  { name: 'systemOne.budgets.maxJudgmentCallsPerCycle', min: 1, max: 32, step: 1 },
  { name: 'systemOne.budgets.maxConsensusPerCycle', min: 1, max: 8, step: 1 },
  { name: 'systemOne.budgets.maxLatencyMsPerJudgment', min: 10, max: 200, step: 1 },
  { name: 'systemOne.budgets.maxTokensPerCycle', min: 256, max: 32768, step: 256 },
  { name: 'systemOne.budgets.maxMemoryMbPerCycle', min: 32, max: 2048, step: 32 },
  { name: 'systemOne.provisional.cInitial', min: 0.01, max: 0.5, step: 0.01 },
  { name: 'systemOne.provisional.decayRate', min: 0.05, max: 1.0, step: 0.05 },
  { name: 'systemOne.provisional.maxTtlMs', min: 5000, max: 300000, step: 5000 },
] as const;

export function validateSystemOneKnob(name: string, value: number): { approved: boolean; reason: string } {
  const spec = systemOneKnobSchema.find((k) => k.name === name);
  if (!spec) return { approved: false, reason: `Unknown systemOne knob '${name}'` };
  if (typeof value !== 'number' || Number.isNaN(value))
    return { approved: false, reason: `Non-numeric value for '${spec.name}'` };
  if (value < spec.min || value > spec.max)
    return {
      approved: false,
      reason: `'${spec.name}'=${value} outside [${spec.min}, ${spec.max}]`,
    };
  return { approved: true, reason: `'${spec.name}'=${value} within [${spec.min}, ${spec.max}]` };
}