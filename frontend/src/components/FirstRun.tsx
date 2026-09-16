import { useState } from "react";

const STEPS = [
  {
    title: "Start with a risk",
    body: "A Risk is the underlying idea. An Exposure is that risk in this decision.",
  },
  {
    title: "Add a response",
    body: "Actions are first-class. Choosing one is choosing a landscape, not just a mitigation note.",
  },
  {
    title: "Follow what it creates",
    body: "A response can reduce one exposure and create, increase or expose others. That is the point.",
  },
  {
    title: "Switch lenses",
    body: "Exposure, impact, urgency, uncertainty and connectivity are separate concerns. Keys 1–6.",
  },
];

export function FirstRun() {
  const [step, setStep] = useState(() => (localStorage.getItem("ellensuly-seen") ? -1 : 0));
  if (step < 0 || step >= STEPS.length) return null;
  const current = STEPS[step];
  return (
    <aside className="hint-card" role="status">
      <div className="kicker">
        {step + 1} / {STEPS.length}
      </div>
      <strong>{current.title}</strong>
      <p className="help">{current.body}</p>
      <div className="row">
        <button
          className="btn"
          onClick={() => {
            localStorage.setItem("ellensuly-seen", "1");
            setStep(-1);
          }}
        >
          Skip
        </button>
        <button
          className="btn primary"
          onClick={() => {
            if (step === STEPS.length - 1) {
              localStorage.setItem("ellensuly-seen", "1");
              setStep(-1);
            } else setStep(step + 1);
          }}
        >
          {step === STEPS.length - 1 ? "Done" : "Next"}
        </button>
      </div>
    </aside>
  );
}
