package nars;

import jcog.Fuzzy;
import jcog.Is;
import jcog.TODO;
import jcog.Util;
import jcog.util.Reflect;
import nars.truth.AbstractMutableTruth;
import nars.truth.PreciseTruth;
import nars.truth.func.TruthFunction;
import nars.truth.func.TruthModel;
import nars.truth.func.annotation.AllowOverlap;
import nars.truth.func.annotation.SinglePremise;
import org.jetbrains.annotations.Nullable;

import java.lang.reflect.Field;

import static java.lang.Math.abs;
import static jcog.Fuzzy.*;
import static jcog.Util.assertUnitized;
import static jcog.Util.lerpSafe;
import static nars.$.tt;
import static nars.NAL.HORIZON;
import static nars.NAL.truth.FREQ_EPSILON;
import static nars.NAL.truth.FREQ_EPSILON_half;
import static nars.Op.ETERNAL;

/**
 * NAL Truth Functions
 * derivative of the original set of NAL truth functions, preserved as much as possible
 */
public enum TruthFunctions implements TruthFunction {

    @AllowOverlap @SinglePremise Dynamic() {
        @Override
        public @Nullable Truth apply(@Nullable Truth task, @Nullable Truth belief, float confMin) {
            throw new UnsupportedOperationException();
        }

    },

    Deduction() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return deduction(T, B, true, confMin);
        }

//        @Override
//        public boolean apply(MutableTruth y, @Nullable Truth task, @Nullable Truth belief, float confMin) {
//            throw new TODO();
//            deduction(y, task, belief, true, confMin);
//            return y.is();
//        }

    },
//    DeductionSym() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return deductionSym(T,B,true,confMin);
//        }
//    },
//    DeductionSymWeak() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return deductionSym(T,B,false, confMin);
//        }
//    },

    Conduct() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return conduct(T, B, false, confMin);
        }
    },

    ConductWeak() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return conduct(T, B, true, confMin);
        }
    },

    SuperConduct() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return superConduct(T, B, true, false, confMin);
        }
    },
    SuperConductWeak() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return superConduct(T, B, true, true, confMin);
        }
    },
    SemiConduct() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return superConduct(T, B, false, true, confMin);
        }
    },

//    /** HACK for occurrence time calculation */
//    @Deprecated NegConductWeak() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return neg(ConductWeak.apply(T, B, confMin));
//        }
//    },
//
//    SemiConduct() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return semiconduct(T, B, confMin);
//        }
//    },
//    SemiConductWeak() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return weak(SemiConduct.apply(T, B, confMin), confMin);
//        }
//    },
//
    /** TODO reverse args TODO rename */
    @Deprecated Biduct() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return biduct(B, T, false, confMin);
            //return SemiConduct.apply(B, T, confMin);
        }
    },
    @Deprecated BiductWeak() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return biduct(B, T, true, confMin);
        }
    },
//
//    /** TODO reverse args TODO rename */
//    @Deprecated BiductWeaker() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//
//            return weak(BiductWeak.apply(T, B, confMin), confMin);
//        }
//    },

    DeductionWeak() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return deduction(T, B, false, confMin);
        }

    },

//    @AllowOverlap DeductionRecursive() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return deduction(T, B, true, confMin);
//        }
//
//    },
//    @AllowOverlap DeductionWeakRecursive() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return TruthFunctions.deduction(T, B, false, confMin);
//        }
//
//        @Override
//        public boolean taskTruthValid(@Nullable Truth t) {
//            return nonZeroFreq(t);
//        }
//    },

    /** this is like sqrt(truth) .... try actual: f = sqrt(f0) */
    @AllowOverlap @SinglePremise StructuralDeduction() {
        @Override
        public Truth apply(Truth T, Truth ignored, float confMin) {
            var B = structuralComponent(T); if (B==null) return null;
            return Deduction.apply(T, B, confMin);

//            final double c = T!=null ? confReduce(T) : 0;
//            return c > confMin ? Deduction.apply(T, $.t(1, c), confMin) : null;
        }

        @Override
        public boolean beliefTruthSignificant() {
            return false;
        }
    },

    @AllowOverlap @SinglePremise StructuralIntersection() {
        @Override
        public Truth apply(Truth T, Truth ignored, float confMin) {
            var B = structuralComponent(T); if (B==null) return null;
            return Intersection.apply(T, B, confMin);
        }

        @Override
        public boolean beliefTruthSignificant() {
            return false;
        }
    },
    @AllowOverlap @SinglePremise StructuralExemplification/*Strong*/() {
        @Override
        public Truth apply(Truth T, Truth ignored, float confMin) {
            var B = structuralComponent(T); if (B==null) return null;
            return ExemplificationStrong.apply(T, B, confMin);
        }
        @Override
        public boolean beliefTruthSignificant() {
            return false;
        }
    },

    @AllowOverlap @SinglePremise StructuralExemplificationWeak() {
        @Override
        public Truth apply(Truth T, Truth ignored, float confMin) {
            var B = structuralComponent(T); if (B==null) return null;
            return Exemplification.apply(T, B, confMin);
        }
        @Override
        public boolean beliefTruthSignificant() {
            return false;
        }
    },

    /**
     * similar to structural deduction but keeps the same input frequency, only reducing confidence
     * TODO check if this is equivalent to a 'structural induction' if so rename it
     */
    @SinglePremise StructuralReduction() {
        @Override
        public Truth apply(Truth T, Truth Bignored, float confMin) {
            return structuralReduction(T, confMin);
        }

        @Override
        public boolean beliefTruthSignificant() {
            return false;
        }
    },

//    @SinglePremise SymmetricReduction() {
//        @Override
//        public Truth apply(Truth T, Truth Bignored, float confMin) {
//            double c = confReduce(T);
//            return c >= confMin ? $.tt((float) Math.sqrt(T.freq()), c) : null;
//        }
//
//        @Override
//        public boolean beliefTruthSignificant() {
//            return false;
//        }
//    },

    Induction() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return induction(T, B, confMin);
        }
        //TODO belief freq  non-zero
    },


    @Is("Sherlock_Holmes#Holmesian_deduction") Abduction() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return induction(B, T, confMin);
        }

    },


    /**
     * polarizes according to an implication belief.
     * here if the belief is negated, then both task and belief truths are
     * applied to the truth function negated.  but the resulting truth
     * is unaffected as it derives the subject of the implication.
     */
    AbductionSym() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            if (symNegates(T, B)) {
                T = T.neg();
                B = B.neg();
            }
            return Abduction.apply(T, B, confMin);
        }
    },
    InductionSym() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            if (symNegates(T, B)) {
                T = T.neg();
                B = B.neg();
            }
            return Induction.apply(T, B, confMin);
        }
    },


//    AbductionXOR() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return B.NEGATIVE() ? Abduction.apply(T, B.neg(), confMin) : Abduction.apply(T.neg(), B, confMin);
//        }
//    },

    Comparison() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return comparison(T, B, confMin);
        }
    },
//    ComparisonSymmetric() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return TruthFunctions2.comparisonSymmetric(T, B, confMin);
//        }
//    },

    Conversion() {
        @Override
        public boolean taskTruthSignificant() {
            return false;
        }

        @Override
        public Truth apply(@Nullable Truth T, Truth B, float confMin) {
            return conversion(B, confMin);
        }
    },

    Resemblance() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return resemblance(T, B, confMin);
            //return TruthFunctions2.resemblance(T, B, confMin);
        }
    },

    Contraposition() {
        @Override
        public boolean taskTruthSignificant() {
            return false;
        }

        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return contraposition(B, confMin);
            //return TruthFunctions2.contraposition2(B, confMin);
        }
    },

    Intersection() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return intersect(T, false, B, false, confMin);
        }
    },

    Union() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return intersect(T, true, B, true, confMin);
        }
    },

    Subtract() {
        @Override public Truth apply(Truth T, Truth B, float confMin) { return subtract(T, B, confMin); }
    },

    Diff() {
        @Override public Truth apply(Truth T, Truth B, float confMin) { return diff(T, B, confMin); }
    },

    DiffGoal() {
        @Override public Truth apply(Truth T, Truth B, float confMin) { return diffGoal(T, B, confMin); }
    },

    Sameness() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return sameness(T, B, true, true, confMin);
        }
    },

    Polarduct() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return polarduct(T, B, false, confMin);
        }
    },

    PolarductWeak() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return polarduct(T, B, true, confMin);
        }
    },

    //    IntersectionSym() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return B.NEGATIVE() ?
//                    Intersection.apply(T.neg(), B.neg(), confMin)
//                    :
//                    Intersection.apply(T, B, confMin);
//        }
//    },
    Pre() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return pre(T, B, true, confMin);
        }

    },
    PreWeak() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return pre(T, B, false, confMin);
        }
    },

    @AllowOverlap PreRecursive() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return pre(T, B, true, confMin);
        }

    },

    Post() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return post(T, B, true, true, confMin);
        }
    },

    Need() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return post(T, B, false, true, confMin);
        }
    },

    PostWeak() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return post(T, B, true, false, confMin);
        }
    },

//    Want() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return pre(T, B, false, true, confMin);
//        }
//
//    },
//    WantWeak() {
//        @Override
//        public @Nullable Truth apply(@Nullable Truth task, @Nullable Truth belief, float confMin) {
//            return weak(Want.apply(task, belief, confMin), confMin);
//        }
//    },

//    Need() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return post(T, B, true, true, confMin);
//        }
//    },
//    NeedWeak() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return weak(Need.apply(T,B,confMin), confMin);
//        }
//    },
//    NeedPolar() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            boolean neg;
//            if (T.POSITIVE() && !B.POSITIVE()) {
//                neg = true;
//                B = B.neg();
//            } else if (!T.POSITIVE() && B.POSITIVE()) {
//                neg = true;
//                T = T.neg();
//            } else
//                neg = false;
//            return negIf(TruthFunctions2.post(T, B, true, true, confMin), neg);
//        }
//    },

    Mix() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return mix2(T, B, false, confMin);
        }
    },
    MixWeak() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return mix2(T, B, true, confMin);
        }
    },

//    MixDisj() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return TruthFunctions2.mix(T, B, false, confMin);
//        }
//    },

//    IntersectionPB() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return B.isNegative() ?
//                    negIfNonNull(Intersection.apply(T.neg(), B.neg(), confMin))
//                    :
//                    Intersection.apply(T, B, confMin);
//        }
//    },
//    UnionPB() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return B.isNegative() ?
//                    negIfNonNull(Union.apply(T.neg(), B.neg(), confMin))
//                    :
//                    Union.apply(T, B, confMin);
//        }
//    },


    Analogy() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return analogy(T, B.freq(), B.conf(), confMin);
            //return weak(TruthFunctions2.analogyBipolar(T, B, confMin), confMin);
        }
    },

//    ReduceConjunction() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return reduceConj(T, B, confMin);
//        }
//    },

//
//    AnonymousAnalogy() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return TruthFunctions.anonymousAnalogy(T, B, confMin);
//        }
//    },


//    BixemplificationStrong() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            boolean tNeg = T.NEGATIVE();
//            return negIf(TruthFunctions2.exemplification(T.negIf(tNeg), B, confMin), tNeg);
//        }
//
//    },

//    /** weak exemplification */
//    Could() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return weak(Conduct.apply(T, B, confMin), confMin);
//        }
//
//    },

    /** TODO rename to 'Exemplification' */
    ExemplificationStrong() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return exemplification(T, B, false, confMin);
        }
    },
    /** TODO rename to 'ExemplificationWeak' */
    Exemplification() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return exemplification(T, B, true, confMin);
        }
    },
//    /** TODO rename to 'ExemplificationWeaker' */
//    ExemplificationWeak() {
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return weak(Exemplification.apply(T, B, confMin), confMin);
//        }
//    },


    Presume() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return must(T, false, B, false, false, confMin);
        }
    },
    PresumeWeak() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return must(T, false, B, false, true, confMin);
        }
    },

//    Must() {
//        @Override
//        public @Nullable Truth apply(@Nullable Truth T, @Nullable Truth conj, float confMin) {
//            return must(T, true, conj, true, false, confMin);
//        }
//    },
//    MustWeak() {
//        @Override
//        public @Nullable Truth apply(@Nullable Truth T, @Nullable Truth conj, float confMin) {
//            return must(T, true, conj, true, true, confMin);
//        }
//    },

    /** TODO rename to 'Suppose' */
    SupposeStrong() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return suppose(T, true, B, false, false, confMin);
        }
    },
    /** TODO rename to 'SupposeWeak' */
    Suppose() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return suppose(T, true, B, false, true, confMin);
        }
    },
//    DecomposeDiff() {
//        @Override
//        public Truth apply(final Truth T, final Truth B, float minConf, NAL n) {
//            return TruthFunctions2.decomposeDiff(T, B, minConf);
//        }
//    },

    Divide() {
        @Override
        public Truth apply(Truth XY, Truth X, float confMin) {
            return NAL.derive.DIVIDE_OR_DECOMPOSE ?
                divide(XY, X, confMin) :
                decompose(XY, X, confMin);
        }
    },

    DivideWeak() {
        @Override
        public Truth apply(Truth XY, Truth X, float confMin) {
            return weak(Divide.apply(XY, X, confMin), confMin);
        }
    },

//    Undivide() {
//        @Override
//        public Truth apply(Truth XY, Truth X, float confMin) {
//            return TruthFunctions2.undivide(XY, X, confMin);
//        }
//    },

    @SinglePremise
    Identity() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return TruthFunction.identity(T, confMin);
        }

    },


    BeliefIdentity() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return TruthFunction.identity(B, confMin);
        }

        @Override
        public boolean taskTruthSignificant() {
            return false;
        }

    },


    /**
     * maintains input frequency but reduces confidence
     */
    BeliefStructuralReduction() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return StructuralReduction.apply(B, null, confMin);
        }
        @Override
        public boolean taskTruthSignificant() {
            return false;
        }
    },
//    BeliefSymmetricReduction() {
//        @Override
//        public boolean taskTruthSignificant() {
//            return false;
//        }
//
//        @Override
//        public Truth apply(Truth T, Truth B, float confMin) {
//            return B == null ? null : SymmetricReduction.apply(B, null, confMin);
//        }
//    },

    BeliefStructuralDeduction() {
        @Override
        public boolean taskTruthSignificant() {
            return false;
        }


        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return B == null ? null : StructuralDeduction.apply(B, null, confMin);
        }
    },

    Xor() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return xor(T, B, confMin);
        }

    },
    XorWeak() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return weak(Xor.apply(T, B, confMin), confMin);
        }
    },

    XorWeaker() {
        @Override
        public Truth apply(Truth T, Truth B, float confMin) {
            return weak(XorWeak.apply(T, B, confMin), confMin);
        }
    }

    ;

    @Nullable private static PreciseTruth structuralComponent(Truth T) {
        return $.t(1, T.conf());
    }

    public static final TruthModel the = new TruthModel(values());

    private final boolean single;
    private final boolean overlap;
    private final Term term;


    TruthFunctions() {
        this.term = TruthFunction.super.term();

        Field f = Reflect.on(TruthFunctions.class).field(name()).get();
        this.single = f.isAnnotationPresent(SinglePremise.class);
        this.overlap = f.isAnnotationPresent(AllowOverlap.class);
    }

    public static TruthFunctions implStrong(boolean fwd, boolean beliefOrGoal) {
        return beliefOrGoal ?
           (fwd ? Pre : PostWeak) :
           (fwd ? PreWeak : Need);
    }

    /**
     * commutative
     * {<M --> P>, <S --> M>} |- <S --> P>
     * {<S --> M>, <M --> P>} |- <P --> S>
     * https://groups.google.com/g/open-nars/c/ILfG8OFVxN8/m/33toHH4rrxYJ?pli=1
     */
    public static @Nullable Truth deduction(Truth x, Truth y, boolean strong, float minConf) {
        double cxy = confCompose(x, y);
        if (cxy < minConf) return null;

        double fxy = Fuzzy.intersect(x.freq(), y.freq());

        double c = and(fxy, cxy);
        if (c < minConf) return null;

        if (!strong) {
            c = weak(c); if (c < minConf) return null;
        }

        return c < minConf ? null : tt(fDoubt(fxy), c);
    }

    @Deprecated
    private static double fDoubt(double x) {
        return NAL.truthFn.OPEN_WORLD ? Util.lerpSafe(x, 0.5f, 1) : x;
    }

    /**
     * {<S ==> M>, <M <=> P>} |- <S ==> P>
     * <p>
     * stronger than deduction such that A's frequency does not reduce the output confidence
     */
    public static @Nullable Truth analogy(Truth a, float bf, double bc, float minConf) {
        double c = and(confCompose(a, bc), bf);
        return c < minConf ? null : tt(fDoubt(and(a.freq(), bf)), c);
    }

    /**
     * {<S ==> M>, <P ==> M>} |- <S ==> P>
     *
     * @param a Truth value of the first premise
     * @param b Truth value of the second premise
     * @return Truth value of the conclusion, or null if either truth is analytic already
     */
    public static @Nullable Truth induction(Truth a, Truth b, double minConf) {
        double c = confComposeFactorWeak(a, b, b.freq());
        return c < minConf ? null : tt(a.freq(), c);
    }

    public static @Nullable Truth comparison(Truth a, Truth b, float minConf) {
        double fA = a.freq(), fB = b.freq();

        double orAB = or(fA, fB);
        double c = weak(confCompose(orAB, confCompose(a, b)));
        if (c < minConf) return null;

        double f = (orAB < NAL.truth.FREQ_EPSILON) ? 0 : (and(fA, fB) / orAB);
        return tt(f, c);
    }

    /**
     * {<S <=> M>, <M <=> P>} |- <S <=> P>
     *
     * @param v1 Truth value of the first premise
     * @param v2 Truth value of the second premise
     * @return Truth value of the conclusion
     * <p>
     * like intersection, but confidence is factored by or(f1,f2)
     */
    static @Nullable Truth resemblance(Truth v1, Truth v2, float minConf) {
        float f1 = v1.freq(), f2 = v2.freq();
        double c = confComposeFactor(v1, v2, or((double) f1, f2));
        return c < minConf ? null : tt(and(f1, f2), c);
    }

    /**
     * TODO return double
     */
    public static double confCompose(Truth a, double b) {
        return confCompose(a.conf(), b);
    }

    /**
     * TODO return double
     */
    public static double confCompose(Truth a, Truth b) {
        return confCompose(a.conf(), b.conf());
    }

    /**
     * TODO return double
     */
    public static double confCompose(double cx, double cy) {
        return NAL.truthFn.CONF_COMPOSITION.valueOf(cx, cy);
    }

    /**
     * {<M --> S>, <M <-> P>} |- <M --> (S&P)>
     *
     * @param x Truth value of the first premise
     * @param y Truth value of the second premise
     * @return Truth value of the conclusion
     * <p>
     * In the confidence functions, each case for the conclusion to reach its
     * maximum is separately considered. The plus operator is used in place of an
     * or operator, because the two cases involved are mutually exclusive, rather
     * than independent of each other.
     * <p>
     * Fint : Intersection
     * f = and(f1, f2)
     * c = or(and(not(f1), c1), and(not(f2), c2)) + and(f1, c1, f2, c2)
     * Funi : Union
     * f = or(f1, f2)
     * c = or(and(f1, c1), and(f2, c2)) + and(not(f1), c1, not(f2), c2)
     * Fdif : Difference
     * f = and(f1, not(f2))
     * c = or(and(not(f1), c1), and(f2, c2)) + and(f1, c1, not(f2), c2)
     * <p>
     */
    public static @Nullable Truth intersect(Truth x, boolean negX, Truth y, boolean negY, double minConf) {
        double c = confCompose(x, y); if (c < minConf) return null;

        //        if (NAL.truth.INTERSECTION_FADE_NONPOLAR) {
//            //EXPERIMENTAL - TODO needs modification in the divide function
//            f = Util.lerpSafe(pxy, 0.5, f);
//        }

        return tt(intersectFreq(x, negX, y, negY), c);
    }

    private static double intersectFreq(Truth x, boolean negX, Truth y, boolean negY) {
        return Fuzzy.intersect(negIf(x.freq(), negX), negIf(y.freq(), negY));
    }

    private static double negIf(double f, boolean neg) {
        return neg ? (1 - f) : f;
    }

    /**
     * original OpenNARS desire function
     */
    @Deprecated
    public static Truth desireClassic(Truth a, Truth b, float minConf, boolean strong) {
        float f1 = a.freq();
        float f2 = b.freq();
        float f = and(f1, f2);
        double c12 = confCompose(a, b);
        double c = and(c12, f2) * (strong ? 1 : weak(1));
        return c < minConf ? null : tt(f, c);
    }

    /**
     * conf -> evidence
     */
    public static double c2e(double c) {
        return c2e(c, HORIZON);
    }

    /**
     * conf -> evidence
     * <p>
     * http://www.wolframalpha.com/input/?i=x%2F(1-x)
     *
     * @param c confidence, in [0, 1)
     * @return The corresponding weight of evidence, a non-negative real number
     */
    public static double c2e(double c, double horizon) {
        return horizon * c / (1 - c);
    }

    /**
     * evidence -> conf
     * http://www.wolframalpha.com/input/?i=x%2F(x%2B1)
     */
    public static double e2c(double e, double horizon) {
        return e / (e + horizon);
    }

    /**
     * evidence -> conf
     */
    public static double e2c(double e) {
        return e2c(e, HORIZON);
    }

    public static float originality(int stampLen) {
        return stampLen <= 1 ?
                1 : 1 / (1 + ((float)(stampLen - 1)) / (NAL.STAMP_CAPACITY - 1));
    }

    /** a scalar decomposition of a truth value, in the range [0..1] involving both frequency and confidence */
    public static double expectation(float frequency, double confidence) {
        //return confidence * (frequency - 0.5) + 0.5;
        return Util.fma(confidence, frequency - 0.5, 0.5);
    }

    public static double eternalize(double evi) {
        return weak(evi);
    }

    /**
     * point-segment-segment relative projection formula
     * TODO test
     * @param ete eternalization
     */
    public static double projectMid(long now, long fs, long fe, long ts, long te, float dur, float ete) {
        if (fs == ETERNAL)
            return 1;
        assert (ts != ETERNAL);

        /* source surrounds or equals target */
        if (fs <= ts && fe >= te)
            return 1;

        assertUnitized(ete);

        //mid->mid
        //TODO minshift?
        double p = project((fs+fe)/2, (ts+te)/2, now, dur);

        double dilution = rangeDilution(fs, fe, ts, te);

        return (1 - p * (1-ete)) * dilution;
    }

    /**
     * point-segment-segment relative projection formula
     * TODO test
     */
    public static double projectTrapezoidal(long now, long fs, long fe, long ts, long te, float dur, double ete, int n) {
        if (fs == ETERNAL || (fs==ts && fe==te) || ete>=1) return 1;
        assert (ts != ETERNAL);

        assert(n>=2);
        double nmin1 = n - 1;
        double df = (fe - fs) / nmin1;
        double dt = (te - ts) / nmin1;
        double xx = 0;

        for (int i = 0; i < n; i++) {
            long t = ts + (i > 0 ? (i < n - 1 ? Math.round(dt * i) : te) : 0);
            double x = ((t >= fs && t <= fe) ? 0 :
                project(fs + (i > 0 ? (i < n - 1 ? Math.round(df*i) : fe) : 0), t, now, dur));
            xx += x;
        }

        double xMean = xx / n;
        double z =
            /* 1 - (1 - ete) * xMean; */
            Util.fma(ete-1, xMean, +1);

        //assertUnitized(z);

        double dilution = rangeDilution(fs, fe, ts, te);

        return z * dilution;

//2ary: TODO unit test that the above is equivalent:
//        double ps = (ts >= fs && ts <= fe) ? 0 : project(fs, ts, now, dur);
//        double pe = (te >= fs && te <= fe) ? 0 : project(fe, te, now, dur);
//        return 1 - mean(ps, pe)*(1-ete);
    }

    private static double rangeDilution(long fs, long fe, long ts, long te) {
        return Math.min(1, ((double) (1 + fe - fs)) / (1 + te - ts));
    }

    /** "triangular" temporal projection discount */
    public static double project(long from, long to, long now, float dur) {
        if (from == to) {
            return 0;
        } else {
            float y = dur +
                    (NAL.revision.RELATIVE_PROJECTION_MODE_CLASSIC_OR_ISOSCELES ?
                        abs(now - from) + abs(now - to)          //classic
                        :
                        Math.max(abs(now - from), abs(now - to))*2 //isosceles
                    );
            //classic
            //isosceles
            return ((double) abs(from-to)) / Math.max((float) 1, y);
        }
    }

    ////        } else {
    ////            ft = min(abs(ts - fs), abs(te - fe));
    ////        }
    //
    //        double factor;
    //        if (ft == 0) {
    //            factor = 1;
    //        } else {
    //            //TODO better precision (0.5 cycles)?
    //            //long F = (fs + fe) / 2L, T = (ts + te) / 2L;
    //            //factor = 1 - unitizeSafe(ft / ((abs(now - F) + abs(now - T)) * memoryFactor));
    //            //final double nf = meanTimeToRaw(now, fs, fe), nt = meanTimeToRaw(now, ts, te);
    //            final long nf = maxTimeToRaw(now, fs, fe), nt = maxTimeToRaw(now, ts, te);
    //
    //            factor = 1 - unitizeSafe(
    //                ft / ((nf + nt + dur) * memoryFactor));
    //        }
    //
    //
    //        /* dilution factor: temporal range stretch, when target range is larger */
    //        final long fes = fe - fs;
    //        final long tes = te - ts;
    //        double dilution =
    //                (fes>=tes) ? 1 : fes / ((double) tes);
    //                //1;
    //
    //
    //        return factor * dilution;
    //    }


    //    /**
    //     * 3-point relative projection formula
    //    */
    //    public static double project(long now, long f, long t, double memoryFactor) {
    //
    //
    //        //long ft = LongInterval.minTimeShiftTo(fs, fe, ts, te);
    //        //long ft = abs( (fs + fe)/2 - (ts + te)/2 ); //midpoint delta
    //        long ft =
    //                //(minTimeToRaw(ts, fs, fe) + minTimeToRaw(te, fs, fe))/2.0;
    //                abs(f-t);
    //
    //        double factor;
    //        if (ft == 0) {
    //            factor = 1;
    //        } else {
    //            final long nf = abs(now - f), nt = abs(now - t);
    //
    //            final double p = ft / ((nf + nt) * memoryFactor);
    //
    //            factor = 1 - unitizeSafe(p);
    //        }
    //
    //        return factor;
    //
    //    }

        public static @Nullable Truth neg(@Nullable Truth t) {
            return t instanceof AbstractMutableTruth T ? T.negThis() : t == null ? null : t.neg();
        }

    /**
     * {(A ==> B)} |- (--B ==> --A)
     *
     * @param t Truth value of the premise
     * @return Truth value of the conclusion
     */
    @Is("Contraposition") public static Truth contraposition(Truth t, double minConf) {
        double c = weak(t.freq() * t.conf());
        return c < minConf ? null : tt(0, c);
    }

    /**
     * {<A ==> B>} |- <B ==> A>
     *
     * @param t Truth value of the premise
     * @return Truth value of the conclusion
     */
    public static Truth conversion(Truth t, float minConf) {
        double c = weak(t.freq() * t.conf());
        return c < minConf ? null : tt(1, c);
    }

    @Nullable public static Truth negIf(@Nullable Truth x, boolean neg) {
        return x == null || !neg ? x : neg(x);
    }

    public static double weak(double c) {
        return e2c(c);
        //return c * w2cSafe(1);
    }

    @Nullable @Deprecated
    static Truth weak(@Nullable Truth t, float confMin) {
        if (t == null) return null;

        double c = weak(t.conf());
        return c < confMin ? null :
            (t instanceof AbstractMutableTruth T ? T.conf(c) : tt(t.freq(), c));
    }

    public static Truth decompose(Truth xy, Truth x, float confMin) {
        double f = ((double)xy.freq()) * x.freq();
        double conf = confComposeFactor(xy, x, f);
        return conf >= confMin ? tt(f, conf) : null;
    }

    public static Truth weak(Truth t) {
        var oldEvi = t.evi();
        var newEvi = c2e(weak(e2c(oldEvi)));
        double eviScale = newEvi/oldEvi;
        return t.cloneEviMult(eviScale, 0);
    }

    /** equality / frequency alignment function - determines how to compare frequencies for alignment, match, correlation, etc... */
    private static double alignment(float x, float y) {
        return NAL.truth.ALIGNMENT_ABSOLUTE ?
            Fuzzy.equals(x, y) :
            Fuzzy.alignment(x, y, FREQ_EPSILON/2);
            //Fuzzy.linearEqualsNormalized(x, y);
            //Math.pow(Fuzzy.equals(x, y), NAL.GRIP/*>=1*/);
            //Fuzzy.xnr(x, y);
            //Fuzzy.eqNorm(x, y);
            //Fuzzy.xnrNorm(x, y);
            //Fuzzy.equalsPolar(x, y, 4);
    }

    /**
     *   X, (  X ==> Y) |- Y
     * --X, (--X ==> Y) |- Y
     * frequency determined by impl
     */
    public static Truth pre(Truth X, Truth XimplY, boolean strong, float confMin) {

        double alignment = alignment(1, X.freq()), xy = XimplY.freq();

        double f, c;

        f = xy; c = alignment; //direct

        //f = xy; c = alignment * alignment; //direct with quadratic doubt

        //f = lerpSafe(x, 1-xy, xy); c = x; //crossover (presumptuous)
        //f = lerpSafe(x, 0.5, xy); c = _c * x; //fade to maybe + doubt
        //f = lerpSafe(x, 0.5, xy); c = _c; //fade to maybe
//            f = lerpSafe(x, 1-xy, xy); c = _c * x; //crossover, with doubt
//            f = lerpSafe(x, 0.5, xy); c = _c;
//            f = lerpSafe(x, 1-xy, xy); c = _c * polarity(x); //crossover

        c = confComposeLinear(X, XimplY, c, !strong); if (c < confMin) return null;

        return tt(f, c);
    }

    /**
     *   Y. , (X ==>   Y). |- X.
     * --Y. , (X ==> --Y). |- X.
     */
    public static Truth post(Truth Y, Truth XimplY, boolean beliefOrGoal, boolean strong, float confMin) {

        var y = Y.freq();
        var xy = XimplY.freq();

        var alignment = alignment(y, xy);

        double f, c;
        if (beliefOrGoal) {

            f = 1; c = alignment; //full-wave

            //f = 1; c = alignment*alignment; //full-wave quadratic

            //f = 0.5f + alignment/2; c = alignment; //fade to maybe with doubt

            //f = 0.5f + alignment/2; c = alignment*alignment; //fade to maybe with doubt (quadratic)

            //f = alignment; c = alignment; //bipolar with doubt


            //f = Util.lerp(alignment, 0.5, 1); c *= alignment; //half-wave: smooth bipolar with doubt

        } else {
            //TODO abstract these modes to enum parameter
            //f = 1; c = alignment; //full-wave

            //f = Util.sigmoid(polarize(alignment), 8); c = polarity(alignment);  //absolute_analog squashed

            f = Util.sigmoid(polarize(alignment), 8); c = 4 * Util.sqr(alignment - 0.5);  //quadratic_absolute_analog squashed

            //f = alignment; c = polarity(alignment); //Absolute Analog; neutral alignment -> inaction

            //f = alignment; c = 4 * Util.sqr(alignment - 0.5);  //quadratic_absolute_analog: Scaled parabola, peaks at 0 and 1, zero at 0.5

            //f = alignment; c = 0.5 + 2 * Util.sqr(alignment - 0.5);  //semiquadratic_absolute_analog: Scaled parabola, peaks at 0 and 1, 1/2 at 0.5


            //f = alignment; c = alignment; //crossfade

//            f = alignment; c = alignment >= 0.5 ?  //'reflecting dilemma': quadratic_asymmetric_analog: Scaled parabola, peaks at 0 and 1, zero at 0.5
//                   4 * Util.sqr(alignment - 0.5) : // Positive polarity: full range
//                   2 * Util.sqr(alignment - 0.5);  // Negative polarity: half range

              //f = Math.sqrt(alignment); c = Math.sqrt(polarity(alignment)); //Absolute Analog Sqrt

              //f = 0.5f + alignment/2; c = alignment; //crossfade maybe

              //f = 1; c = alignment*alignment; //full-wave quadratic

              //f = alignment; c = 1; //full preference: freq only

              //f = alignment; c = 0.5f + alignment/2; //Absolute Analog + half doubt

//            //Smooth Binary via squashing function, with confidence drop
//            f = PostGoalFn_SquashFactor!=0 ? fSquash(alignment, PostGoalFn_SquashFactor) : alignment;
//            c = lerpSafe(polarity(alignment),
//                //1/4f //paraboloid?
//                1/8f
//                //0
//                //Util.PHI_min_1f
//                //1/2f
//                //1/3f
//                //1/10f
//                //1/100f
//                //TRUTH_EPSILON
//            , 1);
//
//            //Smooth Binary via squashing function
//            //f = fSquash(alignment, NAL.truth.PostGoalFn_SquashFactor); c = polarity(alignment);
//
//
//            //Fading Absolute Analog; neutral alignment -> semi-inaction (positive noise floor)
////            f = alignment; c = Util.lerpSafe(polarity(alignment),
////                    1/4f
////                    //1/2f
////                    //NAL.truth.TRUTH_EPSILON_sqrt
////                , 1);
//
//
//            //Binary - not susceptible to 'vanishing polarity'
//            //f = alignment >= 0.5f ? 1 : 0; c = polarity(alignment);
//
//            //f = alignment; c = polarity(xy);
//            //f = alignment; c = (polarity(xy) + 1 /* exploration 'benefit of the doubt' */ )/2;
//
//            //f = alignment; c = min(polarity(y), polarity(xy));
//            //f = alignment; c = max(polarity(y), polarity(xy));
//            //f = alignment; c = polarity(y) * polarity(xy);
//
//            //f = alignment; c = polarity(alignment); //absolute; neutral alignment -> inaction
        }


        c = confComposeLinear(Y, XimplY, c, !strong); if (c < confMin) return null;

        return tt(f, c);
    }

    public static @Nullable Truth divide(Truth XY, Truth X, double confMin) {
        return divide/*Sym*/(XY, X,
                true,
            //false,
                true,
            confMin);
    }

    public static @Nullable Truth divide(Truth XY, Truth X, boolean overflowDoubt, boolean underflowDoubt, double confMin) {
        var x = X.freq(); if (x < FREQ_EPSILON) /* DIVIDE BY ZERO */ return null;
        var xy = XY.freq();

        double cFactor = 1;


        //if (...) c *= xy;

        var y = Fuzzy.divide(xy, x);
        if (y > 1) {
            if (overflowDoubt)
                cFactor /= y;
            y = 1;
        } else if (y < FREQ_EPSILON) {
            if (underflowDoubt)
                cFactor *= x;
            y = 0;
        }
        var c = confComposeFactor(XY, X, cFactor); if (c < confMin) return null;
        return tt(y, c);
    }

    /**
     * commutative
     * {<M --> S>, <P --> M>} |- <S --> P>
     * {<M ==> S>, <P ==> M>} |- <S ==> P>
     */
    static Truth exemplification(Truth a, Truth b, boolean weak, float confMin) {
        var af = a.freq();
        if (af < FREQ_EPSILON) return null;
        var bf = b.freq();
        if (bf < FREQ_EPSILON) return null;

        var abf = ((double)af) * bf;
        var c =
            confComposeLinear(a, b, abf, weak);
            //confComposeFactor(a, b, abf, weak);

        return c < confMin ? null : tt(1, c);
    }

    /**
     * commutative
     * a 'half-way' exemplification that zeros at freq=0.5
     * @param ap 'a' positive-only filter
     * @param bp 'b' positive-only filter
     */
    static Truth suppose(Truth a, boolean ap, Truth b, boolean bp, boolean weak, float confMin) {

        var af = a.freq();
        if (ap) {
            af = polarize(af);
            if (af <= FREQ_EPSILON_half) return null;
        }
        var bf = b.freq();
        if (bp) {
            bf = polarize(bf);
            if (bf <= FREQ_EPSILON_half) return null;
        }

        var c = confComposeLinear(a, b, af * bf, weak);
        return c < confMin ? null : tt(1, c);
    }

    @Nullable
    public static Truth mix2(Truth t, Truth b, boolean weak, float confMin) {
        return mix2(t, b, NAL.truthFn.MIX_EVI_OR_CONF, weak, confMin);
    }

    /**
     * like mixing two frequencies of light or sound to produce a 3rd that is a compromise of both
     */
    @Nullable
    public static Truth mix2(Truth t, Truth b, boolean eviOrConf, boolean weak, float confMin) {
        float tf = t.freq(), bf = b.freq();

        var alignment = alignment(tf, bf);

        var c = confComposeLinear(t, b, alignment, weak); if (c < confMin) return null;

        double T, B;
        if (eviOrConf) { T = t.evi();  B = b.evi();  }
        else           { T = t.conf(); B = b.conf(); }

        var tb = T / (T + B);
        var f = lerpSafe(tb, bf, tf); //linear interpolate weighed by conf

        return tt(f, c);
    }

    @Deprecated private static double confComposeLinear(Truth x, Truth y, double f, boolean weak) {
        if (!NAL.truthFn.CONF_COMPOSE_LINEAR)
            return confCompose(x, y, f, weak);

        var xy = confCompose(x, y);

        if (weak) xy = weak(xy);

        return f == 1 ? xy : e2c(c2e(xy) * f);
    }

    private static double confCompose(Truth x, Truth y, double f, boolean weak) {
        var xy = confCompose(x, y);

        if (weak) xy = weak(xy);

        return
//          NAL.truthFn.COMPOSE_CONF_CLASSIC ?
            xy * f;
//            :
//            f == 1 ? xy : e2c(c2e(xy) * f);
    }

    public static double confComposeFactor(Truth x, Truth y, double f) {
        return confCompose(x, y, f, false);
    }

    public static double confComposeFactorWeak(Truth x, Truth y, double f) {
        return confCompose(x, y, f, true);
    }

    /** propagates frequency, attenuates conf */
    public static Truth conduct(Truth dir, Truth mag, boolean weak, float confMin) {
        var mf = mag.freq();
        var c = confComposeLinear(mag, dir, mf, weak);
        return c < confMin ? null :
                tt(dir.freq(), c);
    }

    /**
     * SuperConduct - Analogous to a transistor circuit where:
     *    - 'dir' is the incoming signal (input at the base/emitter),
     *    - 'mag' is the gate voltage controlling signal flow (akin to the gate in a FET or base bias in a BJT),
     *    - full/weak flags adjust transistor operation mode,
     *    - and the output signal's confidence can decay over propagation,
     *      similar to signal loss over distance or through imperfect amplification.
     *
     * The parameter {@code full} determines how the nature of the 'dir' signal
     * (unipolar vs. bipolar) influences the output confidence:
     * - When {@code full} is true, the method treats 'dir' as a bipolar signal,
     *   meaning it considers both positive and negative components of the frequency
     *   (similar to a bipolar junction transistor (BJT) that can handle both
     *   positive and negative swings more symmetrically).
     * - When {@code full} is false, it treats 'dir' as a unipolar signal,
     *   using only its magnitude in one direction, which might be likened
     *   to a unipolar field-effect transistor (FET) operation that only responds
     *   to one polarity of voltage at the gate or source.
     *
     * As in real-world electronics, different transistor types or configurations
     * (bipolar vs. unipolar) respond differently to input signals, affecting
     * amplification and propagation characteristics. Here, {@code full} chooses
     * the mode of operation, influencing how strongly 'dir' impacts the confidence.
     *
     * @param dir  The incoming signal's truth, analogous to the input at a transistor's base.
     * @param mag  The gate voltage or bias controlling the transistor,
     *             affecting how 'dir' is allowed to pass or be amplified.
     * @param full When true, treat 'dir' as a bipolar signal (both positive and negative
     *             frequency components influence confidence), similar to a BJT's behavior.
     *             When false, treat 'dir' as a unipolar signal, analogous to a unipolar FET's response.
     * @param weak A flag that mimics lower bias conditions or weaker input
     *             scenarios, affecting the transistor's response.
     * @param confMin The minimum confidence threshold for a successful output,
     *                akin to a cutoff below which the transistor cannot sustain meaningful amplification.
     *
     * @return A new {@code Truth} representing the propagated signal if the confidence
     *         exceeds {@code confMin}, otherwise {@code null}.
     */
    public static Truth superConduct(Truth dir, Truth mag, boolean full, boolean weak, float confMin) {
        // Signal (dir) and Gate (mag) frequencies
        float df = dir.freq(), mf = mag.freq();

        /*
         * Determine how 'dir' contributes to the confidence based on the 'full' flag.
         * - In full mode (bipolar operation), use the polarity-adjusted frequency to consider
         *   both positive and negative influences, akin to a BJT handling bipolar signals.
         * - In non-full mode (unipolar operation), use the raw frequency of 'dir',
         *   similar to a unipolar FET reacting to a single polarity.
         */
        var c = confComposeLinear(mag, dir, (full ? polarity(df) : df) * mf, weak);

        // If the confidence (signal strength) falls below the threshold,
        // the transistor's output is effectively cut off.
        if (c < confMin) return null;

        /*
         * Polarize the directional frequency, shaping the input signal based on gate control.
         * The sigmoid function models the transistor's threshold behavior— a smooth yet sharp
         * transition from off to on, mirroring transistor switching characteristics.
         *
         * Applies sharpness parameter to determine how abruptly the transistor transitions.
         */
        var ss = NAL.truthFn.SUPERCONDUCT_SHARPNESS;
        var F = ss>0 ? Util.sigmoid(polarize(df), ss) : df;

        return tt(F, c);
    }

    /**
     * soft conduct/semi-conduct
     * non-inverting analogy / bi-polarized deduction
     */
    @Deprecated public static Truth biduct(Truth dir, Truth mag, boolean weak, float confMin) {
        float mf = mag.freq(), df = dir.freq();
        var c = confCompose(mag, dir, mf, weak);
        return c < confMin ? null :
                tt(lerpSafe(mf, 0.5, df), c);
    }

    @Is("Ising_model") public static Truth polarduct(Truth dir, Truth mag, boolean weak, float confMin) {
        double df = dir.freq(), mf = mag.freq();
        var c = confCompose(mag, dir, polarity(mf), weak);
        if (c < confMin) return null;

        var f =
            lerpSafe(mf, 1 - df, df) //soft
            //mf >= 0.5 ? df : 1 - df //hard
        ;

        return tt(f, c);
    }

    public static double confReduce(Truth t) {
        return confCompose(t, NAL.truthFn.GULLIBILITY);
        //return confCompose(t, (float) t.conf()); //too strict
    }

    public static @Nullable Truth structuralReduction(Truth T, float confMin) {
        var c = confReduce(T);
        return c < confMin ? null : tt(T.freq(), c);
    }

    @Nullable
    static Truth deductionSym(Truth T, Truth B, boolean strong, float confMin) {
        double tf = T.freq(), bf = B.freq();
        var neg = (1 - tf) * (1 - bf) > tf * bf;
        if (neg) {
            T = T.neg();
            B = B.neg();
        }
        return negIf(deduction(T, B, strong, confMin), neg);
    }

    public static Truth diff(Truth a, Truth b, double confMin) {
        throw new TODO();
//        double c =
//            TruthFunctions.confCompose(a, b);
//            //confComposeFactor(a, b, polarity(sim));
//        return c < confMin ? null :
//            tt(diffCommutative(a.freq(), b.freq()), c);
    }

    /**
      a!, (a <~> b) |- b!

      b_goal(diff, a_goal) has the following properties:

            diff ~= 0:   //freq(a) < freq(b)
               b_goal = a_goal lerp to 0 proportionally to how close df is to 0

            diff ~= 0.5: //freq(a) ~= freq(b)
               b_goal = a_goal

            df ~= 1:     //freq(a) > freq(b)
               b_goal = a_goal lerp to 1 proportionally to how close df is to 1

        Attenuate confidence by ~Math.abs(df - 0.5) to propagate uncertainty
    */
    public static Truth diffGoal(Truth a_goal, Truth diff, double confMin) {
        var c = weak(confCompose(a_goal, diff));

        double df = diff.freq(), gf = a_goal.freq();

        var b_goal = lerpSafe(abs(df - 0.5) * 2, gf, df < 0.5 ? 0 : 1);
        var cFactor = 1 - abs(df - 0.5);

        return c < confMin ? null :
                tt(b_goal, c * cFactor);
    }

    public static double diffCommutative(float a, float b) {
        return unpolarize(a-b);
//        if (a >= b) {
//            return 0.5 + (a - b) / 2;
//        } else {
//            return 0.5 - (b - a) / 2;
//        }
    }

    /** result confidence (and optionally frequency)
     *  is proportional to input freq alignments */
    public static Truth sameness(Truth a, Truth b, boolean flat, boolean weak, double confMin) {
        var c = confCompose(a, b);
        if (c < confMin) return null;

        var f = alignment(a.freq(), b.freq());
        c *= f;

        if (weak) c = weak(c);

        if (c < confMin) return null;

        return tt(flat ? 1 : f, c);
    }

    static boolean symNegates(Truth T, Truth B) {
        return symNegates(T.freq(), B.freq());
    }

    private static boolean symNegates(float tf, float bf) {
        return tf*bf < (1-tf)*(1-bf);
    }

    /** TODO test */
    @Nullable static Truth xor(Truth T, Truth B, float confMin) {
        var c = confCompose(T, B);
        if (c < confMin) return null;

        float tf = T.freq(), bf = B.freq();
        //                f,c
        //tf+ & bf+ => bf 1,0
        //tf+ & bf- => bf 1,1
        //tf- & bf+ => bf 0,1
        //tf- & bf- => bf 0,0

        var diff =
            Fuzzy.xor(tf, bf);
        //1 - Fuzzy.xnrNorm(tf, bf);

        c *= diff;
        if (c < confMin) return null;

        double f = tf;
        //1;
        //Util.lerpSafe(diff, 0.5, tf);
        //Util.lerpSafe(polarity(tf)*polarity(bf), 0.5, tf);
        //Util.lerpSafe(polarity(bf), 0.5, tf);

        return tt(f, c);
    }

    public static float delta(float Sfreq, float Efreq) {
        return unpolarize(Efreq - Sfreq);
    }

    /** 'positive' quadrant intersection
     * @param x (sub-)condition
     * @param conj (super-)conditions
     * */
    @Nullable public static Truth must(Truth x, boolean xHalf, Truth conj, boolean conjHalf, boolean weak, float confMin) {
        var xf = x.freq();
        double XF = xHalf ? polarize(xf) : xf;
        if (XF < FREQ_EPSILON_half) return null;

        var cf = conj.freq();
        double CF = conjHalf ? polarize(cf) : cf;
        if (CF < FREQ_EPSILON_half) return null;

        double F, C;

        //mode hard strong: (exemplification-like)
        F = 1;  C = xf * cf;

        //mode soft:
        //F= unpolarize(XF * CF); C = F;

        //mode medium: pretends X component is 1, and instead it affects conf
        //F = unpolarize( CF); C = XF * F;

        //mode hard: (semi-exemplification-like)
        //F = 1;  C = XF * CF;

        var c = confCompose(x, conj, C, weak); if (c < confMin) return null;
        return tt(F, c);
    }

    @Nullable public static Truth subtract(Truth a, Truth b, float confMin) {
        float af = a.freq(), bf = b.freq();
        var df = af - bf;
        if (df <= 0) return null;

        var c =
            confComposeFactor(a, b, df);
        return c < confMin ? null :
            tt(1, c);
    }

    @Override
    public final Term term() {
        return term;
    }

    @Override
    public final boolean single() {
        return single;
    }

    @Override
    public final boolean allowOverlap() {
        return overlap;
    }

}
;


//    public static double confRevise(Truth a, Truth b) {
//        return eviReviseToConf(a.evi(), b.evi());
//    }

//    private static double confRevise(double cx, double cy) {
//        //return confCompose(cx, cy);
//        return eviReviseToConf(c2e(cx),c2e(cy));
//    }
//    private static double eviReviseToConf(double ex, double ey) {
//        return e2c(ex+ey);
//    }


//    /**
//     * point-segment-segment relative projection formula
//     * TODO test
//     */
//    public static double project0(long now, long fs, long fe, long ts, long te, float dur, double memoryFactor) {
//        if (fs == ETERNAL) return 1;
//
//        assert (ts != ETERNAL);
//
//        /* source surrounds or equals target */
//        if (fs <= ts && fe >= te)
//            return 1;
//
//        //long ft = LongInterval.minTimeShiftTo(fs, fe, ts, te);
//        //long ft = abs( (fs + fe)/2 - (ts + te)/2 ); //midpoint delta
//        long ft;
//                //(minTimeToRaw(ts, fs, fe) + minTimeToRaw(te, fs, fe))/2.0;
//                //min(minTimeToRaw(ts, fs, fe), minTimeToRaw(te, fs, fe));
//        //if (LongInterval.containsRaw(ts, te, fs, fe)) { // target surrounds source
//            ft = abs( ((fs+fe)/2 - (ts+te)/2)); //midpoint difference

//    /**
//     * {<M ==> S>, <M ==> P>} |- <S <=> P>
//     *
//     * @param a Truth value of the first premise
//     * @param b Truth value of the second premise
//     * @return Truth value of the conclusion
//     */
//    @Nullable
//    private static Truth comparison(Truth a, boolean negA, Truth b, float minConf) {
//        float cc = TruthFunctions.confCompose(a, b);
//        if (cc < minConf) return null;
//
//        float f1 = a.freq();
//        if (negA) f1 = 1 - f1;
//
//        float f2 = b.freq();
//
//
//        float f0 =
//                //or(f1, f2);
//                Math.max(and(f1, f2), and(1 - f1, 1 - f2));
//        float c = w2cSafe(and(f0, cc));
//        if (!(c >= minConf))
//            return null;
//
//        //float f = (Util.equals(f0, 0, NAL.truth.TRUTH_EPSILON)) ? 0 : (and(f1, f2) / f0);
//        return tt(f0, c);
//    }


//    private static double freqExpandTanh(double f, float contrast, float margin) {
//        return Fuzzy.unpolarize(
//                Math.tanh(Fuzzy.polarize(f) * contrast) * (1.0 + margin)
//        );
//    }

//    private static double freqExpandSigmoid(double f, float contrast) {
//        return Util.unitizeSafe(Util.sigmoid(Fuzzy.polarize(f) * contrast));
//    }


//    public static @Nullable Truth divideSym(Truth XY, Truth X, float confMin) {
//        if (XY.NEGATIVE())
//            return neg(divide(XY.neg(), X.neg(), confMin));
//        else
//            return divide(XY, X, confMin);
//    }

//    /** untested */
//    public static @Nullable Truth divideSym(Truth XY, Truth X, boolean overflowDoubt, boolean underflowDoubt, float confMin) {
//        if (XY.NEGATIVE()) {
//            XY = XY.neg();
//            var y = divide(XY, X.neg(), overflowDoubt, underflowDoubt, confMin);
//            if (y == null)
//                return null;
//
//            return y.negThis();
//        } else
//            return divide(XY, X, overflowDoubt, underflowDoubt, confMin);
//    }

//    /**
//     * EXPERIMENTAL
//     * variation of the original union truth function that
//     * decreases confidence in proportion to the information lost
//     * by one component's higher frequency masking the other
//     * component's lower frequency.  if the components
//     * have equal frequencies then no loss is involved.
//     */
//    public static Truth unionFair(Truth t, Truth b, float confMin) {
//        double c = confCompose(t, b); if (c < confMin) return null;
//
//        float tf = t.freq(), bf = b.freq();
//        float f = Fuzzy.or(tf, bf);
//        if (f < TRUTH_EPSILON)
//            return null;
//
//        float loss = abs((f - tf) - (f - bf));
//        float lossFraction = loss / f;
//        c *= 1 - lossFraction;
//        return c < confMin ? null : tt(f, c);
//    }


//    /**
//     * new bipolar analogy
//     */
//    @Nullable
//    public static Truth analogyBipolar(Truth x, Truth a, float confMin) {
//        double af = a.freq();
//
//        double c = confCompose(x, a) * polarity(af);
//        if (c < confMin) return null;
//
//        double xf = x.freq();
//        double F = lerpSafe(af, 1 - xf, xf);
//        return tt(F, c);
//    }



//    /**
//     * freq symmetric intersection
//     * to the degree the freq is the same, the evidence is additive
//     * to the degree the freq is different, the evidence is multiplicative
//     * resulting freq is weighted combination of inputs
//     */
//    public static Truth intersectionX(Truth a, Truth b, float confMin) {
//        float diff = Math.abs(a.freq() - b.freq());
//        float ac = a.conf(), bc = b.conf();
//        float conf = Util.lerp(diff, w2cSafe(c2wSafe(ac) + c2wSafe(bc)), (ac * bc));
//        float freq = ((a.freq() * ac) + (b.freq() * bc)) / (ac + bc);
//        return conf >= confMin ? $.t(freq, conf) : null;
//    }

//    /**
//     * freq symmetric difference
//     * to the degree the freq differs or is similar, the evidence is additive
//     * to the degree the freq is not different nor similar, the evidence is multiplicative
//     * resulting freq is weighted difference of inputs
//     */
//    public static Truth differenceX(Truth a, Truth b, float confMin) {
//        float extreme = 2f * Math.abs(0.5f - Math.abs(a.freq() - b.freq()));
//        float ac = a.conf(), bc = b.conf();
//        float conf = Util.lerp(extreme, (ac * bc), w2cSafe(c2wSafe(ac) + c2wSafe(bc)));
//
//        float freq = a.freq() * (1f - b.freq());
//        return conf >= confMin ? $.t(freq, conf) : null;
//    }

//    public static Truth unionX(Truth a, Truth b, float confMin) {
//        Truth z = intersectionX(a.neg(), b.neg(), confMin);
//        return z != null ? z.neg() : null;
//    }

//    @Nullable
//    public static Truth deduction(Truth a, float bF, float bC, float confMin) {
//
//
//        float f = and(a.freq(), bF);
//
//
//        float aC = a.conf();
//
//        float c = Util.lerp(bC/(bC + aC), 0 ,aC);
//
//        return c >= confMin ? tt(f, c) : null;
//    }

//    @Nullable
//    public static Truth deduction(Truth a, float bF, float bC, float confMin) {
//
//        float f;
//        float aF = a.freq();
////        if (bF >= 0.5f) {
////            f = Util.lerp(bF, 0.5f, aF);
////        } else {
////            f = Util.lerp(bF, 0.5f, 1- aF);
////        }
//        f = Util.lerp(bF, 1-aF, aF);
//
//        float p = Math.abs(f - 0.5f)*2f; //polarization
//
//        float c = //and(/*f,*/ /*p,*/ a.conf(), bC);
//                    TruthFunctions.confCompose(a.conf(), bC);
//
//        return c >= confMin ? tt(f, c) : null;
//    }
//
//    /**
//     * {<S ==> M>, <P ==> M>} |- <S ==> P>
//     *
//     * @param a Truth value of the first premise
//     * @param b Truth value of the second premise
//     * @return Truth value of the conclusion, or null if either truth is analytic already
//     */
//    public static Truth induction(Truth a, Truth b, float confMin) {
//        float c = w2cSafe(a.conf() * b.freqTimesConf());
//        return c >= confMin ? $.t(a.freq(), c) : null;
//    }

//
//    /**
//     * frequency determined entirely by the desire component.
//     */
//    @Nullable
//    public static Truth desireNew(Truth goal, Truth belief, float confMin, boolean strong) {
//
//        float c = and(goal.conf(), belief.conf(), belief.freq());
//
//        if (!strong) {
//            //c *= TruthFunctions.w2cSafe(1.0f);
//            c = w2cSafe(c);
//        }
//
//        if (c >= confMin) {
//
//
//            float f = goal.freq();
//
//            return $.t(f, c);
//
//        } else {
//            return null;
//        }
//    }

//    /**
//     * experimental
//     */
//    public static @Nullable Truth educt(Truth goal, Truth belief, boolean strong, float confMin) {
//
//        double cc = confCompose(belief, goal);
//        if (cc < confMin) return null;
//
//
//        double bF = belief.freq();
//        float gF = goal.freq();
//
//        cc *= (bF);
//        if (cc < confMin) return null;
//        if (!strong) {
//            cc = weak(cc);
//            if (cc < confMin) return null;
//        }
//
//        double f =
//                lerpSafe(bF, 1 - gF, gF);
////                lerpSafe(bF, 0.5, gF);
//
//        return tt((float) f, cc);
//
//    }

//    public static @Nullable Truth demand(Truth goal, Truth condition, float confMin, boolean strong) {
//
//        double cc = confCompose(goal, condition);
//        if (cc < confMin) return null;
//        if (!strong) {
//            cc = weak(cc);
//            if (cc < confMin) return null;
//        }
//
//        double cF = condition.freq();
//        float gF = goal.freq();
//
//        float f =
//                gF;
////                cF >= 0.5f ? gF : 1-gF;
//        //gF >= 0.5f ?  +1 : 0;
//        //(float) cF;
//        //(float) a;
//        //1;
//
//        double a =
////                polarity(cF) * gF;
//                cF;
//        //cF * gF;
//        //cF * polarity(gF);
//        //gF;
//        //Util.lerpSafe((float) (cF * gF), 0.5f, 1);
//        //Math.sqrt(cF * gF);
//        //1;
//
//        cc *= a;
//        if (cc < confMin) return null;
//
//
//        return tt(f, cc);
//    }