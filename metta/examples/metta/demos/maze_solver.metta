; Maze Solver Demo using A* Search
;
; Solves a grid-based maze finding path from Start to Goal.
; Grid is 10x10.
;
; Representation:
; (Wall $x $y) - wall at x,y
; (Goal $x $y) - goal at x,y
; (Start $x $y) - start at x,y

; Define grid size
(= (grid-size) 10)

; Define goal
(= (goal-node) (8 8))
(Goal 8 8)

; Define start
(= (start-node) (1 1))
(Start 1 1)

; Define walls (simple layout)
(Wall 2 1) (Wall 2 2) (Wall 2 3)
(Wall 4 4) (Wall 4 5) (Wall 4 6)
(Wall 6 2) (Wall 6 3) (Wall 6 4)
(Wall 8 5) (Wall 8 6) (Wall 8 7)

; Check if position is valid (in bounds and not wall)
(= (valid? ($x $y))
   (and (and (> $x 0) (<= $x (grid-size)))
        (and (and (> $y 0) (<= $y (grid-size)))
             (not (is-wall? $x $y)))))

(= (is-wall? $x $y)
   (match &self (Wall $x $y) True))

; Generate successors (up, down, left, right)
(= (successors ($x $y))
   (filter valid?
           (: ($x (+ $y 1))
           (: ($x (- $y 1))
           (: ((+ $x 1) $y)
           (: ((- $x 1) $y) ()))))))

; Heuristic: Manhattan distance
(= (heuristic ($x $y))
   (let ($gx $gy) (goal-node)
     (+ (abs (- $gx $x)) (abs (- $gy $y)))))

(= (abs $n) (if (< $n 0) (- 0 $n) $n))

; Goal check
(= (is-goal? $node) (== $node (goal-node)))

; Run A*
!(&println "Starting Maze Solver...")
!(&println "Start:" (start-node))
!(&println "Goal:" (goal-node))

! (let $path (astar is-goal? (start-node) heuristic)
    (let $_ (&println "Path found:")
      (let $_ (&println $path)
        (let $_ (&println "Path length:" (&length $path))
          (&println "Maze solver completed.")))))
