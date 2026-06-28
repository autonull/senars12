package nars.io;

import jcog.data.list.Lst;
import nars.*;
import nars.term.Compound;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;


abstract public class NarseseTest {

    static <T extends Term> T term(String s) throws Narsese.NarseseException {
        return (T) Narsese.term(s);
    }


    static void testProductABC(Compound p) {
        assertEquals(3, p.subs(), () -> p + " should have 3 sub-terms");
        assertEquals("a", p.sub(0).toString());
        assertEquals("b", p.sub(1).toString());
        assertEquals("c", p.sub(2).toString());
    }


    static void taskParses(String s) throws Narsese.NarseseException {
        Task t = task(s);
        assertNotNull(t);


    }


    static List<Task> tasks(String s) throws Narsese.NarseseException {


		List<Task> l = (List<Task>) new Lst(1);
        Narsese.tasks(s, l, new DummyNAL());
        return l;
    }


    static NALTask task(String s) throws Narsese.NarseseException {
        List l = tasks(s);
        if (l.size() != 1)
            throw new RuntimeException("Expected 1 task, got: " + l);
        return (NALTask) l.getFirst();
    }

    static void testTruth(String t, float freq, float conf) throws Narsese.NarseseException {
        String s = "a:b. " + t;

        Truth truth = task(s).truth();
        assertEquals(freq, truth.freq(), 0.001);
		assertEquals(conf, (float) truth.conf(), 0.001);
    }

    public static void assertInvalidTasks(String... inputs) {
        for (String s : inputs) {
            assertThrows(Exception.class, () -> {
                Task e = task(s);
            });
        }
    }


//    public static void assertInvalidTasks(Supplier<Task> s) {
//
//        try {
//            s.get();
//            fail("");
//        } catch (TaskException good) {
//            assertTrue(true);
//        } catch (Exception e) {
//            fail(e::toString);
//        }
//
//    }


}