import type { ReactNode } from "react";
import { useApp } from "../state/store";

export function HelpTip({ id, children }: { id: string; children?: ReactNode }) {
  const entry = useApp((s) => s.taxonomy?.glossary.find((g) => g.id === id));
  if (!entry && !children) return null;
  const text = entry ? `${entry.short}${entry.distinction ? ` ${entry.distinction}` : ""}` : "";
  return (
    <button
      type="button"
      className="chip"
      title={text}
      aria-label={entry ? `${entry.term}: ${text}` : "Help"}
      style={{ padding: "0 6px", minWidth: 22, height: 22, lineHeight: "20px" }}
    >
      {children ?? "?"}
    </button>
  );
}

export function Teach({ id }: { id: string }) {
  const entry = useApp((s) => s.taxonomy?.glossary.find((g) => g.id === id));
  if (!entry) return null;
  return (
    <p className="help">
      <strong>{entry.term}.</strong> {entry.short}
      {entry.distinction ? ` ${entry.distinction}` : ""}
    </p>
  );
}
