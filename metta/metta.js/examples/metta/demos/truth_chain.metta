; Truth Chain Demo - Multi-step deduction with confidence propagation
; Demonstrates: Truth value propagation, confidence decay, NAL deduction rules

; Knowledge base with initial truth values
; Format: (statement :tv (freq confidence))

(Inh Socrates Human :tv (0.9 0.9))
(Inh Human Mortal :tv (0.9 0.9))
(Inh Plato Human :tv (0.9 0.85))
(Inh Mortal Rational :tv (0.7 0.8))
(Inh Rational Animal :tv (0.8 0.75))

; Deduction rule: If A->B and B->C, then A->C
; Truth value calculation follows NAL formula
(= (deduce-transitive (Inh $a $b :tv ($f1 $c1)) (Inh $b $c :tv ($f2 $c2)))
   (Inh $a $c :tv (calculate-deduction-tv $f1 $c1 $f2 $c2)))

; NAL truth value calculation for deduction
(= (calculate-deduction-tv $f1 $c1 $f2 $c2)
   (; frequency combines with geometric mean
    (* $f1 $f2)
    ; confidence decreases: c1*c2
    (* $c1 $c2)))

; Induction rule: If A->B and A->C, then B->C (with lower confidence)
(= (induce (Inh $a $b :tv ($f1 $c1)) (Inh $a $c :tv ($f2 $c2)))
   (Inh $b $c :tv (calculate-induction-tv $f1 $c1 $f2 $c2)))

(= (calculate-induction-tv $f1 $c1 $f2 $c2)
   (; frequency estimate
    $f2
    ; confidence reduced for induction
    (* 0.5 (* $c1 $c2))))

; Revision: Combine two beliefs about the same statement
(= (revise (Inh $a $b :tv ($f1 $c1)) (Inh $a $b :tv ($f2 $c2)))
   (Inh $a $b :tv (calculate-revision-tv $f1 $c1 $f2 $c2)))

(= (calculate-revision-tv $f1 $c1 $f2 $c2)
   (; weighted average of frequencies
    (/ (+ (* $f1 $c1) (* $f2 $c2)) (+ $c1 $c2))
    ; combined confidence
    (+ $c1 $c2 (* -1 $c1 $c2))))

; Multi-step deduction chain: Socrates -> Human -> Mortal
(println "Starting truth chain demo...")
(println "Initial beliefs:")
(println "(Inh Socrates Human :tv (0.9 0.9))")
(println "(Inh Human Mortal :tv (0.9 0.9))")

; Step 1: Apply deduction rule
(= $step1 (match &self (Inh Socrates Human :tv ($f $c))
                    (deduce-transitive
                      (Inh Socrates Human :tv ($f $c))
                      (Inh Human Mortal :tv (0.9 0.9)))))

(println "")
(println "After step 1 (Socrates -> Human -> Mortal):")
(println $step1)

; Extract truth values for display
(= (display-tv (Inh $a $b :tv ($f $c)))
   (do (println "Statement: (Inh" $a $b ")")
       (println "Frequency:" $f ", Confidence:" $c)
       (println "Combined truth value:" (* $f $c))))

(display-tv $step1)

; Longer chain: Socrates -> Human -> Mortal -> Rational
(= $chain-step1 (match &self (Inh Socrates Human :tv ($f $c))
                           (deduce-transitive
                             (Inh Socrates Human :tv ($f $c))
                             (Inh Human Mortal :tv (0.9 0.9)))))

(= $chain-step2 (if (not (= $chain-step1 ()))
                   (deduce-transitive $chain-step1 (Inh Mortal Rational :tv (0.7 0.8)))
                   ()))

(println "")
(println "Longer chain: Socrates -> Human -> Mortal -> Rational")
(println "Step 2 result:")
(println $chain-step2)

(if (not (= $chain-step2 ()))
    (display-tv $chain-step2)
    (println "Inference failed"))

; Demonstrate confidence decay over multiple steps
(= (trace-confidence-decay $start-freq $start-conf $steps)
   (if (= $steps 0)
       (: (step 0 $start-freq $start-conf) ())
       (: (step $steps $start-freq $start-conf)
          (trace-confidence-decay $start-freq (* $start-conf 0.9) (- $steps 1)))))

(println "")
(println "Confidence decay over 5 steps (starting from freq=0.9, conf=0.9):")
(= $decay-trace (trace-confidence-decay 0.9 0.9 5))
(map (λ $s (show-decay-step $s)) $decay-trace)

(= (show-decay-step (step $n $f $c))
   (println "Step" $n ": freq=" $f ", conf=" $c ", combined=" (* $f $c)))

; Test revision operation
(println "")
(println "Testing revision operation:")
(println "Original: (Inh Cat Mammal :tv (0.8 0.7))")
(println "New evidence: (Inh Cat Mammal :tv (0.9 0.6))")

(= $original (Inh Cat Mammal :tv (0.8 0.7)))
(= $new-evidence (Inh Cat Mammal :tv (0.9 0.6)))

; Add both to space and try to match
(add-atom $original)
(add-atom $new-evidence)

(= $revised (revise $original $new-evidence))
(println "Revised belief:" $revised)
(if (not (= $revised ()))
    (display-tv $revised)
    (println "Revision failed"))

; Summary
(println "")
(println "Truth chain demo completed!")
(println "Note how confidence decreases with each inference step")
(println "This prevents overconfidence in long reasoning chains")