; Learning algorithms in MeTTa

; Learn a new rule with confidence
(= (learn-rule $pattern $conclusion $confidence)
   (add-atom (= $pattern $conclusion :conf $confidence)))

; Reinforce a rule by increasing its confidence
(= (reinforce $rule $delta)
   (let $current-conf (confidence-of $rule)
     (let $new-conf (min 1.0 (+ $current-conf $delta))
       (update-confidence $rule $new-conf))))

; Punish a rule by decreasing its confidence
(= (punish $rule $delta)
   (let $current-conf (confidence-of $rule)
     (let $new-conf (max 0.0 (- $current-conf $delta))
       (update-confidence $rule $new-conf))))

; Update the confidence of a rule
(= (update-confidence $rule $new-conf)
   (remove-atom $rule)
   (add-atom (with-confidence $rule $new-conf)))

; Get confidence of a rule
(= (confidence-of (= $p $c :conf $cval))
   $cval)

(= (confidence-of $other)
   1.0)  ; Default confidence for rules without explicit confidence

; Rule with updated confidence
(= (with-confidence (= $p $c :conf $_) $new-c)
   (= $p $c :conf $new-c))

(= (with-confidence $rule $new-c)
   (add-confidence $rule $new-c))

(= (add-confidence $rule $c)
   (: $rule :conf $c))

; Generalize a rule by abstracting constants to variables
(= (generalize-rule (= $pattern $conclusion))
   (= (abstract-constants $pattern) (abstract-constants $conclusion)))

; Abstract constants in an expression to variables
(= (abstract-constants $atom)
   (if (is-constant $atom)
       (make-var $atom)
       (if (is-variable $atom)
           $atom
           (if (is-complex $atom)
               (map abstract-constants $atom)
               $atom))))

; Check if atom is a constant
(= (is-constant $atom)
   (and (not (is-variable $atom)) (not (is-complex $atom))))

; Check if atom is a variable
(= (is-variable $var)
   (match $var
      (? $name) True
      $other False))

; Check if atom is complex (has substructure)
(= (is-complex $exp)
   (match $exp
      ($op $args...) True
      $other False))

; Make a variable from a constant
(= (make-var $const)
   (? (str-concat "gen_" (to-string $const))))

; Specialized learning for NAL rules
(= (learn-nal-rule $type $premise1 $premise2 $conclusion $truth-val)
   (case $type
      "deduction" (learn-deduction-rule $premise1 $premise2 $conclusion $truth-val)
      "induction" (learn-induction-rule $premise1 $premise2 $conclusion $truth-val)
      "abduction" (learn-abduction-rule $premise1 $premise2 $conclusion $truth-val)
      "comparison" (learn-comparison-rule $premise1 $premise2 $conclusion $truth-val)
      (learn-generic-rule $premise1 $premise2 $conclusion $truth-val)))

; Specific NAL learning rules
(= (learn-deduction-rule $premise1 $premise2 $conclusion $truth-val)
   (learn-rule (deduce $premise1 $premise2) $conclusion $truth-val))

(= (learn-induction-rule $premise1 $premise2 $conclusion $truth-val)
   (learn-rule (induce $premise1 $premise2) $conclusion $truth-val))

(= (learn-abduction-rule $premise1 $premise2 $conclusion $truth-val)
   (learn-rule (abduce $premise1 $premise2) $conclusion $truth-val))

(= (learn-comparison-rule $premise1 $premise2 $conclusion $truth-val)
   (learn-rule (compare $premise1 $premise2) $conclusion $truth-val))

; Generic learning rule
(= (learn-generic-rule $premise1 $premise2 $conclusion $truth-val)
   (learn-rule (combine $premise1 $premise2) $conclusion $truth-val))

; Evaluate prediction accuracy
(= (prediction-accuracy $expected $actual)
   (abs (- $expected $actual)))

; Update rule based on prediction error
(= (update-rule-on-error $rule $expected $actual $learning-rate)
   (let $error (prediction-accuracy $expected $actual)
     (let $adjustment (* $learning-rate $error)
       (if (> $actual $expected)
           (reinforce $rule $adjustment)
           (punish $rule $adjustment)))))

; Learning rate adjustment based on stability
(= (adaptive-learning-rate $rule $recent-errors)
   (if (< (avg $recent-errors) 0.1)
       0.01  ; Lower learning rate when stable
       0.1)) ; Higher learning rate when unstable

; Average of a list
(= (avg $lst)
   (/ (sum $lst) (length $lst)))

(= (sum ())
   0)

(= (sum (: $h $t))
   (+ $h (sum $t)))

(= (length ())
   0)

(= (length (: $h $t))
   (+ 1 (length $t)))

; Self-modification: learn to improve learning
(= (learn-to-learn $experience $strategy)
   (let $patterns (extract-patterns $experience)
     (let $rules (generate-rules $patterns)
       (apply-learning-strategy $rules $strategy))))

; Extract patterns from experience
(= (extract-patterns $experience)
   (filter significant-pattern? (generate-candidates $experience)))

; Generate candidate patterns
(= (generate-candidates $experience)
   (map make-candidate (sliding-window 3 $experience)))

; Sliding window of size 3
(= (sliding-window $size $lst)
   (if (< (length $lst) $size)
       ()
       (: (take $size $lst) (sliding-window $size (drop 1 $lst)))))

(= (take 0 $lst)
   ())

(= (take $n (: $h $t))
   (: $h (take (- $n 1) $t)))

(= (drop 0 $lst)
   $lst)

(= (drop $n (: $h $t))
   (drop (- $n 1) $t))