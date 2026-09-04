# SeNARS 1.0 MeTTa Implementation

**A Web-Native, NAL-Enhanced Cognitive Reasoning Engine**

The SeNARS MeTTa implementation is a high-performance, JavaScript-based execution engine for **MeTTa (Meta Type Talk)**.
It is meticulously designed to bridge the gap between abstract symbolic AI and modern web development, creating the
first truly "web-native" Cognitive AI runtime.

This is not just a language interpreter; it is a **fusion reactor** for two powerful paradigms: the flexible,
expression-based reduction of MeTTa and the robust, uncertainty-aware logic of **NARS (Non-Axiomatic Reasoning System)
**.

---

## 🚀 Why This Implementation is Unique

### 1. True Web-Native Cognitive AI

Unlike other implementations tethered to system-level languages (Rust, C++, Python), SeNARS MeTTa is built in pure,
modern JavaScript.

- **Universal Deployment**: Runs identically in the browser and Node.js.
- **Zero Friction**: No WebAssembly compilation steps, no Python bindings—just import and run.
- **Integration Ready**: Seamlessly interacts with existing web libraries, DOM trees, and network APIs.

### 2. Deep NAL Integration ("Cognitive Native")

This implementation treats **NAL (Non-Axiomatic Logic)** as a first-class citizen, not an external plugin.

- **Native Truth Values**: Directly manipulate NARS truth values (Frequency, Confidence) using high-speed "grounded"
  operations.
- **Inference as Code**: Write NAL inference rules (Deduction, Induction, Abduction) naturally using MeTTa's functional
  syntax.
- **Resource Management**: Built-in support for "Budget" values (Priority, Durability, Quality) to manage attention and
  computational resources.

### 3. The "Hybrid Engine" Architecture

We recognize that real-world AI needs both **speed** and **flexibility**. Our architecture delivers both:

- **Grounded Mode (Performance)**: Critical operations (math, logic tables, tensor ops) are "grounded" to native
  JavaScript, executing in microseconds (~0.001ms).
- **Pure Mode (Reflection)**: We also provide "Pure MeTTa" implementations of the same logic. This allows the system to
  inspect, analyze, and even rewrite its own logic at the source code level, enabling deep metareasoning.

### 4. Self-Modifying Metaprogramming

This engine is designed for **Self-Referential Intelligence**.

- **Runtime Plasticity**: Programs can dynamically add (`&add-rule`), remove (`&remove-rule`), and inspect (
  `&get-rules-for`) their own logic during execution.
- **Learning**: The system can "learn" new functions and rules on the fly, effectively rewriting its own source code as
  it gathers new information.

---

## 🏗️ Architecture & Organization

The codebase is organized to ensure modularity, separating the "Cognitive Core" from the "Language Layer."

### `metta/src/kernel/`

The "Brain" of the operation. Contains the fundamental machinery:

- **Interpreter**: The main execution loop handling the AtomSpace and reduction steps.
- **Unification Engine**: A robust pattern-matching system shared with the Core NARS implementation.
- **Type System**: A optional dynamic type checker ensuring semantic consistency.

### `metta/src/nal/`

The "Cognitive Bridge." This module infuses MeTTa with NARS capabilities:

- `truth.metta`: Implements the full suite of NAL truth functions (deduction, revision, intersection, etc.).
- `control.metta` & `budget.metta`: Heuristics for attention allocation and resource management.
- `strategies/`: Contains pluggable reasoning strategies, including **Prolog-style backward chaining** and *
  *forward-chaining inference**.

### `metta/src/stdlib/`

The "Standard Kit." Essential primitives that make the language usable:

- `core`, `list`, `match`, `types`: The foundational blocks for functional programming and pattern matching.

---

## ✨ Key Capabilities

- **Seamless Interop**: Call JavaScript functions from MeTTa and MeTTa functions from JavaScript.
- **Lazy Evaluation**: Grounded operations support "lazy" execution, preventing wasted cycles on unused branches.
- **Memoization**: An integrated LRU cache speeds up complex recursive reasoning chains by remembering previous results.
- **Pluggable Strategies**: Switch reasoning modes (e.g., from Logic-based to Neural-based) without changing your
  application code.

## 🎯 Conclusion

SeNARS MeTTa represents the democratization of Cognitive AI. It provides a robust, accessible, and highly hackable
platform for everything from educational experiments to complex, uncertainty-aware web agents. It proves that you don't
need a supercomputer to run advanced symbolic reasoning—just a web browser and a smart architecture.

## ⚔️ Philosophical Alignment: SeNARS vs. Hyperon

SeNARS intentionally diverges from the reference implementation of **OpenCog Hyperon** (developed by TrueAGI) to explore
a different evolutionary path for Cognitive AI.

### The Hyperon Approach: "Industrial Scale"

Hyperon is designed as a massive, distributed cognitive operating system. It prioritizes:

- **Distributed AtomSpace**: Scaling knowledge graphs across clusters.
- **Legacy Compatibility**: Supporting decades of OpenCog components (PLN, MOSES).
- **System-Level Performance**: Built in Rust/C++ for bare-metal efficiency.

### The SeNARS Approach: "Agile Essence"

SeNARS reimplements the **absolute core** of the Hyperon vision—MeTTa's reduction engine and self-modifying
capabilities—but strips away the heavy infrastructure.

> **"We distilled Hyperon's grand vision down to its purest essence: self-modifying symbolic reasoning."**

- **Lean & Mean**: A ~600-line JavaScript kernel that handles grounded atoms, pattern matching, and rule firing.
  Everything else—control flow, search strategies, reasoning engines—is implemented in MeTTa itself.
- **Cruft-Free**: We abandoned the "decades of accumulated framework cruft." There is no distributed database, no
  complex build system, and no legacy dependencies.
- **Evolutionary Velocity**: By keeping the core tiny and the logic high-level, SeNARS can evolve its cognitive
  architecture orders of magnitude faster than a traditional heavy stack.

### The Result

We have built something that honors the original promise of General Intelligence: a system small enough to run in a
browser tab, yet powerful enough to rewrite its own source code. While Hyperon builds the "Mainframe of AGI," SeNARS is
building the "Personal Computer of AGI."

#### References

- **OpenCog Hyperon**: [trueagi-io/hyperon-experimental](https://github.com/trueagi-io/hyperon-experimental)
- **TrueAGI**: [trueagi.io](https://trueagi.io)
- **OpenCog Foundation**: [opencog.org](https://opencog.org)