package nars.io;

import nars.*;
import nars.term.Compound;
import nars.time.Tense;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import static nars.$.$$;
import static nars.$.$$$;
import static nars.Op.ETERNAL;
import static nars.term.atom.Bool.*;
import static nars.term.util.Testing.assertEq;
import static nars.time.Tense.Present;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Proposed syntax extensions, not implemented yet
 */
class NarseseExtendedTest extends NarseseTest {


    @Test
    void testRuleComonent0() throws Narsese.NarseseException {
        assertNotNull($.$("((P ==> S), (S ==> P))"));
        assertNotNull($.$("((P ==> S), (S ==> P), neqCom(S,P), time(dtCombine))"));
    }

    @Test
    void testRuleComonent1() throws Narsese.NarseseException {
        String s = "((P ==> S), (S ==> P), neqCom(S,P), time(dtCombine), notImpl(P), notEqui(S), task(\"?\"))";
        assertNotNull($.$(s));
    }

    @Test void Boolean() {
        assertSame(True, $$("true"));
        assertSame(False, $$("false"));
        assertSame(Null, $$("null"));
    }

    private static void eternal(NALTask t) {
        assertNotNull(t);
        tensed(t, true, Tense.Eternal);
    }
    private static void tensed(NALTask t, Tense w) {
        tensed(t, false, w);
    }
    private static void tensed(NALTask t, boolean eternal, Tense w) {
        assertEquals(eternal, t.start() == ETERNAL);
        if (!eternal) {
            switch (w) {
                case Past -> assertTrue(t.start() < 0);
                case Future -> assertTrue(t.start() > 0);
                case Present -> assertEquals(0, t.start());
                case Eternal -> assertEquals(ETERNAL, t.start());
            }
        }
    }

    @Test
    void testOriginalTruth() throws Narsese.NarseseException {
        
        eternal(task("(a && b). %1.0;0.9%"));

        
        tensed(task("(a && b). :|: %1.0;0.9%"), Present);
        tensed(task("(a && b). | %1.0;0.9%"), Present);
    }



    /** compact representation combining truth and tense */
    @Test
    void testTruthTense() throws Narsese.NarseseException {






        eternal(task("(a && b). %1.0;0.7%"));

        /*tensed(task("(a & b). %1.0|"), Present);
        tensed(task("(a & b). %1.0/"), Future);
        tensed(task("(a & b). %1.0\\"), Past);*/
        eternal(task("(a && b). %1.0;0.9%"));


    }

    @Test
    void testQuestionTenseOneCharacter() {
        
    }

    @Test
    void testColonReverseInheritance() throws Narsese.NarseseException {
        Compound t = term("namespace:named");
        assertEquals(Op.INH, t.op());
        assertEquals("named", t.sub(0).toString());
        assertEquals("namespace", t.sub(1).toString());


        Compound u = term("<a:b --> c:d>");
        assertEquals("((b-->a)-->(d-->c))", u.toString());

        Task ut = task("<a:b --> c:d>.");
        assertNotNull(ut);
        assertEquals(ut.term(), u);
    }
    @Test
    void testColonReverseInheritance_from_vars() {
        assertEq("(abc-->#1)","#x:abc");
        assertEq("(#1-->abc)","abc:#x");
    }









    private static void eqTerm(String shorter, String expected) {
        Narsese p = Narsese.the();


        try {
            Term a = Narsese.term(shorter);
            assertNotNull(a);
            assertEquals(expected, a.toString());

            eqTask(shorter, expected);
        } catch (Narsese.NarseseException e) {
            fail(e);
        }
    }


    private static void eqTask(String x, String b) throws Narsese.NarseseException {
        Task a = Narsese.task(x + '.', new DummyNAL());
        assertNotNull(a);
        assertEquals(b, a.term().toString());
    }

    @Test
    void testNamespaceTerms2() {
        eqTerm("a:b", "(b-->a)");
        eqTerm("a : b", "(b-->a)");
    }

    @Test
    void testNamespaceTermsNonAtomicSubject() {
        eqTerm("c:{a,b}", "({a,b}-->c)");
    }

    @Disabled  @Test
    void testNamespaceTermsNonAtomicPredicate() {
        eqTerm("<a-->b>:c", "(c-->(a-->b))");
        eqTerm("{a,b}:c", "(c-->{a,b})");
        eqTerm("(a,b):c", "(c-->(a,b))");
    }

    @Disabled @Test
    void testNamespaceTermsChain() {

        eqTerm("d:{a,b}:c", "((c-->{a,b})-->d)");


        eqTerm("c:{a,b}", "({a,b}-->c)");
        eqTerm("a:b:c",   "((c-->b)-->a)");
        eqTerm("a :b :c",   "((c-->b)-->a)");
    }

    @Test
    void testNamespaceLikeJSON() throws Narsese.NarseseException {
        Narsese p = Narsese.the();
        Term a = Narsese.term("{ a:x, b:{x,y} }");
        assertNotNull(a);
        assertEquals(Narsese.term("{<{x,y}-->b>, <x-->a>}"), a);

    }

    @Test
    void testNegation2() throws Narsese.NarseseException {


        for (String s : new String[]{"--(negated-->a)!", "-- (negated-->a)!"}) {
            Task t = task(s);

            
            /*
            (--,(negated))! %1.00;0.90% {?: 1}
            (--,(negated))! %1.00;0.90% {?: 2}
            */

            Term tt = t.term();
            assertEquals(Op.INH, tt.op());
            assertEquals("(negated-->a)", tt.toString());
            assertEquals(Op.GOAL, t.punc());
        }
    }

    @Test
    void testNegationShortHandOnAtomics() throws Narsese.NarseseException {
        assertEquals("(--,x)", term("--x").toString());
        assertEquals("(--,wtf)", term("--wtf").toString());
        assertEquals("(--,1)", term("--1").toString());

        assertEquals("(--,(before-->x))", term("--x:before").toString());
    }

    @Test
    void testNegationShortHandOnVars() throws Narsese.NarseseException {
        for (char n : new char[] { '1', 'x' } )
            for (char t : new char[] { '%', '$', '#', '?' } ) {
                assertEquals("(--," + t + n + ')', term("--" + t + n).toString());
                assertEquals("(a,(--," + t + n + "))", term("(a, --" + t + n + ')').toString());
            }

    }

    @Test
    void testNegationShortHandOnFunc() throws Narsese.NarseseException {
        assertEquals("(--,sentence(x))", term("--sentence(x)").toString());
    }

    @Test
    void testNegationShortHandAsSubterms() throws Narsese.NarseseException {
        assertEquals("(--,a)", term("--a").toString());
        assertEquals("((--,a))", term("(--a)").toString());
        assertEquals("((--,a),a,c)", term("( --a , a, c)").toString());
        assertEquals("((--,a),a,c)", term("(--a, a, c)").toString());
        assertEquals("(a,(--,a),c)", term("(a, --a, c)").toString());
        assertEquals("((--,a),(--,(a)),a,c)", term("(--a, --(a), a, c)").toString());
    }

    @Test
    void testNegation3() throws Narsese.NarseseException {



        assertEquals( "(--,(x))", term("--(x)").toString() );
        assertEquals( "(--,(x))", term("-- (x)").toString() );

        assertEquals( "(--,(x&&y))", term("-- (x && y)").toString() );

        assertEquals( term("(goto(z) ==>+5 --(x))"),
                term("(goto(z) ==>+5 (--,(x)))")
        );

        assertEquals( term("(goto(z) ==>+5 --x:y)"),
                      term("(goto(z) ==>+5 (--,x:y))")
        );

        Compound nab = term("--(a & b)");
        assertSame(Op.NEG, nab.op());

        assertSame(Op.CONJ, nab.sub(0).op());







    }

    /** tests correct order of operations */
    @Test
    void testNegationOfShorthandInh() throws Narsese.NarseseException {
        assertEquals(
                
                "(--,(b-->a))",
                term("--a:b").toString() );
        assertEquals(
                //"((--,b)-->a)",
                "(--,(b-->a))",
                term("a:--b").toString() );
        assertEquals(
                
                //"(--,((--,b)-->a))",
                "(b-->a)",
                term("--a:--b").toString() );
    }

    @Disabled
    @Test
    void testOptionalCommas() throws Narsese.NarseseException {
        Term pABC1 = $.$("(a b c)");
        Term pABC2 = $.$("(a,b,c)");
        assertEquals(pABC1, pABC2);

        Term pABC11 = $.$("(a      b c)");
        assertEquals(pABC1, pABC11);
    }


    @Test
    void testQuoteEscaping() {
        assertEquals("\"it said: \\\"wtf\\\"\"",
                $.quote("it said: \"wtf\"").toString());
    }

    @Test
    void testTripleQuote() {
        assertParse("(\"\"\"triplequoted\"\"\")");
        assertParse("(\"\"\"triple\"quoted\"\"\")");
    }

    @Test
    void testParallelTemporals() throws Narsese.NarseseException {
        assertEquals("(a==>b)", term("(a =|> b)").toString());
    }

    @Test
    void conjSeq1() {
        assertParse("(x &&+2 y)");
    }

    @Test void conjSeq2() {
        assertParse("(a &&+5 b)");
        assertParse("(a &&+5 (b&&c))");
        assertEq("(a &&+5 (b&&c))", "(a &&+5 (b&|c))");
        assertEq("(a &&+5 ((--,b)&&c))", "(a &&+5 ((--,b)&|c))");
    }
    @Test void conjSeq2b() {
        assertEq("(_1 &&+5 ((--,_1)&&_2))", "(_1 &&+5 ((--,_1)&|_2))");
    }


    @Test
    void testParallelConjInfix() throws Narsese.NarseseException {
        assertEquals("(a&&b)", term("(a &| b)").toString());
        assertEquals("(x &&+2 ((a)&&(b)))", term("(x &&+2 ((a) &| (b)))").toString());
        assertEquals("(x &&+2 (&&,(a),(b),(c)))", term("(x &&+2 ( ((a) &| (b)) &| (c)))").toString());
    }
    @Test
    void testParallelConjPrefix() throws Narsese.NarseseException {
        assertEquals("(&&,a,b,c)", term("(&|, a, b, c)").toString());
        assertEquals("(&&,(a),(b),(c))", term("(&|, (a), (b), (c))").toString());
        assertEquals("(&&,(a),(b),(c))", term("(&|,(a), (b), (c))").toString());
        assertEquals("(x &&+2 (&&,(a),(b),(c)))", term("(x &&+2 (&|,(a), (b), (c)))").toString());
    }
 
    private static void assertParse(String s)  {
        try {
            assertEquals(s, term(s).toString());
        } catch (Narsese.NarseseException e) {
            fail(()->"invalid parse: " + s + "\n" + e);
        }
    }

    @Test
    void testAnonymousVariable() throws Narsese.NarseseException {

        
        String input = "((_,_) <-> x)";

        Compound x = term(input);
        
        assertEquals("((_,_)<->x)", x.toString());

        Term y = x.normalize();
        
        assertEquals("((#1,#2)<->x)", y.toString());

        Task question = task(x + "?");
        assertEquals("((#1,#2)<->x)?", question.toStringWithoutBudget());

        Task belief = task(x + ".");
        assertEquals("((#1,#2)<->x). %1.0;.90%", belief.toStringWithoutBudget());

    }

    static class EqualParseTest {
        @Test
        void test1() {
            assertEquals(Op.EQ, $$("(a=#b)").op());
            assertEquals(Op.EQ, $$("(a = #b)").op());
            assertEquals(Op.EQ, $$("(a= #b)").op());
            assertEquals(Op.EQ, $$("(a =#b)").op());
        }
        @Test
        void test1b() {
            assertEquals(Op.EQ, $$("((x,y)=#b)").op());
            assertEquals(Op.EQ, $$("((x,y)=(#z,w))").op());
        }

        @Test
        void test2() {
            assertEq("(#1=5)", "(#1=5)");
            assertEq("(#1=5)", "(5=#1)");
        }
        @Test
        void test3() {
            assertEq("((a,b)=#1)", "((a,b)=#x)");
            assertEq("((a,b)=#1)", "(#x=(a,b))");
        }

        @Test
        void test4() {

            Term multi = $$$("((#1=#2)=(#3=#4))");
            assertTrue(multi.EQ());
//            assertEquals(Op.EQ, multi.sub(0).op());
//            assertEquals(Op.EQ, multi.sub(1).op());
            assertEq("((#1=#2)=(#3=#4))", multi.toString());

            assertEq("((#1=#2)=(#3=#4))", $$$("((#4=#3)=(#1=#2))").toString());
        }
        @Test void test5() {
            assertEq(True, "(x=x)");
            assertEq(False, "(x = --x)");
        }

        @Test void testNegSubterms() {
            assertEq("((--,b)=#1)", "(#1 = --b)");
            assertEq("(b=#1)", "(--#1 = --b)");
        }
    }
    static class DeltaParseTest {
        @Test
        void test() {
            assertEq("Δx", $$("Δx"));

            assertEq("Δx", $$("/\\x")); /* /\ delta */
            assertEq("Δ(x==>y)", $$("/\\(x==>y)")); /* /\ delta */
            assertEq("(x==>Δy)", $$("(x==>/\\y)")); /* /\ delta */

            assertEquals(Op.DELTA, $$("/\\x").op()); /* /\ delta */
        }

        @Disabled @Test void InvalidInhWithTemporal() {
            //assertEquals(1, $$c("Δ(x &&+1 y)").seqDur());
            assertEquals(Null, $$(
                    "(Δ(x &&+1 y)-->z)"));
            assertEquals(Null, $$(
                    "(Δ(Δ(y-->#1) &&+1 (y-->#1))-->z)"));
            assertEquals(Null, $$(
                    "((x,Δ(Δ(y-->#1) &&+1 (y-->#1)))-->z)"));
            assertEquals(Null, $$(
                    "((x,Δ(Δ(y-->#1) &&+1 (y-->#1)))-->(x,Δ((y-->#1) &&+1 Δ(y-->#1))))"));
        }
        @Test
        void InvalidBool() {
            assertEq(Null, $$("Δtrue"));
            assertEq(Null, $$("Δfalse"));
        }

        @Test void DeltaNeg_unwrap() {
            assertEq("(--,Δx)", $$("Δ(--,x)"));
        }
    }
}