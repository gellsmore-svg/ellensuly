from pydantic import BaseModel


class GlossaryEntry(BaseModel):
    id: str
    term: str
    short: str
    distinction: str = ""


GLOSSARY: dict[str, GlossaryEntry] = {
    "risk": GlossaryEntry(
        id="risk",
        term="Risk",
        short="The underlying thing that can go wrong, independent of any one decision.",
        distinction="A Risk can appear in several decision graphs. Its likelihood lives on each Exposure, not on the Risk itself.",
    ),
    "exposure": GlossaryEntry(
        id="exposure",
        term="Exposure",
        short="This risk as it exists in this particular decision context.",
        distinction="The same canonical Risk can have different likelihood, impact or confidence in different parts of a graph.",
    ),
    "action": GlossaryEntry(
        id="action",
        term="Action",
        short="A possible response to a risk. Actions can reduce one risk while changing others.",
        distinction="An action is a first-class object, not a note on a row. Choosing it selects a landscape, not just a mitigation.",
    ),
    "counter-risk": GlossaryEntry(
        id="counter-risk",
        term="Counter-risk",
        short="A risk introduced or changed by an action taken in response to another risk.",
        distinction="A counter-risk is not a verdict that the action is wrong. It is part of the landscape the decision creates.",
    ),
    "likelihood": GlossaryEntry(
        id="likelihood",
        term="Likelihood",
        short="How plausible this exposure is in this decision context.",
    ),
    "impact": GlossaryEntry(
        id="impact",
        term="Impact",
        short="How severe the consequences would be if the exposure materialises.",
        distinction="Overall impact follows the worst filled dimension unless you set it yourself. Incompatible consequences are never averaged.",
    ),
    "exposure-score": GlossaryEntry(
        id="exposure-score",
        term="Exposure score",
        short="Likelihood × impact, used as a familiar prioritisation lens.",
        distinction="On 1–5 ordinal scales, 20 is not twice 10. This is not the complete definition of risk.",
    ),
    "proximity": GlossaryEntry(
        id="proximity",
        term="Proximity",
        short="How soon this risk may become material.",
        distinction="Proximity asks when the risk may occur. Velocity asks how quickly the consequences arrive once it does.",
    ),
    "velocity": GlossaryEntry(
        id="velocity",
        term="Velocity",
        short="How quickly its consequences develop once it occurs.",
        distinction="Proximity asks when the risk may occur. Velocity asks how quickly the consequences arrive once it does.",
    ),
    "confidence": GlossaryEntry(
        id="confidence",
        term="Confidence",
        short="How strongly the available information supports this assessment.",
        distinction="Low confidence is not high likelihood. It means we may not know enough to trust the assessment strongly.",
    ),
    "uncertainty": GlossaryEntry(
        id="uncertainty",
        term="Uncertainty",
        short="The inverse of confidence, used so radar axes all mean: farther from centre = more concern.",
        distinction="uncertainty = 6 − confidence on the 1–5 scale. The transformation is explicit and reversible.",
    ),
    "persistence": GlossaryEntry(
        id="persistence",
        term="Persistence",
        short="How long an impact remains material after it occurs.",
        distinction="Optional in this release. The model already has a place for it.",
    ),
    "connectivity": GlossaryEntry(
        id="connectivity",
        term="Connectivity",
        short="How extensively this risk is connected to other parts of the decision graph.",
        distinction="Connectivity is not severity. A moderate risk can sit on many paths and still matter structurally.",
    ),
    "convergence": GlossaryEntry(
        id="convergence",
        term="Convergence",
        short="Several branches reach the same exposure.",
        distinction="Reuse of a canonical Risk is different: that may be several exposures of the same underlying risk, not one shared node.",
    ),
    "cycle": GlossaryEntry(
        id="cycle",
        term="Cycle",
        short="A path that feeds back into an earlier node.",
        distinction="Cycles are valid. Feedback can be an insight, not an error.",
    ),
    "decision-graph": GlossaryEntry(
        id="decision-graph",
        term="Decision graph",
        short="The map of risks, actions and relationships for one decision context.",
        distinction="The graph is the primary analytical object. The register is a familiar way to scan the same data.",
    ),
    "lens": GlossaryEntry(
        id="lens",
        term="Lens",
        short="A way of looking at the same graph so that one concern is visually emphasised.",
        distinction="No lens encodes every dimension at once. Switch lenses rather than overloading the picture.",
    ),
    "structurally-important": GlossaryEntry(
        id="structurally-important",
        term="Structurally important",
        short="This item lies on many paths through the graph.",
        distinction="The underlying measure is betweenness. It is not an 'AI risk score' and it is not severity.",
    ),
}


def glossary_list() -> list[GlossaryEntry]:
    return list(GLOSSARY.values())
