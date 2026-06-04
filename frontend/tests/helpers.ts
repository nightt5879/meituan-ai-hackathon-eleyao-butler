import type { DinnerTask, MockRestaurant, Participant } from "@/lib/types";

export function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    participant_id: "p1",
    nickname: "甲",
    raw_preference: "",
    manual_fields: {},
    extracted_constraints: { hard_constraints: [], soft_preferences: [] },
    ...overrides
  };
}

export function makeTask(globalOverrides: Partial<DinnerTask["global_constraints"]> = {}): DinnerTask {
  return {
    task_id: "t1",
    title: "测试约饭",
    creator_name: "甲",
    raw_request: "",
    location_text: "大学城",
    expected_people_count: 3,
    dinner_time: "今晚",
    status: "ready_to_recommend",
    share_url: "",
    global_constraints: {
      budget_max: 100,
      location: "大学城",
      scene: "dinner",
      people_count: 3,
      atmosphere: [],
      ...globalOverrides
    },
    participants: [],
    conflicts: [],
    candidates: [],
    final_choice: { restaurant_id: "", name: "", reason: "", risks: [], backup: "" },
    group_message: "",
    normal_ai_message: ""
  };
}

export function makeRestaurant(overrides: Partial<MockRestaurant> = {}): MockRestaurant {
  return {
    restaurant_id: "m1",
    name: "测试店",
    category: "餐厅",
    avg_price: 60,
    distance_m: 800,
    walk_minutes: 10,
    open_time: "10:00",
    close_time: "22:00",
    supports_spicy: true,
    supports_non_spicy: true,
    is_hotpot: false,
    quiet_score: 4,
    chat_friendly: true,
    queue_risk: "low",
    rating: 4.5,
    tags: [],
    ...overrides
  };
}
