package nars.io;

import com.google.common.io.ByteArrayDataOutput;
import jcog.data.IntCoding;
import nars.$;
import nars.Narsese;
import nars.Op;
import nars.Term;
import nars.term.atom.*;
import nars.term.builder.TermBuilder;
import nars.term.util.TermException;

import java.io.DataInput;
import java.io.IOException;

import static nars.Op.*;
import static nars.io.IO.SPECIAL_BYTE;
import static nars.io.IO.encoding;
import static nars.term.atom.Bool.Null;

/**
 * term i/o codec
 */
public abstract class TermIO {

    public static void writeCompoundPrefix(byte opByte, int dt, ByteArrayDataOutput out) {

        var dtSpecial = false;
        if (dt != DTERNAL/* && o.temporal*/) {
            switch (dt) {
                case XTERNAL -> opByte |= DefaultTermIO.TEMPORAL_BIT_0;
                case 0 -> opByte |= DefaultTermIO.TEMPORAL_BIT_0 | DefaultTermIO.TEMPORAL_BIT_1;
                default -> {
                    opByte |= DefaultTermIO.TEMPORAL_BIT_0 | DefaultTermIO.TEMPORAL_BIT_1;
                    dtSpecial = true;
                }
            }
        }
        out.writeByte(opByte);
        if (dtSpecial)
            DefaultTermIO.writeDT(dt, out);
    }

    public abstract Term read(TermBuilder B, DataInput in) throws IOException;

    public static void writeSubterms(ByteArrayDataOutput out, Term... subs) {
        //assert(subs.length < Byte.MAX_VALUE);
        out.writeByte(subs.length);
        for (var s : subs)
            s.write(out);
    }

    /**
     * default term codec
     */
    public static final TermIO the = new DefaultTermIO();

    private static final class DefaultTermIO extends TermIO {

        /** lower 5 bits (bits 0..4) = base op */
        private static final byte OP_MASK = (0b00011111);
        /** upper control flags for the op byte */
        private static final byte TEMPORAL_BIT_0 = 1 << 5, TEMPORAL_BIT_1 = 1 << 6;

        static {
            var v = values();
            assert(v.length < OP_MASK);
            for (var o : v) assert !o.temporal || (o.id != OP_MASK); /* sanity test to avoid temporal Op id appearing as SPECIAL_BYTE if the higher bits were all 1's */
        }

        @Override
        public Term read(TermBuilder B, DataInput in) throws IOException {
            byte b;
            b = in.readByte();
            //while ((b = in.readByte()) == 0) { /* Skip zero padding */ }
            return b == SPECIAL_BYTE ? readSpecial(in) : read(B, in, b);
        }

        private Term read(TermBuilder B, DataInput in, byte b) throws IOException {
            var o = op(b & OP_MASK);
            return switch (o) {
                case VAR_DEP, VAR_INDEP, VAR_PATTERN, VAR_QUERY -> $.v(o, in.readByte());
                case IMG -> readImage(in);
                case BOOL -> readBool(in);
                case ATOM -> readAtom(in, b);
                case INT -> readInt(in);
                case NEG -> read(B, in).neg();
                default -> read(B, in, b, o);
            };
        }

        private static Img readImage(DataInput in) throws IOException {
            return in.readByte() == ((byte) '/') ? ImgExt : ImgInt;
        }

        private static Int readInt(DataInput in) throws IOException {
            return Int.i(IntCoding.readZigZagInt(in));
        }

        private static Term readAtom(DataInput in, byte opByte) throws IOException {
            return switch (encoding(opByte)) {
                case 0 -> Atomic.atomic(in.readUTF());
                case 1 -> Anom.anom(in.readByte());
                case 2 -> BytesAtom.atomBytes(in);
                default -> throw new IOException("invalid ATOM");// encoding: " + encoding(opByte));
            };
        }

        private static Term readBool(DataInput in) throws IOException {
            return switch (in.readByte()) {
                case -1 -> Null;
                case 0 -> Bool.False;
                case +1 -> Bool.True;
                default -> throw new IOException("invalid BOOL");
            };
        }

        private static Term readSpecial(DataInput in) throws IOException {
            try {
                return Narsese.term(in.readUTF(), false);
            } catch (Narsese.NarseseException e) {
                throw new IOException(e);
            }
        }

        private Term read(TermBuilder B, DataInput in, byte opByte, Op o) throws IOException {
            var dt = readDT(in, opByte);

            int n = in.readByte();
            //assert (subterms < NAL.term.SUBTERMS_MAX);

            var s = new Term[n];
            for (var i = 0; i < n; i++)
                if ((s[i] = read(B, in)) == null)
                    throw new TermException("read invalid", PROD /* consider the termvector as a product */, s);

            return o.build(B, dt, s);
        }

        private static int readDT(DataInput in, byte opByte) throws IOException {
            return switch ((opByte & (TEMPORAL_BIT_0 | TEMPORAL_BIT_1)) >> 5) {
                case 0 -> DTERNAL;
                case 1 -> XTERNAL;
                case 2 -> 0;
                default -> IntCoding.readZigZagInt(in);
            };
        }

        static void writeDT(int dt, ByteArrayDataOutput out) {
            IntCoding.writeZigZagInt(dt, out);
        }
    }

    public static void outNegByte(ByteArrayDataOutput out) {
        out.writeByte(NEG.id);
    }

}