export type TaskStatus =
  | "waiting_preferences"
  | "ready_to_recommend"
  | "recommending"
  | "done"
  | "failed";

export type ManualFields = {
  budget_max?: number;
  spicy_preference?: "spicy" | "no_spicy" | "any";
  leave_before?: string;
};

export type Participant = {
  participant_id: string;
  nickname: string;
  raw_preference: string;
  manual_fields: ManualFields;
  extracted_constraints: {
    hard_constraints: string[];
    soft_preferences: string[];
  };
};

export type Conflict = {
  type: "taste" | "budget" | "time" | "atmosphere";
  severity: "high" | "medium" | "low";
  description: string;
  resolution_strategy: string;
};

export type RestaurantCandidate = {
  restaurant_id: string;
  name: string;
  category: string;
  avg_price: number;
  distance_m: number;
  walk_minutes: number;
  open_time: string;
  close_time: string;
  supports_spicy: boolean;
  supports_non_spicy: boolean;
  is_hotpot: boolean;
  quiet_score: number;
  chat_friendly: boolean;
  queue_risk: "low" | "medium" | "high";
  rating: number;
  member_scores: Record<string, number>;
  score: number;
  audit: {
    passed: boolean;
    hard_rules: Record<string, "pass" | "fail" | "risk">;
    soft_checks: Record<string, "pass" | "fail" | "risk">;
    llm_explanation: string;
  };
  reason: string;
  tags: string[];
};

export type DinnerTask = {
  task_id: string;
  title: string;
  creator_name: string;
  raw_request: string;
  location_text: string;
  expected_people_count: number;
  dinner_time: string;
  status: TaskStatus;
  share_url: string;
  global_constraints: {
    budget_max: number;
    location: string;
    scene: "dinner";
    people_count: number;
    atmosphere: string[];
  };
  participants: Participant[];
  conflicts: Conflict[];
  candidates: RestaurantCandidate[];
  final_choice: {
    restaurant_id: string;
    name: string;
    reason: string;
    risks: string[];
    backup: string;
  };
  group_message: string;
  normal_ai_message: string;
};

export type StoredTaskFields = {
  creator_name: string;
  raw_request: string;
  location_text: string;
  expected_people_count: number;
  dinner_time: string;
  title?: string;
};

export type ParticipantInput = {
  nickname: string;
  raw_preference: string;
  manual_fields: ManualFields;
};

export type RecommendationState = {
  status: TaskStatus;
  hasGenerated: boolean;
  updated_at: string;
};
