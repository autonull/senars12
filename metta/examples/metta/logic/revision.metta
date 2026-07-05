; ============================================================================
; revision.metta - Belief Revision Demonstrations
; ============================================================================
; Shows how NAL revision combines evidence from multiple sources.
; Revision increases confidence when independent sources agree,
; and produces intermediate values when sources disagree.
;
; Revision formula:
; F_rev = (f1*c1 + f2*c2) / (c1 + c2)
; C_rev = min(c1 + c2, 1.0)
; ============================================================================

; Load required libraries
!(import! truth.metta)
!(import! nal.metta)

; -----------------------------------------------------------------------------
; Simple Revision: Agreeing Sources
; -----------------------------------------------------------------------------

; Two independent observations that the sky is blue
; Source 1: observed during day (high confidence)
(= (belief-1) (Inh sky blue (tv 0.9 0.7)))

; Source 2: observed at noon (high confidence)
(= (belief-2) (Inh sky blue (tv 0.95 0.8)))

; Revise: combine evidence
; Expected: frequency ~0.93, confidence = 0.7 + 0.8 = 1.0 (capped)
!(revise (belief-1) (belief-2))

; -----------------------------------------------------------------------------
; Revision: Partially Disagreeing Sources
; -----------------------------------------------------------------------------

; Observation 1: It will probably rain (60% confidence)
(= (rain-forecast-1) (Inh tomorrow rainy (tv 0.6 0.6)))

; Observation 2: It will probably be sunny (70% confidence)
(= (rain-forecast-2) (Inh tomorrow rainy (tv 0.3 0.7)))

; Revise: weighted average based on confidence
; F_rev = (0.6*0.6 + 0.3*0.7) / (0.6+0.7) = (0.36 + 0.21) / 1.3 ≈ 0.44
; C_rev = min(1.3, 1.0) = 1.0
!(revise (rain-forecast-1) (rain-forecast-2))
; Expected: moderate frequency ~0.44, full confidence 1.0

; -----------------------------------------------------------------------------
; Revision: Low Confidence Updates
; -----------------------------------------------------------------------------

; Initial weak belief
(= (weak-belief) (Inh concept property (tv 0.5 0.3)))

; New evidence (also weak)
(= (new-evidence) (Inh concept property (tv 0.7 0.4)))

; Revision combines weak evidence
; C_rev = 0.3 + 0.4 = 0.7 (moderate confidence from combined evidence)
!(revise (weak-belief) (new-evidence))

; -----------------------------------------------------------------------------
; Iterative Revision: Accumulating Evidence
; -----------------------------------------------------------------------------

; Start with initial observation
(= (obs-1) (Inh water wet (tv 0.8 0.5)))

; Add second observation
!(let $r1 (revise (obs-1) (Inh water wet (tv 0.85 0.5)))
      ; Confidence now 1.0
      ; Add third observation
      (let $r2 (revise $r1 (Inh water wet (tv 0.9 0.6)))
           (print "After 3 revisions:" $r2
                  "Confidence:" (conf (tv-of $r2)))))
; Note: confidence capped at 1.0 after first revision

; -----------------------------------------------------------------------------
; Revision vs New Information
; -----------------------------------------------------------------------------

; Old belief (from last year)
(= (old-belief) (Inh restaurant good (tv 0.8 0.9)))

; New belief (recent experience)
(= (recent-belief) (Inh restaurant good (tv 0.3 0.8)))

; Revision treats both equally (doesn't favor recency)
!(revise (old-belief) (recent-belief))
; Expected: frequency ~0.56, confidence 1.0

; For temporal reasoning, would need to weight by recency separately

; -----------------------------------------------------------------------------
; Practical Application: Sensor Fusion
; -----------------------------------------------------------------------------

; Temperature reading from sensor 1
(= (temp-sensor-1) (Measurement temperature 72 (tv 0.72 0.8)))

; Temperature reading from sensor 2 (slightly different)
(= (temp-sensor-2) (Measurement temperature 74 (tv 0.74 0.75)))

; Fuse sensor readings via revision
!(revise (temp-sensor-1) (temp-sensor-2))
; Expected: combined reading ~73°F with high confidence

; -----------------------------------------------------------------------------
; Truth Value Inspection
; -----------------------------------------------------------------------------

!(let $revised (revise (Inh test example (tv 0.6 0.5))
                        (Inh test example (tv 0.8 0.6)))
      (print "Revised belief:"
             "Frequency:" (freq (tv-of $revised))
             "Confidence:" (conf (tv-of $revised))
             "Expectation:" (expectation (tv-of $revised))
             "Strong?" (strong? (tv-of $revised) 0.7)))
