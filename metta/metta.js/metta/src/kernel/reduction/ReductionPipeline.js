/**
 * ReductionPipeline.js - Pipeline-based reduction engine
 * Optimized for performance and robustness (Tier 1 & MORK-parity)
 */

import { Logger } from '@senars/core';
import { equals, exp, isExpression, isVariable } from '../Term.js';
import { Zipper } from '../Zipper.js';
import { JITCompiler } from './JITCompiler.js';
import { CacheStage } from './stages/CacheStage.js';
import { ClosureStage } from './stages/ClosureStage.js';
import { ExplicitCallStage } from './stages/ExplicitCallStage.js';
import { GroundedOpStage } from './stages/GroundedOpStage.js';
import { JITStage } from './stages/JITStage.js';
import { OperatorReduceStage } from './stages/OperatorReduceStage.js';
import { RuleMatchStage } from './stages/RuleMatchStage.js';
import { SubExprStage } from './stages/SubExprStage.js';
import { SuperposeStage } from './stages/SuperposeStage.js';
import { ZipperStage } from './stages/ZipperStage.js';

export class ReductionPipeline {
  constructor(config = null) {
    this.stages = [];
    this.config = config;
    this.stats = { executions: 0, stageHits: new Map(), stageTimes: new Map() };
  }

  static createStandard(config, jitCompiler = null) {
    const pipeline = new ReductionPipeline(config);
    pipeline.use(new CacheStage());
    if (jitCompiler) {
      pipeline.use(new JITStage(jitCompiler));
    }
    pipeline.use(new SuperposeStage());
    pipeline.use(new ClosureStage());
    pipeline.use(new SubExprStage());
    pipeline.use(new RuleMatchStage());
    pipeline.use(new OperatorReduceStage());
    pipeline.use(new ZipperStage(config?.get('zipperThreshold') ?? 1));
    pipeline.use(new GroundedOpStage());
    pipeline.use(new ExplicitCallStage());
    return pipeline;
  }

  use(stage) {
    this.stages.push(stage);
    return this;
  }

  remove(stageName) {
    this.stages = this.stages.filter((s) => s.name !== stageName);
    return this;
  }

  setStageEnabled(stageName, enabled) {
    const stage = this.stages.find((s) => s.name === stageName);
    if (stage) {
      stage.enabled = enabled;
    }
    return this;
  }

  *execute(atom, context) {
    if (context.limit != null && context.steps >= context.limit) {
      throw new Error(`Max steps exceeded: ${context.limit} steps`);
    }
    this.stats.executions++;
    for (const stage of this.stages) {
      const stageStart = Date.now();
      let result;
      try {
        result = stage.execute(atom, context);
      } catch (e) {
        if (e.message.startsWith('Max steps exceeded')) throw e;
        Logger.error(`ReductionStage ${stage.name} error:`, e);
        continue;
      }
      const stageTime = Date.now() - stageStart;
      if (!result) {
        continue;
      }
      this._recordStageHit(stage.name, stageTime);

      let stageGenerator = null;
      if (result.useZipper) {
        stageGenerator = this._executeWithZipper(result.atom, context);
      } else if (result.executeGrounded) {
        stageGenerator = this._executeGrounded(
          result.atom,
          result.op,
          result.args,
          context,
          result.async
        );
      } else if (result.executeExplicit) {
        stageGenerator = this._executeExplicit(result.atom, result.op, result.args, context);
      } else if (result.matchRules) {
        stageGenerator = this._matchRules(result.atom, result.rules, context);
      } else if (result.matchClosure) {
        stageGenerator = this._matchClosure(
          result.atom,
          result.funcAtom,
          result.capturedArgs,
          result.providedArgs,
          result.allArgs,
          result.rules,
          context
        );
      } else if (result.reduceOperatorExpr) {
        stageGenerator = this._reduceSubExpr(result.atom, 'operator', context);
      } else if (result.reduceFirstArg) {
        stageGenerator = this._reduceSubExpr(result.atom, 0, context);
      } else if (result.reduceOperator) {
        stageGenerator = this._reduceOperator(result.atom, context);
      } else if (result.reduceArgument) {
        stageGenerator = this._reduceArgument(result.atom, result.argIndex, result.arg, context);
      } else if (result.reduceNestedSuperpose) {
        stageGenerator = this._reduceNestedSuperpose(
          result.atom,
          result.superposeAtom,
          result.path,
          context
        );
      } else if (result.superpose) {
        stageGenerator = this._executeSuperpose(result.alternatives, context);
      } else if (result.superposeEmpty) {
        yield { reduced: atom, applied: true, deadEnd: true };
        return;
      } else if (result.applied) {
        yield result;
        return;
      }

      if (stageGenerator) {
        let anyApplied = false;
        for (const res of stageGenerator) {
          if (res.applied) {
            yield res;
            anyApplied = true;
          }
        }
        if (anyApplied) {
          return;
        }
      }
    }
    yield { reduced: atom, applied: false };
  }

  async *executeAsync(atom, context) {
    if (context.limit != null && context.steps >= context.limit) {
      throw new Error(`Max steps exceeded: ${context.limit} steps`);
    }
    this.stats.executions++;
    for (const stage of this.stages) {
      const stageStart = Date.now();
      let result;
      try {
        result = stage.execute(atom, context);
      } catch (e) {
        if (e.message.startsWith('Max steps exceeded')) {
          throw e;
        }
        Logger.error(`ReductionStage ${stage.name} error:`, e);
        continue;
      }
      const stageTime = Date.now() - stageStart;
      if (!result) {
        continue;
      }
      this._recordStageHit(stage.name, stageTime);

      let stageGenerator = null;
      if (result.useZipper) {
        stageGenerator = this._executeWithZipperAsync(result.atom, context);
      } else if (result.executeGrounded) {
        stageGenerator = this._executeGroundedAsync(
          result.atom,
          result.op,
          result.args,
          context,
          result.async
        );
      } else if (result.executeExplicit) {
        stageGenerator = this._executeExplicit(result.atom, result.op, result.args, context);
      } else if (result.matchRules) {
        stageGenerator = this._matchRules(result.atom, result.rules, context);
      } else if (result.matchClosure) {
        stageGenerator = this._matchClosure(
          result.atom,
          result.funcAtom,
          result.capturedArgs,
          result.providedArgs,
          result.allArgs,
          result.rules,
          context
        );
      } else if (result.reduceOperatorExpr) {
        stageGenerator = this._reduceSubExprAsync(result.atom, 'operator', context);
      } else if (result.reduceFirstArg) {
        stageGenerator = this._reduceSubExprAsync(result.atom, 0, context);
      } else if (result.reduceOperator) {
        stageGenerator = this._reduceOperatorAsync(result.atom, context);
      } else if (result.reduceArgument) {
        stageGenerator = this._reduceArgumentAsync(
          result.atom,
          result.argIndex,
          result.arg,
          context
        );
      } else if (result.reduceNestedSuperpose) {
        stageGenerator = this._reduceNestedSuperpose(
          result.atom,
          result.superposeAtom,
          result.path,
          context
        );
      } else if (result.superpose) {
        stageGenerator = this._executeSuperpose(result.alternatives, context);
      } else if (result.superposeEmpty) {
        yield { reduced: atom, applied: true, deadEnd: true };
        return;
      } else if (result.applied) {
        yield result;
        return;
      }

      if (stageGenerator) {
        let anyApplied = false;
        for await (const res of stageGenerator) {
          if (res.applied) {
            yield res;
            anyApplied = true;
          }
        }
        if (anyApplied) {
          return;
        }
      }
    }
    yield { reduced: atom, applied: false };
  }

  *_executeWithZipper(atom, context) {
    if (atom.operator && isExpression(atom.operator)) {
      for (const res of this.execute(atom.operator, context)) {
        if (res.applied && !equals(res.reduced, atom.operator)) {
          yield { reduced: exp(res.reduced, atom.components), applied: true, stage: 'zipper-op' };
          return;
        }
      }
    }
    const zipper = new Zipper(atom);
    while (zipper.down(0)) {
      /* advance to deepest */
    }
    do {
      let focusApplied = false;
      for (const res of this.execute(zipper.focus, context)) {
        if (res.applied && !equals(res.reduced, zipper.focus)) {
          yield { reduced: zipper.replace(res.reduced), applied: true, stage: 'zipper-focus' };
          focusApplied = true;
        }
      }
      if (focusApplied) {
        return;
      }
      // Move right if possible, then descend to deepest of new subtree;
      // otherwise move up one level
      if (zipper.right()) {
        while (zipper.down(0)) {
          /* descend */
        }
      } else if (!zipper.up()) {
        break;
      }
    } while (zipper.depth > 0);
  }

  async *_executeWithZipperAsync(atom, context) {
    if (atom.operator && isExpression(atom.operator)) {
      for await (const res of this.executeAsync(atom.operator, context)) {
        if (res.applied && !equals(res.reduced, atom.operator)) {
          yield { reduced: exp(res.reduced, atom.components), applied: true, stage: 'zipper-op' };
          return;
        }
      }
    }
    const zipper = new Zipper(atom);
    while (zipper.down(0)) {
      /* advance to deepest */
    }
    do {
      let focusApplied = false;
      for await (const res of this.executeAsync(zipper.focus, context)) {
        if (res.applied && !equals(res.reduced, zipper.focus)) {
          yield { reduced: zipper.replace(res.reduced), applied: true, stage: 'zipper-focus' };
          focusApplied = true;
        }
      }
      if (focusApplied) {
        return;
      }
      // Move right if possible, then descend to deepest of new subtree;
      // otherwise move up one level
      if (zipper.right()) {
        while (zipper.down(0)) {
          /* descend */
        }
      } else if (!zipper.up()) {
        break;
      }
    } while (zipper.depth > 0);
  }

  *_executeGrounded(atom, op, args, _context, isAsync = false) {
    try {
      const result = op(...args);
      // Handle async ops in sync path: try to resolve the Promise
      if (result instanceof Promise) {
        // Check if the Promise resolves immediately (e.g., async fn with no actual awaits)
        let settled = false;
        let syncResult;
        result
          .then((r) => {
            settled = true;
            syncResult = r;
          })
          .catch(() => {});
        if (settled && syncResult != null && !equals(syncResult, atom)) {
          yield { reduced: syncResult, applied: true, stage: 'grounded' };
          return;
        }
        yield { reduced: atom, applied: false };
        return;
      }
      if (result != null && !equals(result, atom)) {
        yield { reduced: result, applied: true, stage: 'grounded' };
      }
    } catch (e) {
      if (args.every((a) => !isExpression(a)) && !args.some(isVariable)) {
        throw e;
      }
    }
  }

  async *_executeGroundedAsync(atom, op, args, _context, isAsync = false) {
    try {
      const result = op(...args);
      if (isAsync || result instanceof Promise) {
        const resolved = await result;
        if (resolved != null && !equals(resolved, atom)) {
          yield { reduced: resolved, applied: true, stage: 'grounded-async' };
        }
        return;
      }
      if (result != null && !equals(result, atom)) {
        yield { reduced: result, applied: true, stage: 'grounded' };
      }
    } catch (e) {
      if (args.every((a) => !isExpression(a)) && !args.some(isVariable)) {
        throw e;
      }
    }
  }

  *_executeExplicit(atom, op, args, _context) {
    try {
      const result = op(...args);
      if (result != null && !equals(result, atom)) {
        yield { reduced: result, applied: true, stage: 'explicit' };
      }
    } catch (e) {
      Logger.debug(`Explicit call failed for op '${op?.name || 'unknown'}': ${e.message}`);
    }
  }

  *_matchRules(atom, rules, context) {
    for (const rule of rules) {
      const { pattern, result: template } = rule;
      if (template === undefined) {
        continue;
      }
      const binds = context.Unify?.unify(pattern, atom);
      if (binds != null) {
        const reduced =
          typeof template === 'function'
            ? template(binds)
            : context.Unify?.subst(template, binds, { recursive: false });
        if (reduced != null) {
          yield { reduced, applied: true, stage: 'rule-match' };
        }
      }
    }
  }

  *_matchClosure(atom, funcAtom, capturedArgs, providedArgs, allArgs, rules, context) {
    // Build expression: (func captured1 captured2 ... provided1 provided2 ...)
    let baseFunc = funcAtom;
    let currentAtom = atom;

    while (
      !baseFunc?.name &&
      baseFunc?.type !== 'variable' &&
      !baseFunc?.operator?.name &&
      currentAtom?.operator
    ) {
      baseFunc = currentAtom.operator;
      currentAtom = currentAtom.operator;
    }

    const callExpr = exp(baseFunc, allArgs);

    // Find rules dynamically down the operator chain if missing
    if (rules.length === 0) {
      let lookupAtom = atom;
      while (lookupAtom?.operator && rules.length === 0) {
        if (lookupAtom.operator.name) {
          rules = context.space?.rulesFor(lookupAtom.operator) || [];
        }
        lookupAtom = lookupAtom.operator;
      }
    }
    for (const rule of rules) {
      const { pattern, result: template } = rule;
      if (template === undefined || !isExpression(pattern)) {
        continue;
      }
      const patternArgs = pattern.components ?? [];
      // Check if allArgs can match the pattern
      if (allArgs.length < patternArgs.length) {
        // Still partial - return unevaluated
        continue;
      }
      const binds = context.Unify?.unify(pattern, callExpr);
      if (binds != null) {
        const reduced =
          typeof template === 'function'
            ? template(binds)
            : context.Unify?.subst(template, binds, { recursive: false });
        if (reduced != null) {
          yield { reduced, applied: true, stage: 'closure' };
        }
      }
    }
  }

  *_reduceOperator(atom, context) {
    const op = atom.operator;
    for (const res of this.execute(op, context)) {
      if (res.applied && !equals(res.reduced, op)) {
        yield {
          reduced: exp(res.reduced, atom.components),
          applied: true,
          stage: 'operator-reduce',
        };
        return;
      }
    }
  }

  async *_reduceOperatorAsync(atom, context) {
    const op = atom.operator;
    for await (const res of this.executeAsync(op, context)) {
      if (res.applied && !equals(res.reduced, op)) {
        yield {
          reduced: exp(res.reduced, atom.components),
          applied: true,
          stage: 'operator-reduce',
        };
        return;
      }
    }
  }

  *_reduceArgument(atom, argIndex, arg, context) {
    for (const res of this.execute(arg, context)) {
      if (res.applied && !equals(res.reduced, arg)) {
        const newArgs = [...atom.components];
        const componentIndex = argIndex + (atom.operator?.name === '^' ? 1 : 0);
        newArgs[componentIndex] = res.reduced;
        yield { reduced: exp(atom.operator, newArgs), applied: true, stage: 'argument-reduce' };
        return;
      }
    }
  }

  async *_reduceArgumentAsync(atom, argIndex, arg, context) {
    for await (const res of this.executeAsync(arg, context)) {
      if (res.applied && !equals(res.reduced, arg)) {
        const newArgs = [...atom.components];
        const componentIndex = argIndex + (atom.operator?.name === '^' ? 1 : 0);
        newArgs[componentIndex] = res.reduced;
        yield { reduced: exp(atom.operator, newArgs), applied: true, stage: 'argument-reduce' };
        return;
      }
    }
    // Arg couldn't be reduced further — try executing the grounded op as-is
    if (atom.operator?.name === '^' && atom.components?.length >= 2) {
      const opName = atom.components[0];
      const op = context.ground.lookup(opName);
      if (op && typeof op === 'function') {
        const args = atom.components.slice(1);
        yield* this._executeGroundedAsync(atom, op, args, context, context.ground.isAsync(opName));
      }
    }
  }

  *_reduceNestedSuperpose(atom, superposeAtom, path, context) {
    for (const alt of this._unpackSuperpose(superposeAtom, context)) {
      yield {
        reduced: this._replaceAtPath(atom, path, alt),
        applied: true,
        stage: 'nested-superpose',
      };
    }
  }

  _unpackSuperpose(superposeAtom, _context) {
    const alternatives = superposeAtom.components ?? [];
    if (alternatives.length === 0) {
      return [];
    }
    let alts = alternatives;
    if (alternatives.length === 1) {
      const first = alternatives[0];
      if (first.name === '()') {
        return [];
      }
      if (isExpression(first)) {
        if (first.operator?.name === ':') {
          alts = this._unpackList(first);
        } else {
          alts = [first.operator, ...(first.components ?? [])];
        }
      }
    }
    return alts;
  }

  _unpackList(term) {
    const result = [];
    let current = term;
    while (current && isExpression(current)) {
      const op = current.operator?.name ?? current.operator;
      if (op !== ':') {
        break;
      }
      if (!current.components || current.components.length < 2) {
        break;
      }
      result.push(current.components[0]);
      current = current.components[1];
    }
    return result;
  }

  _replaceAtPath(atom, path, replacement) {
    if (path.length === 0) {
      return replacement;
    }
    const newComps = [...atom.components];
    const [first, ...rest] = path;
    if (rest.length === 0) {
      newComps[first] = replacement;
    } else {
      newComps[first] = this._replaceAtPath(atom.components[first], rest, replacement);
    }
    return exp(atom.operator, newComps);
  }

  *_reduceSubExpr(atom, path, context) {
    const subExpr = path === 'operator' ? atom.operator : atom.components[path];
    for (const res of this.execute(subExpr, context)) {
      if (res.applied && !equals(res.reduced, subExpr)) {
        if (path === 'operator') {
          yield {
            reduced: exp(res.reduced, atom.components),
            applied: true,
            stage: 'subexpr-operator',
          };
        } else {
          const newComps = [...atom.components];
          newComps[path] = res.reduced;
          yield { reduced: exp(atom.operator, newComps), applied: true, stage: 'subexpr-arg' };
        }
        return;
      }
    }
  }

  async *_reduceSubExprAsync(atom, path, context) {
    const subExpr = path === 'operator' ? atom.operator : atom.components[path];
    for await (const res of this.executeAsync(subExpr, context)) {
      if (res.applied && !equals(res.reduced, subExpr)) {
        if (path === 'operator') {
          yield {
            reduced: exp(res.reduced, atom.components),
            applied: true,
            stage: 'subexpr-operator',
          };
        } else {
          const newComps = [...atom.components];
          newComps[path] = res.reduced;
          yield { reduced: exp(atom.operator, newComps), applied: true, stage: 'subexpr-arg' };
        }
        return;
      }
    }
  }

  *_executeSuperpose(alternatives, _context) {
    for (const alt of alternatives) {
      yield { reduced: alt, applied: true };
    }
  }

  _recordStageHit(stageName, duration = 0) {
    const count = this.stats.stageHits.get(stageName) ?? 0;
    const time = this.stats.stageTimes.get(stageName) ?? 0;
    this.stats.stageHits.set(stageName, count + 1);
    this.stats.stageTimes.set(stageName, time + duration);
  }

  getStats() {
    const stageStats = {};
    for (const stage of this.stages) {
      const hits = this.stats.stageHits.get(stage.name) ?? 0;
      const time = this.stats.stageTimes.get(stage.name) ?? 0;
      stageStats[stage.name] = {
        hits,
        totalTime: time,
        avgTime: hits > 0 ? time / hits : 0,
        enabled: stage.enabled,
      };
    }
    return {
      executions: this.stats.executions,
      stages: stageStats,
      stageCount: this.stages.length,
      enabledStages: this.stages.filter((s) => s.enabled).map((s) => s.name),
    };
  }

  getProfile() {
    const stats = this.getStats();
    return {
      totalExecutions: stats.executions,
      stages: Object.entries(stats.stages).map(([name, s]) => ({
        name,
        hits: s.hits,
        totalTime: s.totalTime,
        avgTime: s.avgTime,
      })),
    };
  }

  resetStats() {
    this.stats = { executions: 0, stageHits: new Map(), stageTimes: new Map() };
    return this;
  }
}

export class PipelineBuilder {
  constructor(config) {
    this.config = config;
    this.stages = [];
  }

  withCache() {
    this.stages.push(new CacheStage());
    return this;
  }

  withJIT(options = {}) {
    const threshold = options.threshold ?? this.config?.get('jitThreshold') ?? 50;
    this.stages.push(new JITStage(new JITCompiler(threshold)));
    return this;
  }

  withZipper(options = {}) {
    const threshold = options.threshold ?? this.config?.get('zipperThreshold') ?? 8;
    this.stages.push(new ZipperStage(threshold));
    return this;
  }

  withGroundedOps() {
    this.stages.push(new GroundedOpStage());
    return this;
  }

  withExplicitCalls() {
    this.stages.push(new ExplicitCallStage());
    return this;
  }

  withRuleMatching() {
    this.stages.push(new RuleMatchStage());
    return this;
  }

  withSuperpose() {
    this.stages.push(new SuperposeStage());
    return this;
  }

  withStage(stage) {
    this.stages.push(stage);
    return this;
  }

  build() {
    const pipeline = new ReductionPipeline(this.config);
    for (const stage of this.stages) {
      pipeline.use(stage);
    }
    return pipeline;
  }
}

export { CacheStage } from './stages/CacheStage.js';
export { ExplicitCallStage } from './stages/ExplicitCallStage.js';
export { GroundedOpStage } from './stages/GroundedOpStage.js';
export { JITStage } from './stages/JITStage.js';
export { OperatorReduceStage } from './stages/OperatorReduceStage.js';
export { ReductionStage } from './stages/ReductionStage.js';
export { RuleMatchStage } from './stages/RuleMatchStage.js';
export { SuperposeStage } from './stages/SuperposeStage.js';
export { ZipperStage } from './stages/ZipperStage.js';
