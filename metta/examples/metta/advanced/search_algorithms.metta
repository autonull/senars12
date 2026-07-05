; Advanced Search Algorithms Demo

; Graph representation
(Node A)
(Node B)
(Node C)
(Node D)
(Node E)

; Edges with weights
(Edge A B 5)
(Edge A C 3)
(Edge B D 2)
(Edge C D 6)
(Edge C E 4)
(Edge D E 1)

; Get neighbors of a node
(= (neighbors $node)
   (: (match &self (Edge $node $neighbor $_) $neighbor)
      (match &self (Edge $neighbor $node $_) $neighbor)))

; Dijkstra's algorithm (simplified)
(= (shortest-path $start $goal)
   (dijkstra $start $goal (: (: $start 0)) ()))

; Helper for Dijkstra
(= (dijkstra $goal $goal $distances $visited)
   (find-distance $goal $distances))

(= (dijkstra $current $goal $distances $visited)
   (let $unvisited (filter (λ $n (not (member $n $visited))) 
                           (get-all-nodes))
         $next (select-next-node $unvisited $distances)
         (dijkstra $next $goal 
                  (update-distances $next $distances) 
                  (: $next $visited))))

; Get all nodes in the graph
(= (get-all-nodes) (: A (: B (: C (: D (: E ()))))))

; Check if element is member of list
(= (member $x ()) False)
(= (member $x (: $h $t)) (if (== $x $h) True (member $x $t)))

; Select next node based on minimum distance
(= (select-next-node $nodes $distances)
   (fold (λ $min-node $node
           (if (< (distance-to $node $distances) 
                  (distance-to $min-node $distances))
               $node 
               $min-node))
         (car $nodes)
         $nodes))

; Get distance to a node from distances list
(= (distance-to $node $distances)
   (match &self (: (: $node $dist) $_) $dist))

; Update distances based on current node
(= (update-distances $current $distances)
   (let $current-dist (distance-to $current $distances)
         $nbrs (neighbors $current)
         (update-distances-helper $current-dist $nbrs $distances)))

; Depth-First Search with cycle detection
(= (dfs-path $start $goal $visited)
   (if (== $start $goal)
       (: $start ())
       (let $nbrs (neighbors $start)
         (dfs-helper $nbrs $goal (: $start $visited)))))

(= (dfs-helper (: $node $rest) $goal $visited)
   (if (member $node $visited)
       (dfs-helper $rest $goal $visited)
       (let $path (dfs-path $node $goal $visited)
         (if (not (empty? $path))
             (: $node $path)
             (dfs-helper $rest $goal $visited)))))

(= (dfs-helper () $goal $visited) ())

; Breadth-First Search
(= (bfs-path $start $goal)
   (bfs-iter (: (: $start (: $start ())) ()) ()))

(= (bfs-iter (: $frontier $rest) $goal $visited)
   (let $current (car $frontier)
         $node (car $current)
         $path (cdr $current)
     (if (== $node $goal)
         $path
         (if (member $node $visited)
             (bfs-iter $rest $goal (: $node $visited))
             (let $nbrs (neighbors $node)
               (bfs-iter $rest $goal (: $node $visited)
                        (extend-frontier $nbrs $path)))))))

; Greedy Best-First Search (using heuristic)
(= (greedy-search $start $goal $heuristic)
   (greedy-iter (: $start ()) () $heuristic $goal))

(= (greedy-iter (: $current $rest) $visited $heuristic $goal)
   (if (== $current $goal)
       True  ; Found
       (if (member $current $visited)
           (greedy-iter $rest $visited $heuristic $goal)
           (let $nbrs (neighbors $current)
             (let $sorted-nbrs (sort-by-heuristic $nbrs $heuristic $goal)
               (greedy-iter (append $rest $sorted-nbrs) 
                           (: $current $visited) 
                           $heuristic $goal))))))

; Heuristic function (simplified)
(= (manhattan-distance $a $b)
   (case $a
      A (case $b A 0 B 1 C 1 D 2 E 2)
      B (case $b A 1 B 0 C 2 D 1 E 2)
      C (case $b A 1 B 2 C 0 D 1 E 1)
      D (case $b A 2 B 1 C 1 D 0 E 1)
      E (case $b A 2 B 2 C 1 D 1 E 0)))

; A* search algorithm
(= (a-star $start $goal $heuristic)
   (a-star-iter (: (: $start 0) ()) () $heuristic $goal))

; Run a simple pathfinding demo
(println "Graph search algorithms demo")
(println "Finding path from A to E...")

; Test DFS
(= $dfs-result (dfs-path A E ()))
(println "DFS result:" $dfs-result)

; Test BFS
(= $bfs-result (bfs-path A E))
(println "BFS result:" $bfs-result)

; Test greedy search
(= $greedy-result (greedy-search A E manhattan-distance))
(println "Greedy search result:" $greedy-result)

(println "Search algorithms demo completed")