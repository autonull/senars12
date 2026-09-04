
; truth.metta - Truth Value Operations
; Implements NAL truth functions for frequency and confidence

; Constructor helpers
(= (Truth $f $c) ($f $c))

; Deduction: AB, BC -> AC
; f = f1 * f2
; c = c1 * c2 * f1 * f2
; Note: Standard NAL is f=f1*f2, c=c1*c2. This implementation (c * f1 * f2) is a stronger form (deduction requires premises to be true).
; Updating to standard NAL-1 match: f=f1*f2, c=c1*c2
(= (truth-ded ($f1 $c1) ($f2 $c2))
   ((&* $f1 $f2) (&* $c1 $c2)))

; Induction: AB, CB -> AC
; f = f1
; c = (f2 * c1 * c2) / (f2 * c1 * c2 + 1)
; Standard NAL: c = w / (w+1) where w = f2 * c1 * c2
(= (truth-ind ($f1 $c1) ($f2 $c2))
   (let $w (&* (&* $f2 $c1) $c2)
     ($f1 (&/ $w (&+ $w 1)))))

; Abduction: BA, CA -> BC
; f = f2
; c = (f1 * c1 * c2) / (f1 * c1 * c2 + 1)
; Standard NAL: c = w / (w+1) where w = f1 * c1 * c2
(= (truth-abd ($f1 $c1) ($f2 $c2))
   (let $w (&* (&* $f1 $c1) $c2)
     ($f2 (&/ $w (&+ $w 1)))))

; Comparison: AB, AC -> BC
; f = (f1 * f2) / (f1 + f2 - f1 * f2)
; c = w / (w+1) where w = (c1 * c2 * (f1 + f2 - f1 * f2))
(= (truth-comp ($f1 $c1) ($f2 $c2))
   (let $f0 (&- (&+ $f1 $f2) (&* $f1 $f2))
     (let $w (&* (&* $c1 $c2) $f0)
       ((&/ (&* $f1 $f2) $f0) (&/ $w (&+ $w 1))))))

; Negation: ~A
; f = 1 - f
; c = c (unchanged)
(= (truth-neg ($f $c))
   ((&- 1 $f) $c))

; Revision: Combine two beliefs about same statement
; w1 = c1 / (1 - c1)
; w2 = c2 / (1 - c2)
; w = w1 + w2
; f = (w1*f1 + w2*f2) / w
; c = w / (w + 1)
(= (truth-rev ($f1 $c1) ($f2 $c2))
   (let $maxC (&- 1 0.000001) ; Epsilon protection
     (let $sc1 (&min $c1 $maxC)
       (let $sc2 (&min $c2 $maxC)
         (let $w1 (&/ $sc1 (&- 1 $sc1))
           (let $w2 (&/ $sc2 (&- 1 $sc2))
             (let $w (&+ $w1 $w2)
               (let $f (&/ (&+ (&* $w1 $f1) (&* $w2 $f2)) $w)
                 ($f (&/ $w (&+ $w 1)))))))))))

; Helper: clamp value to [0,1]
(= (&truth-clamp $x)
   (&if (&> $x 1) 1 $x))

; Conversion: Weak inverse
; f = f
; c = f * c
(= (truth-conv ($f $c))
   ($f (&* $f $c)))

; Expectation: Single value measure
; exp = c * (f - 0.5) + 0.5
(= (truth-exp ($f $c))
   (&+ (&* $c (&- $f 0.5)) 0.5))

; Analogy: Similarity-based inference
; f = f1 * f2
; c = c1 * c2 * f2
(= (truth-analogy ($f1 $c1) ($f2 $c2))
   ((&* $f1 $f2) (&* (&* $c1 $c2) $f2)))

; Resemblance: Symmetric similarity
; f = (f1 + f2) / 2
; c = c1 * c2
(= (truth-resemblance ($f1 $c1) ($f2 $c2))
   ((&/ (&+ $f1 $f2) 2) (&* $c1 $c2)))

; Contraposition: A->B to ~B->~A
; f = (f2 * (1-f1)) / (f2*(1-f1) + (1-f2)*f1)
; c = c1 * c2
(= (truth-contraposition ($f1 $c1) ($f2 $c2))
   (let $num (&* $f2 (&- 1 $f1))
     (let $denom (&+ $num (&* (&- 1 $f2) $f1))
       ((&/ $num $denom) (&* $c1 $c2)))))

; Intersection: A∩B
; f = f1 * f2
; c = c1 * c2
(= (truth-intersection ($f1 $c1) ($f2 $c2))
   ((&* $f1 $f2) (&* $c1 $c2)))

; Union: A∪B
; f = 1 - (1-f1)*(1-f2)
; c = c1 * c2
(= (truth-union ($f1 $c1) ($f2 $c2))
   ((&- 1 (&* (&- 1 $f1) (&- 1 $f2))) (&* $c1 $c2)))

; Helper min function
(= (&min $a $b)
   (&if (&< $a $b) $a $b))
