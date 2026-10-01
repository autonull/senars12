package nars.term;

import nars.$;
import nars.Narsese;
import nars.Term;
import nars.io.NarseseTest;
import nars.term.atom.Atomic;
import nars.term.util.SetSectDiff;
import org.jetbrains.annotations.Nullable;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import static nars.$.*;
import static nars.Op.*;
import static nars.term.atom.Bool.*;
import static nars.term.util.Testing.assertEq;
import static nars.term.util.Testing.assertInvalids;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Created by me on 12/10/15.
 */
class TermReductionsTest extends NarseseTest {

    private static final @Nullable Term p = Atomic.atomic("P");
    private static final @Nullable Term q = Atomic.atomic("Q");
    private static final @Nullable Term r = Atomic.atomic("R");
    private static final @Nullable Term s = Atomic.atomic("S");


    @Test
    void InterCONJxtReduction1() {
        assertEquals("(&&,P,Q,R)", CONJ.the(r, CONJ.the(p, q)).toString());
        assertEq("(&&,P,Q,R)", "(&&,R,(&&,P,Q))");
    }

    @Test
    void InterCONJxtReduction2() {
        assertEquals("(&&,P,Q,R,S)", CONJ.the(CONJ.the(p, q), CONJ.the(r, s)).toString());
        assertEq("(&&,P,Q,R,S)", "(&&,(&&,P,Q),(&&,R,S))");
    }

    @Test
    void InterCONJxtReduction3() {

        assertEq("(&&,P,Q,R,S,T,U)", "(&&,(&&,P,Q),(&&,R,S),(&&,T,U))");
    }

    @Test
    void InterCONJxtReduction2_1() {
        assertEq("(&&,P,Q,R)", "(&&,R,(&&,P,Q))");
    }

    @Test void embeddedSetDontFlatten() {
        Term a = $$("1"), b = $$("2"), c = $$("3");
        assertEq("{{1,2},3}", SETe.the(SETe.the(a, b), c));
    }

    @Test
    void InterCONJntReduction1() {
        //assertEquals("(||,P,Q,R)", CONJ.the(r, CONJ.the(p, q)).toString());
        assertEq("(||,P,Q,R)", "(||,R,(||,P,Q))");
    }

    @Test
    void InterCONJntReduction2() {

        //assertEquals("(||,P,Q,R,S)", CONJ.the(CONJ.the(p, q), CONJ.the(r, s)).toString());
        assertEq("(||,P,Q,R,S)", "(||,(||,P,Q),(||,R,S))");
    }

    @Test
    void InterCONJntReduction3() {

        assertEq("(||,P,Q,R)", "(||,R,(||,P,Q))");
    }




    @Test void allowsInhProductsWithCommonTerms() {
        assertEq("((a,b)-->(a,c))", "((a,b)-->(a,c))");
        assertEq("a(a,b)", "a(a,b)");
    }

    @Test
    void CyclicalNAL1_and_NAL2() {


        assertInvalids("((#1~swan)-->#1)");
        assertInvalids(
                "((swimmer~swan)-->swimmer)",
                "((x|y)-->x)",
                "((x&y)-->x)",
                "(x-->(x|y))",
                "(x-->(x&y))",
                "(y<->(x|y))",
                "(y<->(x&y))",
                "(#1<->(#1|y))"
        );
    }


    @Test
    void InterCONJntReduction_to_one() {
        for (String o : new String[] { "||", "&&" }) {
            assertEq("(robin-->bird)", "(robin-->(" + o + ",bird))");
            assertEq("(robin-->bird)", String.join(o, "((", ",robin)-->(", ",bird))"));
        }
    }

    @Test
    void FunctionRecursion_in_Product() throws Narsese.NarseseException {
        assertTrue($("task((task,task))").INH());
    }


    @Test
    void IntExtEqual() {
        assertEquals(p, CONJ.the(p, p));
    }

    @Test
    void DiffEqual() {

        assertEquals(False, diff(p, p));
        assertEquals(False, diff(p.neg(), p.neg()));
    }


    @Test
    void DifferenceSorted() {


        assertArrayEquals(
                new Term[]{r, s},
                ((Compound)SetSectDiff.differenceSet(SETe,
                        (Compound)SETe.the(r, p, q, s),
                        (Compound)SETe.the(p, q)))
                    .arrayClone()
        );
    }

    @Test
    void DifferenceSortedEmpty() {


        assertEquals(
                Null,
                SetSectDiff.differenceSet(SETe,
                        (Compound)SETe.the(p, q), (Compound)SETe.the(p, q))
        );
    }


    @Test
    void Difference() throws Narsese.NarseseException {


        assertEquals(
                $("{Mars,Venus}"),
                SetSectDiff.differenceSet(SETe, $$c("{Mars,Pluto,Venus}"), $$c("{Pluto,Saturn}"))
        );
        assertEquals(
                $("{Saturn}"),
                SetSectDiff.differenceSet(SETe, $$c("{Pluto,Saturn}"), $$c("{Mars,Pluto,Venus}"))
        );


    }


    @Test
    void DifferenceImmediate() throws Narsese.NarseseException {

        Term d = diff(SETi.the($("a"), $("b"), $("c")),
                SETi.the($("d"), $("b")));
        assertEquals(SETi, d.op());
        assertEquals(2, d.subs());
        assertEquals("[a,c]", d.toString());
    }

    @Test
    void DifferenceImmediate2() throws Narsese.NarseseException {


        Term a = SETe.the($("a"), $("b"), $("c"));
        Term b = SETe.the($("d"), $("b"));
        Term d = diff(a, b);
        assertEquals(SETe, d.op());
        assertEquals(2, d.subs());
        assertEquals("{a,c}", d.toString());

    }

    @Test
    void DisjunctionReduction1() {
        assertEq("(||,(a-->x),(b-->x),(c-->x),(d-->x))", "(||,(||,x:a,x:b),(||,x:c,x:d))");
    }
    @Test
    void DisjunctionReduction2() {
        assertEq("(||,(b-->x),(c-->x),(d-->x))", "(||,x:b,(||,x:c,x:d))");
    }

    @Test
    void ConjunctionReduction() {
        assertEq("(&&,a,b,c,d)", "(&&,(&&,a,b),(&&,c,d))");
        assertEq("(&&,b,c,d)", "(&&,b,(&&,c,d))");
    }

    @Test
    void TemporalConjunctionReduction1() throws Narsese.NarseseException {
        assertEq("(a&&b)", "(a &&+0 b)");
        assertEquals(
                $("((--,(ball_left)) &&-270 (ball_right))"),
                $("((ball_right) &&+270 (--,(ball_left)))"));

    }

    @Test
    void ConjunctionParallelWithConjunctionParallel() {
        assertEq("(&&,nario(13,27),nario(21,27),nario(24,27))", "((nario(21,27)&|nario(24,27))&|nario(13,27))");
    }

    @Disabled @Test
    void TemporalConjunctionReduction2() {
        assertEq("((a&&b) &&+1 c)", "(a &&+0 (b &&+1 c))");
    }

    @Test
    void TemporalConjunctionReduction3() {
        assertEq("(a&&b)", "( (a &&+0 b) && (a &&+0 b) )");
    }

    @Test
    void TemporalConjunctionReduction4() {
        assertEq("(a&&b)", "( a &&+0 (b && b) )");
    }


    @Test
    void TemporalNTermConjunctionParallel() {


        assertEq("(&&,a,b,c)", "( a &&+0 (b &&+0 c) )");
    }

    @Disabled
    @Test
    void TemporalNTermEquivalenceParallel() {

        assertEq("(<|>, a, b, c)", "( a <|> (b <|> c) )");
    }


    @Test
    void Multireduction() {

    }

    @Test
    void ConjunctionMultipleAndEmbedded() {

        assertEq("(&&,a,b,c,d)", "(&&,(&&,a,b),(&&,c,d))");
        assertEq("(&&,a,b,c,d,e,f)", "(&&,(&&,a,b),(&&,c,d), (&&, e, f))");
        assertEq("(&&,a,b,c,d,e,f,g,h)", "(&&,(&&,a,b, (&&, g, h)),(&&,c,d), (&&, e, f))");
    }

    @Test
    void ConjunctionEquality() throws Narsese.NarseseException {

        assertEquals(
                $("(&&,r,s)"),
                $("(&&,s,r)"));


    }



    @Test
    void DisjunctionMultipleAndEmbedded() {

        assertEq("(||,(a),(b),(c),(d))", "(||,(||,(a),(b)),(||,(c),(d)))");
        assertEq("(||,(a),(b),(c),(d),(e),(f))", "(||,(||,(a),(b)),(||,(c),(d)), (||,(e),(f)))");
        assertEq("(||,(a),(b),(c),(d),(e),(f),(g),(h))", "(||,(||,(a),(b), (||,(g),(h))),(||,(c),(d)), (||,(e),(f)))");

    }



    @Test
    void RepeatInverseEquivalent() throws Narsese.NarseseException {
        assertEquals($("(x &&-1 x)"), $("(x &&+1 x)"));
        assertEquals($("(x =|> x)"), $("(x =|> x)"));
        assertEquals(True, $("(x =|> x)"));
        assertEquals($("x"), $("(x && x)"));
        assertEquals($("x"), $("(x &| x)")); //TODO remove this syntax
    }


    @Disabled @Test
    void DisallowInhAndSimBetweenTemporallySimilarButInequalTerms() {


        assertEq(True, "((x &&+1 y)<->(x &&+10 y))");
        assertEq(True, "((y &&+10 x)<->(x &&+1 y))");
        assertEq(True, "((x=|>y)-->(x ==>-10 y))");
    }


//        @Test
//        void distinctSimNegationStatements() throws Narsese.NarseseException {
//            if (!NAL.term.INH_CLOSED_BOOLEAN_DUALITY_MOBIUS_PARADIGM) {
//                assertEq(Bool.True, "(a<->a)");
//
//                assertNotEquals($("(--a <-> b)"), $("(a <-> --b)"));
//
//                assertEq("((--,a)<->b)", "((--,a) <-> b)");
//                assertNotEquals("(a<->b)", $("((--,a) <-> b)").toString());
//                assertEq("((--,a)<->b)", "(b <-> (--,a))");
//                assertNotEquals("(a<->b)", $("(b <-> (--,a))").toString());
//                assertEq("((--,a)<->(--,b))", "(--a <-> --b)");
//
////        assertEq("((--,a)<->a)", "((--,a)<->a)");
//            }
//        }

    @Test void recursiveInh() {
        assertEq("((x-->r)-->(r,s))", "((x-->r)-->(r,s))");         //assertFalse(assertEqRCom($);
        assertEq("((x-->r)-->{r,s})", "((x-->r)-->{r,s})");
        assertInvalids("((x-->r)-->r)");
    }




    @Test
    void OneArgInterCONJon() throws Narsese.NarseseException {
        Term x = p($.atomic("x"));
        assertEquals(x, $("(||,(x))"));
        assertEquals(x, $("(||,(x),(x))"));
        assertEquals(x, $("(&&,(x))"));
        assertEquals(x, $("(&&,(x),(x))"));
    }

//    private void tryDiff(NAR n, String target, String truthExpected) throws Narsese.NarseseException {
//        assertEquals(truthExpected, n.beliefTruth(target, ETERNAL).toString(), target::toString);
//
//    }

    @Test
    void CoNegatedInterCONJonAndDiffs() {
        assertInvalids("(||,(x),(--,(x))");
        assertInvalids("(&&,(x),(--,(x))");
        assertInvalids("(-,(x),(--,(x))");
        assertInvalids("(~,(x),(--,(x))");
        assertInvalids("(-,(x),(x))");
    }

    @Test
    void taskWithFlattenedConunctions() throws Narsese.NarseseException {


        Term x = $("((hear(what)&&(hear(is)&&(hear(is)&&(hear(what)&&(hear(is)&&(hear(is)&&(hear(what)&&(hear(is)&&(hear(is)&&(hear(is)&&hear(what))))))))))) ==>+153 hear(is)).");
        assertEq("((hear(is)&&hear(what)) ==>+153 hear(is))",
                x.toString());

    }

//    @Disabled static class StructuralMobius {
//
//        @Test
//        void AllowInhNegationStatements() throws Narsese.NarseseException {
//            assertEq(True, "(a-->a)");
//
//            assertEq("((--,a)-->b)", "((--,a) --> b)");
//            assertNotEquals("(a-->b)", $("((--,a) --> b)").toString());
//            assertEq("(b-->(--,a))", "(b --> (--,a))");
//            assertNotEquals("(a-->b)", $("(b --> (--,a))").toString());
//            assertEq("((--,a)-->(--,b))", "(--a --> --b)");
//
//            assertEq(Null /*"((--,a)-->a)"*/, "((--,a)-->a)");
//            assertEq(Null /*"(a-->(--,a))"*/, "(a-->(--,a))");
//
//        }
//
//        @Test
//        void SimilarityNegatedSubtermsDoubleNeg() {
//            assertEq("((--,(P))<->(--,(Q)))", "((--,(P))<->(--,(Q)))");
//        /*
//        <patham9> <-> is a relation in meaning not in truth
//        <patham9> so negation can't enforce any equivalence here
//        */
//        }
//
//        @Test
//        void SimilarityNegatedSubterms() {
//            assertEq("((--,(Q))<->(P))", "((P)<->(--,(Q)))");
//            assertEq("((--,(P))<->(Q))", "((--,(P))<->(Q))");
//        }
//    }


}