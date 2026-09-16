export type NodeKind = "exposure" | "action";

export interface ScaleLevel {
  value: number;
  name: string;
  definition: string;
}

export interface ScaleDefinition {
  id: string;
  title: string;
  description: string;
  teach: string;
  levels: ScaleLevel[];
}

export interface ImpactDimension {
  id: string;
  label: string;
  definition: string;
  enabled: boolean;
}

export interface AssessmentConfig {
  likelihood: ScaleDefinition;
  impact: ScaleDefinition;
  proximity: ScaleDefinition;
  velocity: ScaleDefinition;
  confidence: ScaleDefinition;
  persistence: ScaleDefinition;
  persistence_enabled: boolean;
  impact_dimensions: ImpactDimension[];
  overall_impact_rule: "user_set" | "max_dimension";
}

export interface ImpactAssessment {
  overall: number | null;
  dimensions: Record<string, number>;
  overall_source: "user" | "derived_max";
}

export interface ExposureScore {
  likelihood: number | null;
  impact: number | null;
  score: number | null;
  band: string | null;
  caveat: string;
}

export interface DecisionGraph {
  id: string;
  title: string;
  description: string;
  objective: string;
  focal_exposure_ids: string[];
  view_state: {
    positions: Record<string, { x: number; y: number }>;
    last_lens: string | null;
    last_focus_node: string | null;
  };
  created_at: string;
  modified_at: string;
}

export interface Risk {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  notes: string;
  created_at: string;
  modified_at: string;
}

export interface RiskExposure {
  id: string;
  graph_id: string;
  risk_id: string;
  contextual_description: string;
  likelihood: number | null;
  impact: ImpactAssessment;
  proximity: number | null;
  velocity: number | null;
  confidence: number | null;
  persistence: number | null;
  quantitative_likelihood: unknown;
  assumptions: string;
  evidence: string;
  owner: string;
  status: string;
  created_at: string;
  modified_at: string;
  exposure: ExposureScore;
  uncertainty: number | null;
  risk_title: string | null;
}

export interface Action {
  id: string;
  graph_id: string;
  title: string;
  description: string;
  treatment_category: string;
  custom_category: string;
  decision_status: string;
  rationale: string;
  cost_effort: string;
  assumptions: string;
  created_at: string;
  modified_at: string;
}

export interface Relationship {
  id: string;
  graph_id: string;
  source_kind: NodeKind;
  source_id: string;
  target_kind: NodeKind;
  target_id: string;
  semantics: string;
  custom_label: string;
  directed: boolean;
  notes: string;
  created_at: string;
  modified_at: string;
}

export interface NodeMetrics {
  node_id: string;
  kind: string;
  in_degree: number;
  out_degree: number;
  branching_factor: number;
  downstream_risk_count: number;
  upstream_risk_count: number;
  component_size: number;
  is_convergence: boolean;
  incoming_action_paths: number;
  cycle_member: boolean;
  cycle_ids: string[];
  depth_from_focal: number | null;
  shortest_path_from_focal: string[] | null;
  degree_centrality: number;
  betweenness_centrality: number;
  structurally_important: boolean;
  high_downstream_reach: boolean;
}

export interface Insight {
  code: string;
  title: string;
  statement: string;
  explanation: string;
  node_id: string | null;
  values: Record<string, unknown>;
  kind: string;
}

export interface CycleRecord {
  id: string;
  node_ids: string[];
  labels: string[];
  statement: string;
}

export interface GraphAnalysis {
  node_count: number;
  exposure_count: number;
  action_count: number;
  relationship_count: number;
  weakly_connected_component_sizes: number[];
  cycles: CycleRecord[];
  convergence_points: string[];
  repeated_canonical_risks: Array<{
    risk_id: string;
    risk_title: string;
    count: number;
    exposures: Array<Record<string, unknown>>;
  }>;
  metrics: Record<string, NodeMetrics>;
  insights: Insight[];
  focal_ids: string[];
}

export interface GraphBundle {
  graph: DecisionGraph;
  risks: Risk[];
  exposures: RiskExposure[];
  actions: Action[];
  relationships: Relationship[];
  analysis: GraphAnalysis;
  methodology_caveats: string[];
}

export interface ActionLandscape {
  action_id: string;
  action_title: string;
  treatment_category: string;
  decision_status: string;
  immediate_resulting_risks: number;
  downstream_reachable_risks: number;
  highest_exposure: {
    exposure_id: string;
    score: number;
    likelihood: number | null;
    impact: number | null;
    band: string | null;
  } | null;
  high_impact_low_likelihood: Array<Record<string, unknown>>;
  low_confidence: Array<Record<string, unknown>>;
  structurally_central_downstream: Array<Record<string, unknown>>;
  depth: number | null;
  cycles_entered: string[];
  shared_with: Record<string, string[]>;
  resulting_exposure_ids: string[];
  downstream_exposure_ids: string[];
  caveat: string;
}

export interface GlossaryEntry {
  id: string;
  term: string;
  short: string;
  distinction: string;
}

export interface Taxonomy {
  treatment_categories: string[];
  action_statuses: string[];
  exposure_statuses: string[];
  relationship_semantics: Record<
    string,
    {
      label: string;
      from_kinds: string[];
      to_kinds: string[];
      directed: boolean;
      family: string;
      help: string;
      counter_risk?: boolean;
    }
  >;
  glossary: GlossaryEntry[];
  lenses: Array<{ id: string; title: string; short: string }>;
}

export interface RegisterRow {
  exposure: RiskExposure;
  risk_title: string;
  graph_id: string;
  graph_title: string;
  linked_actions: string[];
}

export interface SearchHit {
  kind: "risk" | "exposure" | "action" | "relationship" | "graph";
  id: string;
  graph_id: string | null;
  title: string;
  subtitle: string;
}

export type LensId =
  | "exposure"
  | "impact"
  | "urgency"
  | "uncertainty"
  | "connectivity"
  | "decision";

export function nodeKey(kind: NodeKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseNodeKey(key: string): { kind: NodeKind; id: string } {
  const [kind, ...rest] = key.split(":");
  return { kind: kind as NodeKind, id: rest.join(":") };
}
