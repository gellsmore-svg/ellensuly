import type { ActionLandscape } from "../api/types";
import { Teach } from "./HelpTip";

export function ComparePanel({
  landscapes,
  onChoose,
}: {
  landscapes: ActionLandscape[];
  onChoose: (actionId: string) => void;
}) {
  if (landscapes.length < 2) return null;
  return (
    <section>
      <h3 className="kicker">Alternative landscapes</h3>
      <p className="help">{landscapes[0]?.caveat}</p>
      <Teach id="counter-risk" />
      <div style={{ display: "grid", gap: 8 }}>
        {landscapes.map((land) => (
          <article className="insight" key={land.action_id}>
            <strong>
              {land.action_title}{" "}
              <span className="help">
                ({land.treatment_category}, {land.decision_status.replaceAll("_", " ")})
              </span>
            </strong>
            <ul className="help">
              <li>Immediate resulting risks: {land.immediate_resulting_risks}</li>
              <li>Downstream reachable risks: {land.downstream_reachable_risks}</li>
              <li>
                Highest individual exposure:{" "}
                {land.highest_exposure
                  ? `${land.highest_exposure.score} (L${land.highest_exposure.likelihood} × I${land.highest_exposure.impact})`
                  : "—"}
              </li>
              <li>High-impact, low-likelihood: {land.high_impact_low_likelihood.length}</li>
              <li>Low-confidence assessments: {land.low_confidence.length}</li>
              <li>Structurally central downstream: {land.structurally_central_downstream.length}</li>
              <li>Cycles entered: {land.cycles_entered.length || "none"}</li>
              <li>
                Shared with other options:{" "}
                {Object.keys(land.shared_with).length
                  ? Object.entries(land.shared_with)
                      .map(([id, exps]) => `${exps.length} with ${landscapes.find((l) => l.action_id === id)?.action_title ?? id}`)
                      .join("; ")
                  : "none"}
              </li>
            </ul>
            <button className="btn" onClick={() => onChoose(land.action_id)}>
              Show this landscape
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
