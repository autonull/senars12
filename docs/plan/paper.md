# Write a complete, polished, academic preprint

## Core source material

- Primary: README.md
- Secondary: actual source code in the repository (use for concrete implementation details, file names, and example
  outputs)

## Tone and positioning

- Confident but humble, academic yet accessible
- Treat the project as an open invitation rather than a finished product
- Explain that SeNARS is a deliberately unfinished substrate designed to seed an ecosystem of divergent implementations,
  framing “incompleteness” explicitly as the central philosophical and practical innovation (this is the novel
  contribution)

## Structure

Title:

- Semantic Non-Axiomatic Reasoning System (SeNARS): Neuro-Symbolic Cognitive Agent

Author line: SeNARS Developers

Immediately under the title:
This work is licensed under a Creative Commons Attribution 4.0 International License (CC-BY-4.0).
Code is released under AGPL-3.0.
Contact: https://github.com/automenta/senars11

Abstract (180–220 words)

- One-sentence hook
- Core idea (NAL + LLM hybrid with continuous non-blocking dataflow)
- Key technical features already working (tests, dual memory, truth-value propagation, web UI, etc.)
- Explicit statement that deliberate incompleteness is a design choice to enable richer ecosystem evolution
- End with: “This preprint serves as both technical documentation and an open call for collaborators.”

1. Introduction and Motivation (1–1.5 pages)
    - Current tension: symbolic AI (transparent but brittle) vs neural AI (powerful but opaque)
    - Limitations of pure OpenNARS/NARS and pure LLMs
    - SeNARS goal: bridge the divide while preserving real-time reasoning under incomplete knowledge
    - Brief history (respectful nod to Pei Wang’s foundational work)

2. Background
    - Non-Axiomatic Logic (NAL) and OpenNARS in 4–5 paragraphs
    - Relevant LLM reasoning advancements (Chain-of-Thought, Reflexion, STaR, ReAct, etc.)

3. SeNARS Architecture (core technical section, ~2–3 pages)
    - High-level dataflow diagram description (textual or suggest TikZ)
    - Dual memory system, belief/goal split
    - Continuous premise stream → inference → truth-value update loop
    - Exact role of the LLM component vs symbolic NAL component
    - Non-blocking execution model
    - Detail the reasoning system
    - Table of NAL Rules
    - Table of LM Rules

4. Prototype Implementation and Current Status
    - Tech stack, test coverage (87 passing tests), web-based visualization interface
    - Screenshots or example traces encouraged (describe if no figures)
    - What works end-to-end today

5. Deliberate Incompleteness as Design Principle
    - Argue that finished, monolithic systems calcify research
    - Explicit extension points the prototype leaves open
    - Vision of multiple competing completions sharing the same formal core

6. Future Directions and Open Challenges
    - Embodiment, lifelong learning, scaling laws, alternative LLM backends, formal verification, etc.
    - Invite specific kinds of contributions

7. Conclusion
    - Recap + explicit call: “We release SeNARS as a public good and actively seek collaborators, forks, and alternative
      completions.”

References

- Minimum: Pei Wang’s key NARS papers (2013 book, relevant AGI conference papers)
- 5–8 recent neuro-symbolic / LLM reasoning papers (CoT, ReAct, Reflexion, Toolformer, etc.)
- https://github.com/patham9/ANSNA

## Visuals

- High-level architecture diagrams
- Simple timeline: OpenNARS → NARchy → SeNARS

## Formatting

- Use the official NeurIPS 2024/2025 LaTeX template OR standard arXiv two-column style
- 10–11 pt font, single or 1.2 line spacing is acceptable for preprint
- Page numbers, proper section numbering

Output the complete LaTeX source ready to compile (no placeholders).