# Risk methodology

Ellensúly keeps the traditional likelihood × impact entry point and then refuses to let it become the whole of risk.

## Scales

Default qualitative scales are 1–5, named and defined in `assessment_config`. They are configurable.

| Dimension | Asks |
| --- | --- |
| Likelihood | How plausible is this exposure **in this context**? |
| Impact | How severe would the consequences be? |
| Proximity | How soon could it become material? |
| Velocity | How quickly do consequences develop **once it occurs**? |
| Confidence | How strongly does the information support the assessment? |
| Persistence | How long does the impact remain? Optional in v1; the field already exists. |

Proximity is not velocity. Confidence is not likelihood.

## Impact dimensions

Financial, schedule, operational, quality, customer, legal, reputation, safety, security, environmental, people/capacity.

Dimensions are optional. If overall impact is omitted, it is derived as the **maximum** of filled dimensions. Incompatible consequences are never averaged: a safety 5 and a financial 1 is not a 3.

## Exposure score

`score = likelihood × impact` on the ordinal 1–5 scales, banded for display.

This is a **prioritisation lens**. A score of 20 is not scientifically twice a score of 10. The API attaches that caveat to every score.

## Uncertainty transform

For the radar profile, `uncertainty = 6 − confidence` so that every axis means: farther from the centre = more concern. The transform is explicit and reversible. Low confidence is not high probability.

## Radar profile

Fixed axis order: Likelihood, Impact, Immediacy (proximity), Velocity, Uncertainty.

The polygon is a **shape**, not an aggregate. Area is not a score. Typical shapes: catastrophic-but-unlikely; likely-but-slow; moderate-but-immediate; poorly understood; uniformly elevated.

## Graph as instrument

Calculated, cycle-safe, and labelled as structure rather than AI:

- downstream / upstream reachable exposure counts
- convergence (two or more incoming action paths)
- repeated canonical Risks
- cycle membership via strongly connected components
- shortest path from a focal exposure
- degree and betweenness centrality, phrased as “structurally important” when useful

None of these is combined into a composite “AI risk score”.

## Comparing actions

For alternative Actions on an exposure, Ellensúly reports the **landscapes**:

- immediate and downstream reachable risks
- highest individual exposure (with the ordinal caveat)
- high-impact, low-likelihood items
- low-confidence assessments
- structurally central downstream nodes
- cycles entered
- exposures shared with other options

It does not declare a winner. Summing ordinal scores across a branch is forbidden.

## Future quantitative room

Optional `quantitative_likelihood` already accepts point, range, frequency, or an opaque distribution payload. v1 does not run Monte Carlo, expected loss, or influence diagrams. The schema does not block them.

## Safeguards

- Do not treat radar area as severity.
- Do not treat connectivity as severity.
- Do not treat low confidence as high likelihood.
- Do not infer causality from layout proximity.
- Do not assume every semantic relationship has the same strength.
