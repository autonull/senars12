; Search algorithms in MeTTa

; Depth-First Search
(= (dfs $goal $state $visited)
   (if ($goal $state) 
       $state
       (let $successors (successors $state)
         (dfs-helper $goal $successors $visited $state))))

(= (dfs-helper $goal $states $visited $parent)
   (match $states
      (: $state $rest)
      (if (member $state $visited)
          (dfs-helper $goal $rest $visited $parent)
          (let $result (dfs $goal $state (: $state $visited))
            (if (not (== $result ()))
                $result
                (dfs-helper $goal $rest (: $state $visited) $parent))))
      ()))

; Breadth-First Search
(= (bfs $goal $start)
   (bfs-loop $goal (: $start ()) ()))

; Helper for BFS loop
(= (bfs-loop $goal $queue $visited)
   (match $queue
      (: $state $rest)
      (if ($goal $state)
          $state
          (if (member $state $visited)
              (bfs-loop $goal $rest $visited)
              (let $new-queue (append $rest (successors $state))
                (bfs-loop $goal $new-queue (: $state $visited)))))
      ()))

; A* Search Algorithm
; Uses a list of pairs for the frontier: (: (: node cost) (: (: node2 cost2) ...))

(= (astar $goal $start $heuristic)
   (astar-loop $goal (: (: $start 0) ()) () $heuristic))

; A* loop helper
(= (astar-loop $goal $frontier $visited $heuristic)
   (if (empty? $frontier)
       ()
       (let $current-pair (best-node-pair $frontier $heuristic)
         (let $node (first $current-pair)
           (if ($goal $node)
               $node
               (if (member $node $visited)
                   (astar-loop $goal (remove-node $node $frontier) $visited $heuristic)
                   (let $successors (successors $node)
                     (let $new-frontier (expand-frontier $current-pair $successors $heuristic $frontier)
                        (astar-loop $goal (remove-node $node $new-frontier) (: $node $visited) $heuristic)))))))))

; Find the best node pair (: node cost) from frontier
(= (best-node-pair (: $pair $rest) $heuristic)
   (if (empty? $rest)
       $pair
       (let $best-rest (best-node-pair $rest $heuristic)
         (if (< (total-cost $pair $heuristic) (total-cost $best-rest $heuristic))
             $pair
             $best-rest))))

(= (total-cost (: $node $g) $heuristic)
   (+ $g ($heuristic $node)))

; Expand frontier with new nodes
; $current-pair is (: node g-cost)
; $successors is list of nodes
; Returns new frontier
(= (expand-frontier $current-pair $successors $heuristic $frontier)
   (fold (lambda ($acc-frontier $succ)
           (add-to-frontier $succ (+ (second $current-pair) 1) $acc-frontier))
         $frontier
         $successors))

(= (add-to-frontier $node $cost $frontier)
   (: (: $node $cost) $frontier))

; Remove node from frontier (simplified: just removes first occurrence)
(= (remove-node $node (: $pair $rest))
   (if (== (first $pair) $node)
       $rest
       (: $pair (remove-node $node $rest))))
(= (remove-node $node ()) ())


; Helper functions

; List membership
(= (member $x ()) False)
(= (member $x (: $h $t))
   (if (== $x $h) True (member $x $t)))

; Empty check
(= (empty? ()) True)
(= (empty? (: $h $t)) False)

; Append
(= (append () $ys) $ys)
(= (append (: $x $xs) $ys) (: $x (append $xs $ys)))

; Merge (alias for append, used in some examples)
(= (merge $a $b) (append $a $b))

; Pair accessors
(= (first (: $x $xs)) $x)
(= (second (: $x (: $y $ys))) $y)

; Standard fold
(= (fold $f $z ()) $z)
(= (fold $f $z (: $h $t)) (fold $f ($f $z $h) $t))
