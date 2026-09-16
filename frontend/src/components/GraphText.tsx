import { nodeKey } from "../api/types";
import { useApp } from "../state/store";

export function GraphText() {
  const bundle = useApp((s) => s.bundle);
  if (!bundle) return null;
  return (
    <section className="sr-only" aria-label="Textual graph">
      <p>
        {bundle.graph.title}. {bundle.exposures.length} risk exposures, {bundle.actions.length} actions,{" "}
        {bundle.relationships.length} relationships.
      </p>
      <ul>
        {bundle.relationships.map((r) => {
          const from =
            r.source_kind === "exposure"
              ? bundle.exposures.find((e) => e.id === r.source_id)?.risk_title
              : bundle.actions.find((a) => a.id === r.source_id)?.title;
          const to =
            r.target_kind === "exposure"
              ? bundle.exposures.find((e) => e.id === r.target_id)?.risk_title
              : bundle.actions.find((a) => a.id === r.target_id)?.title;
          return (
            <li key={r.id}>
              {from} {r.custom_label || r.semantics.replaceAll("_", " ")} {to}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SrOnlyStyle() {
  return (
    <style>{`
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0,0,0,0);
        white-space: nowrap;
        border: 0;
      }
    `}</style>
  );
}

export function nodeLabel(_id: string) {
  return nodeKey("exposure", _id);
}
