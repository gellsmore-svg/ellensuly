# Five-perspective review (v1)

## A. Traditional risk manager

A likelihood × impact assessment is the first thing you can type. The register and heatmap are recognisable. Tooltips explain Exposure, Proximity, Velocity and Confidence in one line each. The graph is introduced as a map of the same data, not a replacement of the vocabulary.

## B. Decision maker

Selecting a root exposure opens alternative Actions and a comparison of the **landscapes** they open: downstream reach, severe-but-unlikely items, low confidence, shared nodes, cycles. Nothing is labelled “best”. Presentation mode keeps the comparison on a large screen.

## C. Graph analyst

The demo and the tests cover branching, convergence on a shared exposure, reuse of a canonical Risk as two exposures, and directed cycles. Traversal is cycle-safe; membership uses strongly connected components. Betweenness is phrased as structural importance, with the number available.

## D. Meeting participant

Presentation mode hides editing chrome, keeps lenses and a legend, and remains pointer-friendly. Shape (rounded vs pill) survives from several metres. SVG export produces a still artefact of the same grammar.

## E. Critical methodologist

Ordinal products are labelled as a lens. Radar area is not a score. Confidence is inverted explicitly for the profile. Connectivity is not severity. Counter-risk is not a moral judgement. No composite “AI risk score” exists.

Residual v1 limits (deliberate): no multi-user, no Monte Carlo, no persistence dimension in the default UI, no automatic layout persistence unless the user exports or we later save `view_state`.
