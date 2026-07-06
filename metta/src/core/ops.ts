import type { MeTTaAtom } from '../types/ast.js';

export type GroundedOp<
  Args extends readonly MeTTaAtom[] = readonly MeTTaAtom[],
  Ret extends MeTTaAtom = MeTTaAtom
> = {
  readonly name: string;
  readonly execute: (...args: Args) => Ret;
  readonly pure?: boolean;
  readonly lazy?: boolean;
};

const ops = new Map<string, GroundedOp>();

export function registerOp(name: string, op: GroundedOp): void {
  ops.set(name, op);
}

export function getOp(name: string): GroundedOp | undefined {
  return ops.get(name);
}

export function hasOp(name: string): boolean {
  return ops.has(name);
}

export function clearOps(): void {
  ops.clear();
}

export function defineOp<
  Args extends readonly MeTTaAtom[],
  Ret extends MeTTaAtom
>(
  name: string,
  impl: (...args: Args) => Ret,
  opts?: { pure?: boolean; lazy?: boolean }
): GroundedOp<Args, Ret> {
  return {
    name,
    execute: impl,
    pure: opts?.pure ?? true,
    lazy: opts?.lazy ?? false,
  };
}