; Adaptive Reasoning Demo - Strategy switching based on confidence
; Demonstrates: Meta-reasoning, strategy selection, adaptive behavior

; Define two reasoning strategies
; Conservative: Only use high-confidence premises
; Exploratory: Allow low-confidence premises for creative reasoning

; Sample knowledge base with varying confidence levels
(Inh bird animal :conf 0.95)
(Inh penguin bird :conf 0.85)
(Inh penguin swimmer :conf 0.90)
(Inh bird flyer :conf 0.70)  ; Lower confidence due to exceptions like penguins
(Inh penguin flyer :conf 0.10)  ; Very low confidence
(Repr bird wings :conf 0.88)
(Repr penguin wings :conf 0.82)
(Similar bird penguin :conf 0.65)  ; Moderate similarity

; Task set with different confidence requirements
(task classify-animal-1 (Inh tweety bird) :difficulty medium :expected-conf 0.8)
(task classify-animal-2 (Inh daffy duck) :difficulty easy :expected-conf 0.9)
(task classify-animal-3 (Inh penguin flyer) :difficulty hard :expected-conf 0.2)  ; Conflicting info

; Strategy definitions
(conservative-strategy)
(exploratory-strategy)

; Adaptive strategy selector based on task confidence
(= (select-strategy $task)
   (let $conf (expected-confidence $task)
     (if (< $conf 0.5)
         exploratory-strategy
         conservative-strategy)))

; Get expected confidence for a task
(= (expected-confidence (task $id $query :difficulty $diff :expected-conf $conf))
   $conf)

; Premise selection based on strategy
(= (select-premises conservative-strategy $query)
   (filter (λ $p (high-confidence-premise $p)) (get-all-premises $query)))

(= (select-premises exploratory-strategy $query)
   (get-all-premises $query))

; Check if premise has high confidence
(= (high-confidence-premise (Inh $s $p :conf $c)) (> $c 0.6))
(= (high-confidence-premise (Repr $s $p :conf $c)) (> $c 0.6))
(= (high-confidence-premise (Similar $s $p :conf $c)) (> $c 0.6))

; Get all premises related to a query
(= (get-all-premises (Inh $subj $pred))
   (: (match &self (Inh $subj $any :conf $c_any) (Inh $subj $any :conf $c_any))
      (match &self (Inh $any $subj :conf $c_any) (Inh $any $subj :conf $c_any))
      (match &self (Similar $subj $any :conf $c_any) (Similar $subj $any :conf $c_any))
      (match &self (Similar $any $subj :conf $c_any) (Similar $any $subj :conf $c_any))))

; Simple inference engine that uses selected premises
(= (infer-with-strategy $strategy $query)
   (let $premises (select-premises $strategy $query)
     (apply-inference-rules $premises $query)))

; Apply inference rules to derive conclusions
(= (apply-inference-rules (: $p $rest) $query)
   (let $result (single-inference $p $query)
     (if (not (= $result ()))
         $result
         (apply-inference-rules $rest $query))))

(= (apply-inference-rules () $query) ())

; Simple inheritance transitivity rule
(= (single-inference (Inh $a $b :conf $ca) (Inh $a $c))
   (match &self (Inh $b $c :conf $cb)
          (Inh $a $c :conf (combine-confidence $ca $cb))))

; Confidence combination function
(= (combine-confidence $c1 $c2) (* $c1 $c2))

; Main adaptive reasoning loop
(println "Starting adaptive reasoning demo...")
(println "Demonstrating strategy switching based on task confidence requirements")

; Process each task with adaptive strategy selection
(= $tasks (get-tasks))
(= $results (process-tasks-adaptively $tasks))

(= (get-tasks)
   (: (task classify-animal-1 (Inh tweety bird) :difficulty medium :expected-conf 0.8)
      (: (task classify-animal-2 (Inh daffy duck) :difficulty easy :expected-conf 0.9)
         (: (task classify-animal-3 (Inh penguin flyer) :difficulty hard :expected-conf 0.2) ()))))

(= (process-tasks-adaptively (: $task $rest))
   (: (process-single-task $task)
      (process-tasks-adaptively $rest)))

(= (process-tasks-adaptively ()) ())

(= (process-single-task (task $id $query :difficulty $diff :expected-conf $exp-conf))
   (do (println "")
       (println "Processing task:" $id)
       (println "Query:" $query)
       (println "Expected confidence:" $exp-conf)
       (let $strategy (select-strategy (task $id $query :difficulty $diff :expected-conf $exp-conf))
         (println "Selected strategy:" $strategy)
         (let $result (infer-with-strategy $strategy $query)
           (println "Result:" $result)
           (if (not (= $result ()))
               (println "✓ Inference successful")
               (println "✗ No inference found"))
           (task-result $id $strategy $result))))))

; Track strategy selection statistics
(= (task-result $id $strategy $result)
   (add-atom (selected $id $strategy))
   $result)

; Show strategy selection patterns
(= (show-patterns)
   (do (println "")
       (println "Strategy selection patterns:")
       (println "Tasks processed with conservative strategy:")
       (show-strategy-uses conservative-strategy)
       (println "Tasks processed with exploratory strategy:")
       (show-strategy-uses exploratory-strategy)))

(= (show-strategy-uses $strategy)
   (map (λ $record (show-record $record $strategy))
        (match &self (selected $task-id $strategy) (selected $task-id $strategy))))

(= (show-record (selected $task-id $used-strat) $looking-for)
   (if (= $used-strat $looking-for)
       (println "  -" $task-id)
       ()))

; Run the adaptive reasoning demo
(time
  (process-tasks-adaptively (get-tasks))
  (show-patterns)
)

(println "")
(println "Adaptive reasoning demo completed!")
(println "Note how lower-confidence tasks trigger exploratory strategy")
(println "while high-confidence tasks use conservative strategy.")