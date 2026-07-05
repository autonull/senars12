/**
 * Diagnostic test suite for MeTTa PeTTa parity debugging.
 * Tests key intermediate functionality in isolation.
 * 
 * Usage: NODE_NO_WARNINGS=1 NODE_OPTIONS=--experimental-vm-modules node metta/test-diagnostics.js
 */

import {createMeTTa} from './src/MeTTa.js';
import {Term} from './src/kernel/Term.js';
import {Unify} from './src/kernel/Unify.js';

const {sym, exp, isList, isExpression} = Term;

let passed = 0, failed = 0;

function assertEq(actual, expected, label) {
    const a = actual?.toString?.() ?? actual;
    const e = expected?.toString?.() ?? expected;
    if (a === e) {
        passed++;
        console.log(`  ✓ ${label}`);
    } else {
        failed++;
        console.log(`  ✗ ${label}`);
        console.log(`    expected: ${e}`);
        console.log(`    actual:   ${a}`);
    }
}

function assertTrue(cond, label) {
    if (cond) { passed++; console.log(`  ✓ ${label}`); }
    else { failed++; console.log(`  ✗ ${label}`); }
}

// ── D1: Unification: cons vs expression-form ──────────────────────────────
console.log('\n[D1] Unify: cons-list vs expression-form');
{
    // cons pattern vs expression list
    const pat = exp(sym(':'), [sym('$h'), sym('$t')]);
    const val = exp(sym('a'), [sym('b'), sym('c'), sym('d')]);
    const b1 = Unify.unify(pat, val);
    assertEq(b1?.['$h']?.name, 'a', '(: $h $t) vs (a b c d) → $h = a');
    assertEq(b1?.['$t']?.toString?.(), '(: b (: c (: d ())))', '  → $t bound to remainder cons');

    // (cons h t) vs expression
    const pat2 = exp(sym('cons'), [sym('$h'), sym('$t')]);
    const b2 = Unify.unify(pat2, val);
    assertEq(b2?.['$h']?.name, 'a', '(cons $h $t) vs (a b c d) → $h = a');
}

// ── D2: Nested cons pattern matching ──────────────────────────────────────
console.log('\n[D2] Nested cons patterns');
{
    // (cons $a (cons $b $L)) should match (a b c d)
    const pat = exp(sym(':'), [sym('$a'), exp(sym(':'), [sym('$b'), sym('$L')])]);
    const val = exp(sym('a'), [sym('b'), sym('c'), sym('d')]);
    const b = Unify.unify(pat, val);
    assertTrue(b !== null && b !== undefined, 'Nested cons matches expression-form');
    if (b) {
        assertEq(b['$a']?.name, 'a', '  $a = a');
        assertEq(b['$b']?.name, 'b', '  $b = b');
    }
}

// ── D3: &let with expression-form variable ────────────────────────────────
console.log('\n[D5] &let with expression-form variable ($x)');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync('(let $x 3 (+ $x 1))');
    const vals = results.filter(r => !r.toString().startsWith('=')).map(r => r.toString());
    assertEq(vals[0], '4', '  (let $x 3 (+ $x 1)) → 4');
}

// ── D6: &case with expression-form branches ───────────────────────────────
console.log('\n[D6] &case with expression-form branches');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync('(case wat (($stmt (superpose (what what2)))))');
    const vals = results.filter(r => !r.toString().startsWith('=') && !r.toString().startsWith('case')).map(r => r.toString());
    console.log(`  Results: ${vals.join(', ')}`);
}

// ── D7: superpose + collapse round-trip ───────────────────────────────────
console.log('\n[D7] superpose + collapse');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync('(collapse (superpose (a b c)))');
    const vals = results.filter(r => !r.toString().startsWith('=')).map(r => r.toString());
    console.log(`  collapse (superpose (a b c)) → ${vals.join(', ')}`);
    assertTrue(vals.some(v => v.includes('a') && v.includes('b') && v.includes('c')),
        '  collapse collects superpose results');
}

// ── D8: case + superpose + collapse ───────────────────────────────────────
console.log('\n[D8] case with superpose inside collapse');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync('(= (compile $stmt) (case $stmt (($stmt (superpose (what what2)))))\n(collapse (compile wat))');
    const vals = results.filter(r => !r.toString().startsWith('=')).map(r => r.toString());
    console.log(`  Results: ${vals.join(', ')}`);
}

// ── D9: curried function application ((f 1) 2) ────────────────────────────
console.log('\n[D9] Curried partial application');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync('(= (f $a $b) (+ $a $b))\n((f 1) 2)');
    const vals = results.filter(r => !r.toString().startsWith('=')).map(r => r.toString());
    assertEq(vals[0], '3', '  ((f 1) 2) → 3');
}

// ── D10: map-atom with curried (+ 1) ─────────────────────────────────────
console.log('\n[D10] map-atom with curried op');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync('(= (f $a $b) (+ $a $b))\n(map-atom (1 2 3) (+ 1))');
    const vals = results.filter(r => !r.toString().startsWith('=')).map(r => r.toString());
    console.log(`  map-atom (1 2 3) (+ 1) → ${vals.join(', ')}`);
    assertTrue(vals.some(v => v.includes('2') && v.includes('3') && v.includes('4')),
        '  produces (2 3 4)');
}

// ── D11: HOF applyFn uses sync reduce ────────────────────────────────────
console.log('\n[D11] HOF applyFn: ((+ 1) 2) via sync reduce');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync('(= (f $a $b) (+ $a $b))\n(map-atom (1 2 3) (f 1))');
    const vals = results.filter(r => !r.toString().startsWith('=')).map(r => r.toString());
    console.log(`  map-atom (1 2 3) (f 1) → ${vals.join(', ')}`);
}

// ── D12: append with lists ───────────────────────────────────────────────
console.log('\n[D12] append with single-element list');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync('(= (h $A $B) (append ($A) $B))\n((h 42) (1 2 3))');
    const vals = results.filter(r => !r.toString().startsWith('=')).map(r => r.toString());
    console.log(`  ((h 42) (1 2 3)) → ${vals.join(', ')}`);
}

// ── D13: cut returns () ──────────────────────────────────────────────────
console.log('\n[D13] cut behavior');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync('(cut)');
    const vals = results.filter(r => !r.toString().startsWith('=')).map(r => r.toString());
    console.log(`  (cut) → ${vals.join(', ')}`);
}

// ── D14: if with superpose (non-deterministic condition) ─────────────────
console.log('\n[D14] if with superpose condition');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync('(= (if-nondet $y) (if (superpose $y) a b))\n(collapse (if-nondet (True False True)))');
    const vals = results.filter(r => !r.toString().startsWith('=')).map(r => r.toString());
    console.log(`  collapse (if-nondet (True False True)) → ${vals.join(', ')}`);
}

// ── D15: match + let* + cut (cut.metta pattern) ─────────────────────────
console.log('\n[D15] match + let* + cut');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync(`
(foo 1)
(foo 2)
(= (match-single $space $pat $ret)
   (let* (($x (match $space $pat $ret))
          ($temp (cut)))
         $x))
!(let $x (match-single &self (foo $1) $1) (add-atom &self (bar $x)))
(collapse (match &self (bar $1) (bar $1)))
`);
    const vals = results.filter(r => !r.toString().startsWith('=') && !r.toString().startsWith('ok') && !r.toString().startsWith('match-single') && !r.toString().startsWith('let')).map(r => r.toString());
    console.log(`  collapse (match &self (bar $1) (bar $1)) → ${vals.join(', ')}`);
}

// ── D16: lambda with list params ($x $y) ─────────────────────────────────
console.log('\n[D16] Lambda with list params');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync('(apply (lambda ($x $y) (+ $x $y)) (2 7))');
    const vals = results.filter(r => !r.toString().startsWith('=') && !r.toString().startsWith('apply') && !r.toString().startsWith('lambda')).map(r => r.toString());
    console.log(`  apply (lambda ($x $y) (+ $x $y)) (2 7) → ${vals.join(', ')}`);
}

// ── D17: foldall ─────────────────────────────────────────────────────────
console.log('\n[D17] foldall');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync(`
(= (f) 2)
(= (f) 3)
(foldall (|-> ($x $y) (+ $x $y)) (f) 0)
`);
    const vals = results.filter(r => !r.toString().startsWith('=')).map(r => r.toString());
    console.log(`  foldall (+ $x $y) (f) 0 → ${vals.join(', ')}`);
}

// ── D18: forall ──────────────────────────────────────────────────────────
console.log('\n[D18] forall');
{
    const m = createMeTTa({loadStdlib: false});
    const results = await m.runAsync(`
(= (f) 1)
(= (f) 2)
(= (P $X) (< $X 2))
(forall (f) P)
`);
    const vals = results.filter(r => !r.toString().startsWith('=')).map(r => r.toString());
    console.log(`  forall (f) P → ${vals.join(', ')}`);
}

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════`);
console.log(`DIAGNOSTIC SUMMARY: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════\n`);
