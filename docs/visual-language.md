# Visual language

Someone several metres from a projector should see **object type**, **direction**, and **which lens is on**. Colour is never the only channel.

## Object type by shape

| Object | Shape | Why |
| --- | --- | --- |
| Risk exposure | Rounded rectangle | A state of the world; a card you can read |
| Action | Pill / lozenge | A decision; clearly not a risk even in greyscale |

Colour-vision deficiency still leaves shape, label, and the “Risk exposure” / “Action” kicker.

## Lenses

The same graph, one concern at a time.

1. **Exposure** — sequential fill from the likelihood × impact band, plus the numeric `L × I` badge.
2. **Impact** — fill and border weight follow impact, so a rare catastrophe still reads as heavy.
3. **Urgency** — inner ring proximity, outer ring velocity. No pulsing animation.
4. **Uncertainty** — dashed, hatched border. Texture, not hue.
5. **Connectivity** — border weight from betweenness; badges for convergence, cycles, centrality.
6. **Decision path** — the chosen action’s downstream landscape stays bright; other branches recede to ~20% opacity. They are not deleted.

Keys `1`–`6` switch lenses.

## Colour

Not the green / amber / red heatmap.

A **sequential, lightness-carrying** scale inspired by cividis (blue → sand). High concern is lighter/warmer on the dark canvas so it survives projection. Light theme inverts the surfaces but keeps the same band tokens.

Hue is paired with: numbers, labels, shape, border treatment, and (for uncertainty) hatch.

## Edges

Directed arrows. The semantic verb is written on the edge. Family (response / effect / causal) may tint the stroke; the word remains.

## Radar

Used in the detail drawer, not stuffed into every node. Tiny in-node glyphs were tried and rejected as clutter at meeting distance.

## Presentation mode

Hides editing chrome, maximises the canvas, keeps the legend and lens switcher, remains mouse- and pointer-friendly. SVG export draws the same grammar (rounded exposures, pill actions, labelled arrows) as a vector artefact.

## Accessibility

- WCAG-oriented contrast on surfaces and focus rings
- Keyboard: nodes are focusable; Enter selects; Escape clears; `/` is the search field
- Tooltips on focus as well as hover
- A visually hidden textual graph lists every relationship
- `prefers-reduced-motion` disables animation (none is required)
