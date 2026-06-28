package nars.io;

import nars.NAL;
import nars.Op;
import nars.Term;
import nars.subterm.Subterms;
import nars.term.Compound;
import nars.term.Neg;
import nars.term.atom.Atomic;

import java.io.IOException;
import java.util.function.UnaryOperator;

import static nars.Op.*;

/**
 * prints readable forms of terms
 */
public record TermAppendable(Appendable p) {

    private void compoundAppend(Compound c, Op op) throws IOException {

        compoundOpen();

        op.append(c, p);

        Subterms cs = c.subterms();
        if (cs.subs() == 1)
            argSep();

        appendArgs(cs);

        compoundClose();

    }

    /**
     * auto-infix if subs == 2
     */
    private void compoundAppend(String o, Subterms c, UnaryOperator<Term> filter) throws IOException {

        compoundOpen();

        int n = c.subs();
        if (n == 2) {


            appendArg(c, 0, filter);

            int l = o.length();
            if (l > 0 && o.charAt(l - 1) == ' ')
                append(' '); //prepend ' '

            append(o);

            appendArg(c, 1, filter);

        } else {

            append(o);

            if (n == 1)
                argSep();

            appendArgs(c, filter);
        }

        compoundClose();

    }


    private void appendArgs(Subterms c) throws IOException {
        int nterms = c.subs();

        boolean bb = nterms > 1;
        for (int i = 0; i < nterms; i++) {
            if ((i != 0) || bb)
                argSep();
            append(c.sub(i));
        }
    }

    private void appendArgs(Subterms c, UnaryOperator<Term> filter) throws IOException {
        int nterms = c.subs();

        boolean bb = nterms > 1;
        for (int i = 0; i < nterms; i++) {
            if ((i != 0) || bb)
                argSep();

            appendArg(c, i, filter);
        }
    }

    private void argSep() throws IOException {
        append(ARGUMENT_SEPARATOR);
    }

    private void appendArg(Subterms c, int i, UnaryOperator<Term> filter) throws IOException {
        append(filter.apply(c.sub(i)));
    }

    private void append(Compound c) throws IOException {
        Op op = c.op();

        switch (op) {

            case SETi:
            case SETe:
                setAppend(c);
                return;
            case PROD:
                productAppend(c.subtermsDirect());
                return;
            case DELTA:
                deltaAppend(c.sub(0));
                return;
            case NEG:
                negAppend(c.unneg());
                return;
            case EQ:
                eqAppend(c.subtermsDirect());
                return;

            default:
                if (op.statement || c.subs() == 2)
                    statementAppend(c, op);
                else
                    compoundAppend(c, op);
                break;
        }

    }

    private void deltaAppend(Term sub) throws IOException {
        append(DELTA.str);
        append(sub);
    }

    private void eqAppend(Subterms ab) throws IOException {
        Term a = ab.sub(0), b = ab.sub(1);
        compoundOpen();
        append(a);
        append('=');
        append(b);
        compoundClose();
    }

    private void negAppend(Term sub) throws IOException {
        /*
         * detect a negated conjunction of negated subterms:
         * (--, (&&, --A, --B, .., --Z) )
         */

        if (sub.CONJ() && sub.hasAny(NEG.bit)) {
            int dt;
            if ((((dt = sub.dt()) == DTERNAL) || (dt == XTERNAL))) {
                Subterms cxx = sub.subterms();
                if ((cxx.hasAny(NEG) ? cxx.count(x -> x instanceof Neg /* && !x.hasAny(CONJ)*/) : 0) >= cxx.subs() / 2) {
                    disjAppend(cxx, dt);
                    return;
                }
            }
        }

        append("(--,");
        append(sub);
        compoundClose();
    }

    private void disjAppend(Subterms cxx, int dt) throws IOException {
        compoundAppend(disjStr(dt), cxx, Term::neg);
    }

    private static String disjStr(int dt) {
        return switch (dt) {
            case XTERNAL -> DISJstr + "+- ";
            case DTERNAL -> DISJstr;
            default -> throw new UnsupportedOperationException();
        };
    }


    private void statementAppend(Term x, Op op  /**/) throws IOException {

        Subterms xx = x.subterms();

        Term subj = xx.sub(0), pred = xx.sub(1);

        if (op == INH) {

            if (pred.ATOM()) {
                if (xx.hasAll(FuncInnerBits)) {
                    if (subj.PROD()) {
                        operationAppend((Compound) subj, (Atomic) pred);
                        return;
                    }
                }
            }


            /* no inner INH, HACK*/
            if (NAL.term.INH_PRINT_COMPACT) {
                if (!subj.INH() && !pred.INH()) {
                    //if (pred.isAny(AtomicConstant)) {
                    //pred
                    append(pred);
                    append(':');
                    //subj
                    append(subj);
                    return;
                }
            }
        }


        int dt = x.dt();

        boolean reversedDT = op.commutative && dt != DTERNAL && /*dt != XTERNAL && */ dt < 0;

        compoundOpen();

        append(reversedDT ? pred : subj);

        op.append(dt, p, reversedDT);

        append(reversedDT ? subj : pred);

        compoundClose();
    }

    private Appendable compoundClose() throws IOException {
        return p.append(COMPOUND_CLOSE);
    }

    private Appendable compoundOpen() throws IOException {
        return p.append(COMPOUND_OPEN);
    }


    private void productAppend(Subterms product) throws IOException {
        compoundOpen();
        appendSubterms(product);
        compoundClose();
    }

    private void appendSubterms(Subterms x) throws IOException {
        int s = x.subs();
        for (int i = 0; i < s; i++) {
            append(x.sub(i));
            if (i < s - 1)
                append(',');
        }
    }

    private void setAppend(Compound set) throws IOException {

        int len = set.subs();


        char opener, closer;
        if (set.SETe()) {
            opener = SETe.ch;
            closer = SETe_CLOSE;
        } else {
            opener = SETi.ch;
            closer = SETi_CLOSE;
        }

        append(opener);

        Subterms setsubs = set.subtermsDirect();
        for (int i = 0; i < len; i++) {
            if (i != 0) argSep();
            append(setsubs.sub(i));
        }
        append(closer);
    }

    private void operationAppend(Compound argsProduct, Atomic operator) throws IOException {

        append(operator);

        compoundOpen();

        int n = argsProduct.subs();
        for (int i = 0; i < n; i++) {
            if (i != 0)
                argSep();
            append(argsProduct.sub(i));
        }

        compoundClose();

    }


    private void append(char c) throws IOException {
        p.append(c);
    }

    private void append(String s) throws IOException {
        p.append(s);
    }

    public Appendable appendSafe(Term x) {
        try {
            append(x);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        return p;
    }

    private void append(Term x) throws IOException {
        if (x instanceof Atomic) {
            append((Atomic) x);
        } else {
            append((Compound) x);
        }
    }

    private void append(Atomic term) throws IOException {
        if (term instanceof Atomic aa) {
            byte[] aaBytes = aa.bytes;
            if (aaBytes.length == 3 + 1) {
                append((char) aaBytes[3]);
                return;
            }
        }

        append(term.toString());
    }

}