; ============================================================================
; control.metta - Meta-Reasoning and Strategy Scripting
; ============================================================================
; Implements high-level control strategies for adaptive reasoning.
; Allows MeTTa code to dynamically control the reasoning process.
; ============================================================================

; -----------------------------------------------------------------------------
; Premise Selection Strategies
; -----------------------------------------------------------------------------

; Select top N related premises sorted by STI
(= (select-premises $task $n)
   (top-n (sort-by-sti (&get-related $task)) $n))

; Select premises sorted by confidence
(= (select-by-confidence $task $n)
   (top-n (sort-by-conf (&get-related $task)) $n))

; Select premises with high expectation (f * c)
(= (select-by-expectation $task $n)
   (top-n (sort-by (λ $x (expectation (tv-of $x)))
                   (&get-related $task))
          $n))

; -----------------------------------------------------------------------------
; Adaptive Strategy Selection
; -----------------------------------------------------------------------------

; Main adaptive strategy dispatcher
; Low confidence → exploratory (diverse search)
; High confidence → conservative (best matches)
(= (adaptive-strategy $task)
   (if (< (confidence-of $task) 0.5)
       (exploratory-selection $task)
       (conservative-selection $task)))

; Exploratory: sample diverse premises randomly
(= (exploratory-selection $task)
   (sample-random (&get-related $task) 5))

; Conservative: select highest-confidence premises
(= (conservative-selection $task)
   (top-n (sort-by-conf (&get-related $task)) 3))

; Balanced: mix of high-STI and high-confidence
(= (balanced-selection $task $n)
   (let $by-sti (take (/ $n 2) (sort-by-sti (&get-related $task)))
        $by-conf (take (/ $n 2) (sort-by-conf (&get-related $task)))
        (union $by-sti $by-conf)))

; -----------------------------------------------------------------------------
; Inference Control
; -----------------------------------------------------------------------------

; Execute inference with premise selection strategy
(= (controlled-inference $task $strategy)
   (let $premises ($strategy $task)
        (map (λ $p (&nars-derive $task $p)) $premises)))

; Try multiple strategies and pick best result
(= (multi-strategy $task)
   (let $results-1 (controlled-inference $task exploratory-selection)
        $results-2 (controlled-inference $task conservative-selection)
        (best-by-conf (union $results-1 $results-2))))

; Iterative deepening: increase premise count until goal met
(= (iterative-deepening $task $goal $max-premises)
   (iterative-deepening-helper $task $goal 1 $max-premises))

(= (iterative-deepening-helper $task $goal $current $max)
   (if (&> $current $max)
       Empty
       (let $results (controlled-inference $task 
                        (λ $t (select-premises $t $current)))
            (if (satisfies? $results $goal)
                $results
                (iterative-deepening-helper $task $goal (+ $current 1) $max)))))

; -----------------------------------------------------------------------------
; Task Prioritization
; -----------------------------------------------------------------------------

; Calculate task priority based on multiple factors
(= (calc-priority $task)
   (let $sti-score (* (sti $task) 0.4)
        $conf-score (* (confidence-of $task) 0.3)
        $exp-score (* (expectation (tv-of $task)) 0.3)
        (+ $sti-score (+ $conf-score $exp-score))))

; Re-prioritize tasks in buffer
(= (reprioritize-tasks $tasks)
   (sort-by calc-priority $tasks))

; -----------------------------------------------------------------------------
; Resource-Bounded Reasoning
; -----------------------------------------------------------------------------

; Reason for maximum N cycles
(= (bounded-reasoning $task $max-cycles)
   (&reason-bounded $task $max-cycles))

; Reason until confidence threshold reached
(= (reason-until-confident $task $threshold)
   (&reason-until-conf $task $threshold))

; Anytime reasoning: best answer so far
(= (anytime-reason $task $time-budget)
   (&anytime-derive $task $time-budget))

; -----------------------------------------------------------------------------
; Helper Functions
; -----------------------------------------------------------------------------

; Extract confidence from task
(= (confidence-of $task) (conf (tv-of $task)))

; Sort list by STI values
(= (sort-by-sti $atoms)
   (sort-by (λ $a (sti $a)) $atoms))

; Sort list by confidence values
(= (sort-by-conf $atoms)
   (sort-by (λ $a (conf (tv-of $a))) $atoms))

; Take top N elements from sorted list
(= (top-n $list $n)
   (take $n $list))

; Sample N random elements from list
(= (sample-random $list $n)
   (&sample-random $list $n))

; Find best element by confidence
(= (best-by-conf $atoms)
   (car (sort-by-conf $atoms)))

; Check if results satisfy goal
(= (satisfies? $results $goal)
   (&satisfies $results $goal))

; Union of two lists (remove duplicates)
(= (union $list1 $list2)
   (unique (append $list1 $list2)))
