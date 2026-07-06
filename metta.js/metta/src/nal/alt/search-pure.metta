
; search-pure.metta - Pure MeTTa Search Algorithms
; Implements search without grounded operations for benchmarking

; === Depth-First Search (Pure) ===

; DFS on graph represented as adjacency list
; Graph: (edge A B) facts in space
; Returns path from start to goal

(= (dfs-pure $start $goal)
   (dfs-search-pure $start $goal (:)))

(= (dfs-search-pure $goal $goal $path)
   (reverse-list (: $goal $path)))

(= (dfs-search-pure $current $goal $visited)
   (if (member $current $visited)
       ()
       (dfs-neighbors-pure $current $goal (: $current $visited))))

(= (dfs-neighbors-pure $current $goal $visited)
   (match &self (edge $current $neighbor)
     (dfs-search-pure $neighbor $goal $visited)))

; === Breadth-First Search (Pure) ===

(= (bfs-pure $start $goal)
   (bfs-queue-pure (: (: $start (:)) ()) $goal (:)))

(= (bfs-queue-pure (: ($current $path) $rest) $goal $visited)
   (if (= $current $goal)
       (reverse-list (: $current $path))
       (if (member $current $visited)
           (bfs-queue-pure $rest $goal $visited)
           (bfs-expand-pure $current $path $rest $goal (: $current $visited)))))

(= (bfs-expand-pure $current $path $queue $goal $visited)
   (match &self (edge $current $neighbor)
     (let $new-path (: $current $path)
       (let $new-queue (append $queue (: (: $neighbor $new-path) ()))
         (bfs-queue-pure $new-queue $goal $visited)))))

; === A* Search (Pure) ===

; Heuristic-guided search
; Requires heuristic function (h $node $goal)

(= (astar-pure $start $goal $heuristic)
   (astar-queue-pure 
     (: (priority $start 0 (h $start $goal) (:)) ()) 
     $goal 
     $heuristic
     (:)))

(= (astar-queue-pure () $goal $h $visited) ())

(= (astar-queue-pure (: (priority $current $g $f $path) $rest) $goal $h $visited)
   (if (= $current $goal)
       (reverse-list (: $current $path))
       (if (member $current $visited)
           (astar-queue-pure $rest $goal $h $visited)
           (astar-expand-pure $current $g $path $rest $goal $h (: $current $visited)))))

(= (astar-expand-pure $current $g $path $queue $goal $h $visited)
   (match &self (edge $current $neighbor $cost)
     (let $new-g (add $g $cost)
       (let $new-f (add $new-g (h $neighbor $goal))
         (let $new-path (: $current $path)
           (let $new-queue (insert-priority $queue (priority $neighbor $new-g $new-f $new-path))
             (astar-queue-pure $new-queue $goal $h $visited)))))))

; === Helper Functions ===

; List membership check
(= (member $x (:)) False)
(= (member $x (: $x $rest)) True)
(= (member $x (: $y $rest))
   (member $x $rest))

; List reversal
(= (reverse-list $list)
   (reverse-acc $list (:)))

(= (reverse-acc (:) $acc) $acc)
(= (reverse-acc (: $head $tail) $acc)
   (reverse-acc $tail (: $head $acc)))

; List append
(= (append (:) $list2) $list2)
(= (append (: $head $tail) $list2)
   (: $head (append $tail $list2)))

; Priority queue insertion (maintains sorted order by f-value)
(= (insert-priority () $item) (: $item ()))
(= (insert-priority (: (priority $n1 $g1 $f1 $p1) $rest) (priority $n2 $g2 $f2 $p2))
   (if (< $f2 $f1)
       (: (priority $n2 $g2 $f2 $p2) (: (priority $n1 $g1 $f1 $p1) $rest))
       (: (priority $n1 $g1 $f1 $p1) (insert-priority $rest (priority $n2 $g2 $f2 $p2)))))

; === Example Heuristic (Manhattan Distance) ===

(= (h (pos $x1 $y1) (pos $x2 $y2))
   (add (abs (sub $x2 $x1)) (abs (sub $y2 $y1))))

(= (abs $x) (if (< $x 0) (sub 0 $x) $x))

; === Benchmark Notes ===
; Pure MeTTa search vs grounded implementations
; - DFS/BFS demonstrate list manipulation overhead
; - A* shows complex pure computation costs
; - Compare against search.metta with grounded list ops
