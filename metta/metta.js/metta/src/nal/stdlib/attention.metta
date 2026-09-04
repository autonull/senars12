; ============================================================================
; attention.metta - ECAN Attention Mechanism
; ============================================================================
; Implements Economic Attention Networks (ECAN) primitives for attention
; allocation and importance tracking.
;
; STI: Short-Term Importance (relevance to current context)
; LTI: Long-Term Importance (historical importance)
; ============================================================================

; -----------------------------------------------------------------------------
; Attention Value Queries
; -----------------------------------------------------------------------------

; Get Short-Term Importance of an atom
(= (sti $atom) (&get-sti $atom))

; Get Long-Term Importance of an atom
(= (lti $atom) (&get-lti $atom))

; Get complete attention value (STI and LTI)
(= (av $atom) (AV (&get-sti $atom) (&get-lti $atom)))

; -----------------------------------------------------------------------------
; Attention Value Modification
; -----------------------------------------------------------------------------

; Set STI value for an atom
(= (set-sti! $atom $value) (&set-sti $atom $value))

; Set LTI value for an atom  
(= (set-lti! $atom $value) (&set-lti $atom $value))

; Increment STI by delta
(= (inc-sti! $atom $delta)
   (set-sti! $atom (+ (sti $atom) $delta)))

; Decrement STI by delta
(= (dec-sti! $atom $delta)
   (set-sti! $atom (- (sti $atom) $delta)))

; -----------------------------------------------------------------------------
; Attention Spreading
; -----------------------------------------------------------------------------

; Spread activation from an atom to related atoms
; $decay: how much STI to lose per step (0-1)
(= (spread-activation $atom $decay)
   (&spread-sti $atom $decay))

; Spread with explicit amount
(= (spread-amount $atom $amount)
   (&spread-sti-amount $atom $amount))

; -----------------------------------------------------------------------------
; Attention-Based Selection
; -----------------------------------------------------------------------------

; Get top N atoms by STI
(= (top-sti $n) (&top-by-sti $n))

; Get atoms above STI threshold
(= (above-sti $threshold)
   (&filter-by-sti $threshold))

; Get bottom N atoms (candidates for forgetting)
(= (bottom-sti $n) (&bottom-by-sti $n))

; Sample atoms weighted by STI
(= (sample-by-sti $n) (&sample-sti $n))

; -----------------------------------------------------------------------------
; Attention Allocation Strategies
; -----------------------------------------------------------------------------

; Focus attention on high-confidence beliefs
(= (focus-on-confident $threshold)
   (filter (λ $atom (confident? (tv-of $atom) $threshold))
           (top-sti 20)))

; Boost STI of atoms related to a concept
(= (boost-related $concept $amount)
   (map (λ $atom (inc-sti! $atom $amount))
        (&get-related $concept)))

; Decay STI of all atoms by factor
(= (decay-all-sti $factor)
   (&decay-global-sti $factor))

; -----------------------------------------------------------------------------
; Forgetting Mechanism
; -----------------------------------------------------------------------------

; Forget (remove) atoms below importance threshold
(= (forget-below-threshold $sti-min $lti-min)
   (&forget-below $sti-min $lti-min))

; Promote atoms from STM to LTM (increase LTI)
(= (consolidate $atom)
   (set-lti! $atom (+ (lti $atom) (* (sti $atom) 0.1))))

; -----------------------------------------------------------------------------
; Attention Metrics
; -----------------------------------------------------------------------------

; Total STI in the system
(= (total-sti) (&sum-sti))

; Average STI across all atoms
(= (avg-sti) (&avg-sti))

; STI distribution (min, max, mean, std)
(= (sti-stats) (&sti-distribution))

; Count atoms above STI threshold
(= (count-above-sti $threshold)
   (&count-sti-above $threshold))
