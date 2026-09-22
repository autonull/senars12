/**
 * TODO19 F5: the unified parameter table with ownership. Collapses the three
 * parallel tables (SelfMetaGame's knob switch-case, CognitiveParameters
 * bounds/PARAMETER_SPACE, and per-game config) into one abstraction: every
 * parameter is `{ scope, min, max, value, owner }` and actuates through an
 * owner-supplied closure. Game-local tables are scopes of the same thing;
 * system knobs are unreachable outside the SelfMetaGame (scope enforcement,
 * C3/Phase-B benches).
 */

export type ParameterScope = 'system' | `game:${string}`;

export interface ParameterSpec {
  name: string;
  scope: ParameterScope;
  min: number;
  max: number;
  value: number;
  /** The subsystem that owns/actuates this parameter (e.g. 'self-meta-game'). */
  owner: string;
  /** Applied on every accepted `set`; clamping happens before the call. */
  actuate?: (value: number) => void;
}

export class ParameterScopeError extends Error {
  readonly scope: ParameterScope;
  readonly parameter: string;

  constructor(message: string, scope: ParameterScope, name: string) {
    super(message);
    this.name = 'ParameterScopeError';
    this.scope = scope;
    this.parameter = name;
  }
}

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

export class ParameterTable {
  private readonly entries = new Map<string, ParameterSpec>();
  private readonly key = (scope: ParameterScope, name: string) => `${scope}::${name}`;

  register(spec: ParameterSpec): void {
    const key = this.key(spec.scope, spec.name);
    const existing = this.entries.get(key);
    this.entries.set(key, { ...spec, value: clamp(spec.value, spec.min, spec.max) });
    if (existing?.actuate) existing.actuate(this.entries.get(key)!.value);
  }

  /** Set a parameter value; the caller's scope must match the parameter's scope. */
  set(callerScope: ParameterScope, name: string, value: number): number {
    return this.setMany(callerScope, [[name, value]])[0]!;
  }

  /**
   * P4 (TODO20): batched write — validates and clamps all updates first (all-or-
   * nothing on scope errors), then actuates each accepted parameter exactly once.
   * Cuts per-write actuator churn when callers apply several knobs per tick.
   */
  setMany(callerScope: ParameterScope, updates: Array<[string, number]>): number[] {
    const applied: Array<{ spec: ParameterSpec; value: number }> = [];
    for (const [name, value] of updates) {
      const spec = this.entries.get(this.key(callerScope, name));
      if (!spec) {
        const foreign = this.entries.get(this.key('system', name));
        if (foreign && callerScope !== 'system')
          throw new ParameterScopeError(
            `scope "${callerScope}" cannot tune system parameter "${name}" (owner: ${foreign.owner})`,
            callerScope,
            name
          );
        throw new ParameterScopeError(`unknown parameter: ${name}`, callerScope, name);
      }
      applied.push({ spec, value: clamp(value, spec.min, spec.max) });
    }
    return applied.map(({ spec, value }) => {
      const changed = spec.value !== value;
      spec.value = value;
      if (changed) spec.actuate?.(spec.value);
      return spec.value;
    });
  }

  get(scope: ParameterScope, name: string): number | undefined {
    return this.entries.get(this.key(scope, name))?.value;
  }

  list(scope?: ParameterScope): Map<string, number> {
    const out = new Map<string, number>();
    for (const [key, spec] of this.entries)
      if (!scope || spec.scope === scope) out.set(key.split('::')[1]!, spec.value);
    return out;
  }
}

export const createParameterTable = (): ParameterTable => new ParameterTable();
