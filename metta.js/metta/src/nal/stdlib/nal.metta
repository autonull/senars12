
; nal.metta - Non-Axiomatic Logic Rules

; Deduction Rule
; Deduction Rule
; (Inh S M (f1 c1)) + (Inh M P (f2 c2)) -> (Inh S P (f c))
(= (deduce (Inh $s $m $tv1) (Inh $m $p $tv2))
   (Inh $s $p (truth-ded $tv1 $tv2)))

; Induction Rule
; (Inh S M (f1 c1)) + (Inh P M (f2 c2)) -> (Inh S P (truth-ind $tv1 $tv2))
(= (induce (Inh $s $m $tv1) (Inh $p $m $tv2))
   (Inh $s $p (truth-ind $tv1 $tv2)))

; Abduction Rule
; (Inh M S (f1 c1)) + (Inh M P (f2 c2)) -> (Inh S P (truth-abd $tv1 $tv2))
(= (abduce (Inh $m $s $tv1) (Inh $m $p $tv2))
   (Inh $s $p (truth-abd $tv1 $tv2)))

; Comparison Rule
; (Inh M S (f1 c1)) + (Inh M P (f2 c2)) -> (Sim S P (truth-comp $tv1 $tv2))
(= (compare (Inh $m $s $tv1) (Inh $m $p $tv2))
   (Sim $s $p (truth-comp $tv1 $tv2)))

; Resemblance Rule
; (Sim S M (f1 c1)) + (Sim M P (f2 c2)) -> (Sim S P (truth-resemblance $tv1 $tv2))
(= (resemble (Sim $s $m $tv1) (Sim $m $p $tv2))
   (Sim $s $p (truth-resemblance $tv1 $tv2)))

; Conversion Rule
; (Inh S P (f c)) -> (Inh P S (truth-conv (f c)))
(= (convert (Inh $s $p $tv))
   (Inh $p $s (truth-conv $tv)))

; Contraposition Rule  
; (Impl A B (f c)) -> (Impl (Not B) (Not A) (truth-contraposition (f c)))
(= (contrapose (Impl $a $b $tv1) $tv2)
   (Impl (Not $b) (Not $a) (truth-contraposition $tv1 $tv2)))

; Negation
; (Statement S (f c)) -> ((Not S) (truth-neg (f c)))
(= (negate (Statement $s $tv))
   (Statement (Not $s) (truth-neg $tv)))

; Backward inference / Query
; If we want to find (Inh S P), we can look for M s.t. (Inh S M) and (Inh M P) exists.
(= (query-derive (Inh $s $p))
   (match &self (Inh $s $m $tv1)
     (match &self (Inh $m $p $tv2)
        (deduce (Inh $s $m $tv1) (Inh $m $p $tv2)))))

; === Temporal Reasoning Stubs ===
; These provide placeholders for future NAL-7 temporal reasoning

; Temporal sequence: A happens before B
; (Seq A B (f c)) represents that A precedes B
(= (sequence $a $b $tv)
   (Seq $a $b $tv))

; Temporal persistence: A remains true over interval
; (Per A interval (f c))
(= (persist $a $interval $tv)
   (Per $a $interval $tv))

; Temporal causation: A causes B
; (Cau A B (f c))
(= (causation $a $b $tv)
   (Cau $a $b $tv))

; Temporal Induction: (Seq A B) + (Seq A B) -> (Cau A B)
; Derives causation from repeated sequence observations
(= (temporal-induce (Seq $a $b $tv1) (Seq $a $b $tv2))
   (Cau $a $b (truth-ind $tv1 $tv2)))
