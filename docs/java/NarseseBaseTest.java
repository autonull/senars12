package nars.io;

import nars.*;
import nars.term.Compound;
import nars.term.atom.Atomic;
import nars.term.util.Testing;
import nars.term.var.Variable;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.util.List;

import static nars.$.$$;
import static nars.Op.PROD;
import static nars.term.atom.Bool.Null;
import static org.junit.jupiter.api.Assertions.*;

//import nars.term.var.ellipsis.Fragment;

class NarseseBaseTest extends NarseseTest {

	private static void OperationStructure( Compound t) {

		Term[] aa = ((Compound) t.sub(0)).arrayClone();
		assertEquals(2, aa.length);
		assertEquals("believe", t.sub(1).toString());

		assertEquals("a", aa[0].toString());
		assertEquals("b", aa[1].toString());
	}

	private static Variable testVar(char prefix) throws Narsese.NarseseException {
		Term x = term(prefix + "x");
		assertNotNull(x);
        assertInstanceOf(Variable.class, x);
		assertEquals(prefix + "x", x.toString());
		return (Variable)x;
	}

	@Test
	void ParseCompleteEternalTask() throws Narsese.NarseseException {
        NALTask t = task("$0.99 (a --> b)! %0.93;0.95%");
		assertNotNull(t);
		assertEquals('!', t.punc());
		assertEquals(0.99f, t.pri(), 0.001);
		assertEquals(0.93f, t.freq(), 0.001);
		assertEquals(0.95f, (float) t.conf(), 0.001);
	}

	@Test
	void TaskTruthParsing() throws Narsese.NarseseException {
		{
            NALTask u = task("(y,())! %0.50;0.50%");
			assertEquals(0.5f, u.freq(), 0.001f);
			assertEquals(0.5f, (float) u.conf(), 0.001f);
		}
		{
            NALTask u = task("(y,())! %0.5;0.5%");
			assertEquals(0.5f, u.freq(), 0.001f);
			assertEquals(0.5f, (float) u.conf(), 0.001f);
		}
	}

	@Test
	void TaskTruthParsing2() throws Narsese.NarseseException {
		NALTask u = task("(y,())! %0.55%");
		assertEquals(0.55f, u.freq(), 0.001f);
		assertEquals(0.9f, (float) u.conf(), 0.001f);
	}

	@Test
	void Truth() throws Narsese.NarseseException {
		testTruth("%1.0;0.90%", 1f, 0.9f);
		testTruth("%1;0.9%", 1f, 0.9f);
		testTruth("%1.00;0.90%", 1f, 0.9f);
		testTruth("%1;0.90%", 1f, 0.9f);
		testTruth("%1;.9%", 1f, 0.9f);
		testTruth("%0;0.90%", 0f, 0.9f);
	}

	@Test
	void IncompleteTask() throws Narsese.NarseseException {
        NALTask t = task("(a --> b).");
		assertNotNull(t);
		assertEquals(Op.INH, t.op());
		Term i = t.term();
		assertEquals("a", i.sub(0).toString());
		assertEquals("b", i.sub(1).toString());
		assertEquals('.', t.punc());


		assertEquals(1.0f, t.truth().freq(), 0.001);

	}

	@Test
	void PropertyInstance1() throws Narsese.NarseseException {
		taskParses("(a -{- b).");
	}

	@Test
	void PropertyInstance2() throws Narsese.NarseseException {
		taskParses("(a -]- b).");
		assertEquals("(a-->[b])", $.$("(a -]- b)").toString());
	}

	@Test
	void PropertyInstance3() throws Narsese.NarseseException {
		taskParses("(a {-] b).");
		assertEquals("({a}-->[b])", $.$("(a {-] b)").toString());
	}

	@Test
	void Budget() throws Narsese.NarseseException {
		Task t = task("$0.70 <a ==> b>. %0.00;0.93");
		assertEquals(0.7f, t.pri(), 0.01f);

		Task u = task("$0.9 <a ==> b>. %0.00;0.93");
		assertEquals(0.9f, u.pri(), 0.01f);
	}

	@Test
	void NoBudget() throws Narsese.NarseseException {
        NALTask t = task("<a ==> b>. %0.00;0.93");
		assertNotNull(t);
		assertEquals(Op.IMPL, t.op());

		assertEquals('.', t.punc());


		assertEquals(0.0f, t.freq(), 0.001);
		assertEquals(0.93f, (float) t.conf(), 0.001);
	}

	@Test
	void MultiCompound() throws Narsese.NarseseException {
		String tt = "((a==>b)-->(c==>d))";
        NALTask t = task(tt + '?');
		assertNotNull(t);
		assertEquals(Op.INH, t.op());
		assertEquals(tt, t.term().toString());
		assertEquals('?', t.punc());
		assertNull(t.truth());
		assertEquals(7, t.term().complexityConstants());
	}

	@Test
	void FailureOfMultipleDistinctInfixOperators() {
		Testing.assertInvalids("(a * b & c)");
	}

	@Test
	void Quest() throws Narsese.NarseseException {
		String tt = "(a,b,c)";
        NALTask t = task(tt + '@');
		assertNotNull(t);
		assertEquals(PROD, t.op());
		assertEquals(tt, t.term().toString());
		assertEquals('@', t.punc());
		assertNull(t.truth());

	}

	@Test
	void Statement1() throws Narsese.NarseseException {
		String s = "(a-->b)";
		assertEquals(s, term(s).toString());
	}

	@Test
	void Statement2() throws Narsese.NarseseException {
		assertNotNull(term("< a --> b >"));
	}

	@Test
	void Product() throws Narsese.NarseseException {

		Compound pt = term("(a, b, c)");

		assertNotNull(pt);
		assertEquals(PROD, pt.op());

		testProductABC(pt);

		testProductABC(term("(*,a,b,c)"));
		testProductABC(term("(a,b,c)"));
		testProductABC(term("(a, b, c)"));
		testProductABC(term("(a , b, c)"));
		testProductABC(term("(a , b , c)"));
		testProductABC(term("(a ,\tb, c)"));


	}

	@Test
	void Disjunction() throws Narsese.NarseseException {
		assertEquals("(a||b)", $.$("(||,a,b)").toString());
		assertEquals("(||,a,b,c)", $.$("(||,a,b,c)").toString());
		assertEquals("((b&&c)||a)", $.$("(||,a,(b&&c))").toString());
		assertEquals("a", $.$("(||,a)").toString());
	}

	@Test
	void DisjunctionBinary() throws Narsese.NarseseException {
		assertEquals("(a||b)", $.$("(a||b)").toString());
		assertEquals("(a||b)", $.$("(a || b)").toString());
	}

//    @Test void Inifix3() throws Narsese.NarseseException {
//        assertEquals("((a-b)|(--,x))", term("((a-b)|(--,x))").toString());
//        assertEquals("((_2-_1)|(--,_3))", term("((_2-_1)|(--,_3))").toString());
//    }

	@Test
	void DisjunctionXternal() throws Narsese.NarseseException {
		assertEquals("(a ||+- b)", $.$("--(--a &&+- --b)").toString());
	}
	@Test
	void DisjunctionXternal2() throws Narsese.NarseseException {
		assertEquals("(a ||+- b)", $.$("(a ||+- b)").toString());
	}

	@Test
	void Infix2() throws Narsese.NarseseException {
		Compound t = term("(x & y)");
		assertEquals(Op.CONJ, t.op());
		assertEquals(2, t.subs());
		assertEquals("x", t.sub(0).toString());
		assertEquals("y", t.sub(1).toString());

//        Compound a = term("(x | y)");
//        assertEquals(Op.CONJ, a.op());
//        assertEquals(2, a.subs());

		Compound b = term("(x * y)");
		assertEquals(PROD, b.op());
		assertEquals(2, b.subs());

		Compound c = term("(<a -->b> && y)");
		assertEquals(Op.CONJ, c.op());
		assertEquals(2, c.subs());
		assertEquals(5, c.complexityConstants());
		assertEquals(Op.INH, c.sub(0).op());
	}

	@Test
	void ShortFloat() throws Narsese.NarseseException {

		taskParses("<{a} --> [b]>. %0;0.9%");
		taskParses("<a --> b>. %0.95;0.9%");
		taskParses("<a --> b>. %0.9;0.9%");
		taskParses("<a --> b>. %1;0.9%");
		taskParses("<a --> b>. %1.0;0.9%");
	}

	@Test
	void Negation() throws Narsese.NarseseException {
		taskParses("(--,(negated)).");
		taskParses("(--, (negated)).");

		assertEquals("(--,(negated))", term("(--, (negated))").toString());

	}

	@Test
	void OperationNoArgs() throws Narsese.NarseseException {
		Term t = term("op()");
		assertNotNull(t);
		assertEquals(Op.INH, t.op(), t::toString);


		taskParses("op()!");
		taskParses("op( )!");
	}

	@Test
	void Operation2() throws Narsese.NarseseException {
		OperationStructure(term("believe(a,b)"));
		OperationStructure(term("believe(a, b)"));
	}
	@Test
	void ImplInsideProd() {
		assertEquals("x((b ==>+- a))", $$("x((b ==>+- a))").toString());
		assertEquals("x((b==>a))", $$("x((b==>a))").toString());
		assertEquals("(x-->(b==>a))", $$("(x-->(b==>a))").toString());
		assertEquals(Null.toString(), $$("(x-->(x==>a))").toString());
		//assertEquals(Null, "(x-->(b==>a))");
	}

	@Test
	void ImplIsNotOperation() throws Narsese.NarseseException {
		assertEquals("((b)==>a)", $.impl($.$("(b)"), Atomic.atomic("a")).toString());
		assertEquals("((b) ==>+1 a)", $.impl($.$("(b)"), 1, Atomic.atomic("a")).toString());
	}

	@Test
	void OperationEquivalence() throws Narsese.NarseseException {
		Term a = term("a(b,c)");
		Term b = term("((b,c) --> a)");
		assertEquals(a.op(), b.op());
		assertSame(a.getClass(), b.getClass());
		assertEquals(a, b);
	}

	@Test
	void OperationEquivalenceWithOper() throws Narsese.NarseseException {
		Term a = term("a(b,c)");
		Compound b = term("((b,c) --> a)");

		assertEquals(a, b);

		assertEquals(a.op(), b.op());
		assertSame(a.getClass(), b.getClass());

		assertEquals(Op.ATOM, b.sub(1).op());

	}

	@Test
	void OperationTask() throws Narsese.NarseseException {
		taskParses("break({t001},SELF)! %1.00;0.95%");
	}

	@Test
	void CompoundTermOpenerCloserStatements() throws Narsese.NarseseException {
		Term a = term("<a --> b>");
		Term x = term("(a --> b)");
		Term y = term("(a-->b)");
		assertEquals(Op.INH, x.op());
		assertEquals(x, a);
		assertEquals(x, y);

		assertNotNull(term("((a,b)-->c)"));
		assertNotNull(term("((a,b) --> c)"));
		assertNotNull(term("<(a,b) --> c>"));
		assertNotNull(term("<a --> (c,d)>"));
		assertNotNull(term("<a-->(c,d)>"));
		assertNotNull(term("(a-->(c,d))"));
		assertNotNull(term("(a --> (c,d))"));

		Term abcd = term("((a,b) --> (c,d))");
		Term ABCD = term("<(*,a,b) --> (*,c,d)>");
		assertEquals(Op.INH, x.op());
		assertEquals(abcd, ABCD, () -> abcd + " != " + ABCD);
	}

	@Disabled
	@Test
	void QuotedVar() throws Narsese.NarseseException {
		assertEquals("$\"x\"", $.$("$\"x\"").toString());
	}

	@Test
	void Variables_DEP() throws Narsese.NarseseException {
		Variable v = testVar(Op.VAR_DEP.ch);
		assertTrue(v.hasVarDep());
	}
	@Test
	void Variables_INDEP() throws Narsese.NarseseException {
		Variable v = testVar(Op.VAR_INDEP.ch);
		assertTrue(v.hasVarIndep());
	}
	@Test
	void Variables_QUERY() throws Narsese.NarseseException {
		Variable v = testVar(Op.VAR_QUERY.ch);
		assertTrue(v.hasVarQuery());
	}
	@Test
	void Variables_PATTERN() throws Narsese.NarseseException {
		Variable v = testVar(Op.VAR_PATTERN.ch);
		assertTrue(v.hasVarPattern());
		assertEquals(1, v.varPattern());
		assertFalse(v.hasVarQuery());
	}

	@Test
	void QueryVariableTask() throws Narsese.NarseseException {
		String term = "hear(Time,(the,?x))";
		assertEquals("hear(Time,(the,?x))", term(term).toString());
		assertEquals("hear(Time,(the,?1))?", task(term + '?').toStringWithoutBudget());
	}

	@Test
	void QueryVariableTaskQuotes() throws Narsese.NarseseException {
		String term = "hear(\"Time\",(\"the\",?x))";
		assertEquals("hear(\"Time\",(\"the\",?x))", term(term).toString());
		assertEquals("hear(\"Time\",(\"the\",?1))?", task(term + '?').toStringWithoutBudget());
	}

	@Test
	void Set() throws Narsese.NarseseException {
		Compound xInt = term("[x]");
		assertEquals(Op.SETi, xInt.op());
		assertEquals(1, xInt.subs());
		assertEquals("x", xInt.sub(0).toString());

		Compound xExt = term("{x}");
		assertEquals(Op.SETe, xExt.op());
		assertEquals(1, xExt.subs());
		assertEquals("x", xExt.sub(0).toString());

		Compound abInt = term("[a,b]");
		assertEquals(2, abInt.subs());
		assertEquals("a", abInt.sub(0).toString());
		assertEquals("b", abInt.sub(1).toString());

		assertEquals(abInt, term("[ a,b]"));
		assertEquals(abInt, term("[a,b ]"));
		assertEquals(abInt, term("[ a , b ]"));


	}


	@Test
	void QuoteEscape() throws Narsese.NarseseException {
		assertEquals("\"ab c\"", term("\"ab c\"").toString());
		for (String x : new String[]{"a", "a b"}) {
			taskParses("<a --> \"" + x + "\">.");
			assertTrue(task("<a --> \"" + x + "\">.").toString().contains("(a-->\"" + x + "\")."));
		}
	}

	@Test
	void QuoteEscapeBackslash() {


	}

	@Test
	void FuzzyKeywords() {


	}

	@Test
	void EmbeddedJavascript() {

	}

	@Test
	void EmbeddedPrologRules() {

	}

	/**
	 * test ability to report meaningful parsing errors
	 */
	@Test
	void Error() {

	}

	@Test
	void SimpleTask() throws Narsese.NarseseException {
		taskParses("x:(*,mammal,swimmer). %0.00;0.90%");

	}

	@Test
	void CompleteTask() throws Narsese.NarseseException {
		taskParses("$0.80 <<lock1 --> (open,$1)> ==> <$1 --> key>>. %1.00;0.90%");
	}

	@Test
	void NonNegativeIntegerAtoms() throws Narsese.NarseseException {

		Term a = term("1");
		assertEquals("1", a.toString());
	}

	@Test
	void NegativeIntegerAtoms() throws Narsese.NarseseException {

		Term a = term("-1");
		assertNotNull(a);
		assertEquals("-1", a.toString());
	}

	@Test
	void FloatAtom() throws Narsese.NarseseException {

		float f = 1.24f;
		String ff = Float.toString(f);
		Term a = term(ff);
		assertNotNull(a);
		assertEquals(//'"' + ff + '"'
			"div(31,25)"
			, a.toString());
	}

	@Test
	void Multiline() throws Narsese.NarseseException {
		String a = "<a --> b>.";
		assertEquals(1, tasks(a).size());

		String b = "<a --> b>. <b --> c>.";
		assertEquals(2, tasks(b).size());

		String c = "<a --> b>. \n <b --> c>.";
		assertEquals(2, tasks(c).size());

		String s = """
                <a --> b>.
                <b --> c>.
                <multi
                 -->\s
                line>. :|:
                <multi\s
                 -->\s
                line>.
                <x --> b>!
                <y --> w>.  <z --> x>.
                """;

		List<Task> t = tasks(s);
		assertEquals(7, t.size());

	}

	@Test
	void MultilineQuotes() throws Narsese.NarseseException {

		String a = "js(\"\"\"\n" + "1\n" + "\"\"\")";
		//System.out.println(a + ' ' + $.$(a));
		assertEquals(a, $.$(a).toString());
		List<Task> l = tasks(a + '!');
		assertEquals(1, l.size());
	}


	@Test
	void EmptySets() {
		Testing.assertInvalids("{}", "[]");
	}


	@Test
	void EmptyProduct() throws Narsese.NarseseException {
		Term e = term("()");
		assertSame(Op.EmptyProduct, e);
		assertEquals(PROD, e.op());
		assertEquals(0, e.subs());
		assertEquals(term("()"), term("( )"));
		assertEquals(term("()"), term(" (   )"));
	}

}