; ============================================================================
; inheritance.metta - NAL Inheritance Inference Demonstrations
; ============================================================================
; Shows various NAL inference rules operating on inheritance relationships:
; - Deduction: transitive inheritance
; - Induction: generalization from common predicate
; - Abduction: hypothesis formation from common subject
; - Comparison: similarity from shared properties
; ============================================================================

; Load required libraries
!(import! truth.metta)
!(import! nal.metta)

; Knowledge Base
; Animal taxonomy with varying truth values
(= (Inh cat animal) (tv 1.0 0.9))
(= (Inh tiger cat) (tv 0.8 0.8))
(= (Inh lion cat) (tv 0.9 0.85))
(= (Inh mammal animal) (tv 1.0 0.95))
(= (Inh dog mammal) (tv 1.0 0.9))
(= (Inh bat mammal) (tv 0.95 0.7))

; -----------------------------------------------------------------------------
; NAL Deduction: Transitive Inheritance
; -----------------------------------------------------------------------------

; Deduction: tiger → cat → animal
; truth-ded: (f1 * f2, c1 * c2) = (0.8 * 1.0, 0.8 * 0.9) = (0.8, 0.72)
!(ded (Inh tiger cat (tv 0.8 0.8)) 
      (Inh cat animal (tv 1.0 0.9)))
; Expected: (Inh tiger animal (TV 0.80 0.72))

; Multiple deduction chain
!(ded (Inh dog mammal (tv 1.0 0.9))
      (Inh mammal animal (tv 1.0 0.95)))
; Expected: (Inh dog animal (TV 1.00 0.85))

; -----------------------------------------------------------------------------
; NAL Induction: Generalization
; -----------------------------------------------------------------------------

; Induction: cat → animal, mammal → animal |- cat → mammal
; Both inherit from animal, so they might be related
; truth-ind: (f2, c1 * c2) = truth-ind uses second's frequency
!(ind (Inh cat animal (tv 1.0 0.9))
      (Inh mammal animal (tv 1.0 0.95)))
; Expected: (Inh cat mammal (TV 1.00 0.85))

; Weaker induction example
!(ind (Inh tiger cat (tv 0.8 0.8))
      (Inh lion cat (tv 0.9 0.85)))
; Expected: weak similarity between tiger and lion

; -----------------------------------------------------------------------------
; NAL Abduction: Hypothesis Formation
; -----------------------------------------------------------------------------

; Abduction: animal → mammal, animal → cat |- cat → mammal?
; If animals are mammals and animals are cats, maybe cats are mammals
; truth-abd: (f1, min(c1 * c2, c2))
!(abd (Inh animal mammal (tv 0.7 0.6))
      (Inh animal cat (tv 0.3 0.5)))
; Expected: weak hypothesis

; -----------------------------------------------------------------------------
; NAL Comparison: Derive Similarity
; -----------------------------------------------------------------------------

; Comparison: find similarity from common inheritance
; Both tiger and lion inherit from cat
!(compare (Inh tiger cat (tv 0.8 0.8))
          (Inh lion cat (tv 0.9 0.85)))
; Expected: (Sim tiger lion (TV ...))

; -----------------------------------------------------------------------------
; NAL Analogy: Transfer Properties
; -----------------------------------------------------------------------------

; If tiger → cat and cat ↔ feline, then tiger → feline
!(load "(= (Sim cat feline) (tv 0.95 0.9))")
!(analogy (Inh tiger cat (tv 0.8 0.8))
          (Sim cat feline (tv 0.95 0.9)))
; Expected: (Inh tiger feline (TV ...))

; -----------------------------------------------------------------------------
; Complex Inference Chain
; -----------------------------------------------------------------------------

; Combine multiple rules to derive new knowledge
!(let $ded-result (ded (Inh bat mammal (tv 0.95 0.7))
                        (Inh mammal animal (tv 1.0 0.95)))
      $ind-result (ind (Inh bat animal (tv-of $ded-result))
                        (Inh dog animal (tv 1.0 0.85)))
      (print "Derived relationship between bat and dog:"
             $ind-result))
