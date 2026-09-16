import { create } from "zustand";
import { api } from "../api/client";
import type {
  ActionLandscape,
  AssessmentConfig,
  GraphBundle,
  LensId,
  Taxonomy,
} from "../api/types";

interface AppState {
  taxonomy: Taxonomy | null;
  config: AssessmentConfig | null;
  bundle: GraphBundle | null;
  loading: boolean;
  error: string | null;
  lens: LensId;
  selectedId: string | null;
  decisionActionId: string | null;
  highlighted: Set<string>;
  compare: ActionLandscape[] | null;
  presentation: boolean;
  theme: "dark" | "light";
  loadMeta: () => Promise<void>;
  loadGraph: (id: string) => Promise<void>;
  setLens: (lens: LensId) => void;
  select: (id: string | null) => void;
  setDecisionAction: (id: string | null) => void;
  setHighlighted: (ids: string[]) => void;
  togglePresentation: (on?: boolean) => void;
  toggleTheme: () => void;
  refreshCompare: (exposureId: string) => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  taxonomy: null,
  config: null,
  bundle: null,
  loading: false,
  error: null,
  lens: "exposure",
  selectedId: null,
  decisionActionId: null,
  highlighted: new Set(),
  compare: null,
  presentation: false,
  theme: "dark",
  loadMeta: async () => {
    const [taxonomy, config] = await Promise.all([api.taxonomy(), api.config()]);
    set({ taxonomy, config });
  },
  loadGraph: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const bundle = await api.bundle(id);
      const last = bundle.graph.view_state?.last_lens as LensId | undefined;
      set({
        bundle,
        loading: false,
        lens: last || get().lens,
        highlighted: new Set(),
        compare: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Failed to load" });
    }
  },
  setLens: (lens) => set({ lens }),
  select: (id) => set({ selectedId: id }),
  setDecisionAction: (id) => set({ decisionActionId: id, lens: id ? "decision" : get().lens }),
  setHighlighted: (ids) => set({ highlighted: new Set(ids) }),
  togglePresentation: (on) =>
    set((s) => ({ presentation: on === undefined ? !s.presentation : on })),
  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
      return { theme };
    }),
  refreshCompare: async (exposureId) => {
    const bundle = get().bundle;
    if (!bundle) return;
    const compare = await api.compare(bundle.graph.id, exposureId);
    set({ compare });
  },
}));
