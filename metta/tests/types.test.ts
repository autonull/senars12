import { describe, expect, it } from 'vitest';
import { num, sym } from '../src/types/ast.js';
import { applyTypeSubst, type Type, TypeChecker, unifyTypes } from '../src/types/inference.js';
import { TypeKind } from '../src/types/type.js';

const typevar = (id: number): Type => ({ kind: TypeKind.Var, id });
const typecon = (name: string): Type => ({ kind: TypeKind.Con, name });
const typefun = (from: Type, to: Type): Type => ({ kind: TypeKind.Fun, from, to });

describe('Type System', () => {
  describe('Type constructors', () => {
    it('creates type variables', () => {
      const tv = typevar(0);
      expect(tv.kind).toBe(TypeKind.Var);
      expect(tv.id).toBe(0);
    });

    it('creates type constructors', () => {
      const tc = typecon('Number');
      expect(tc.kind).toBe(TypeKind.Con);
      expect(tc.name).toBe('Number');
    });

    it('creates function types', () => {
      const tf = typefun(typevar(0), typecon('Number'));
      expect(tf.kind).toBe(TypeKind.Fun);
      expect(tf.from.id).toBe(0);
    });
  });

  describe('applyTypeSubst', () => {
    it('applies substitution to type variables', () => {
      const s = new Map([[0, typecon('Number')]]);
      const result = applyTypeSubst(typevar(0), s);
      expect(result.kind).toBe(TypeKind.Con);
      expect(result.name).toBe('Number');
    });

    it('returns unchanged type for missing substitution', () => {
      const result = applyTypeSubst(typevar(1), new Map());
      expect(result.id).toBe(1);
    });
  });

  describe('unifyTypes', () => {
    it('unifies identical type variables', () => {
      const result = unifyTypes(typevar(0), typevar(0), new Map());
      expect(result).toBeInstanceOf(Map);
    });

    it('unifies type variable with constructor', () => {
      const result = unifyTypes(typevar(0), typecon('Number'), new Map());
      expect(result?.get(0)?.kind).toBe(TypeKind.Con);
    });

    it('returns null for different type constructors', () => {
      const result = unifyTypes(typecon('Number'), typecon('String'), new Map());
      expect(result).toBeNull();
    });

    it('unifies identical type constructors', () => {
      const result = unifyTypes(typecon('Number'), typecon('Number'), new Map());
      expect(result).toBeInstanceOf(Map);
    });
  });

  describe('TypeChecker', () => {
    it('infers type for number literal', () => {
      const checker = new TypeChecker();
      const result = checker.infer(num(42));
      expect(result).not.toBeNull();
      expect(result?.type.kind).toBe(TypeKind.Con);
    });

    it('infers type for symbol', () => {
      const checker = new TypeChecker();
      checker.addBinding('x', { vars: [], type: typecon('Number') });
      const result = checker.infer(sym('x'));
      expect(result).not.toBeNull();
    });
  });
});
