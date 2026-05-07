import type { DinnerTask } from "./types";

export const demoTaskId = "demo-dinner-001";

export const demoTask: DinnerTask = {
  task_id: demoTaskId,
  title: "明晚三人学校附近约饭",
  creator_name: "小林",
  raw_request: "明晚三个人想在学校附近吃饭，人均 100 以内，适合聊天，别太吵。",
  location_text: "学校附近",
  expected_people_count: 3,
  dinner_time: "明晚 18:30",
  status: "done",
  share_url: "/dinner/demo-dinner-001/fill",
  global_constraints: {
    budget_max: 100,
    location: "学校附近",
    scene: "dinner",
    people_count: 3,
    atmosphere: ["适合聊天", "不要太吵"]
  },
  participants: [
    {
      participant_id: "p_001",
      nickname: "小林",
      raw_preference: "我想吃辣，但不想吃火锅。",
      manual_fields: {
        spicy_preference: "spicy"
      },
      extracted_constraints: {
        hard_constraints: [],
        soft_preferences: ["想吃辣", "不想火锅"]
      }
    },
    {
      participant_id: "p_002",
      nickname: "阿杰",
      raw_preference: "我完全不吃辣，预算最好别超过 80。",
      manual_fields: {
        budget_max: 80,
        spicy_preference: "no_spicy"
      },
      extracted_constraints: {
        hard_constraints: ["完全不吃辣"],
        soft_preferences: ["预算最好不超过 80 元"]
      }
    },
    {
      participant_id: "p_003",
      nickname: "小周",
      raw_preference: "我 8 点半前要回宿舍，最好别排队，离学校近一点。",
      manual_fields: {
        leave_before: "20:30",
        spicy_preference: "any"
      },
      extracted_constraints: {
        hard_constraints: ["20:30 前回宿舍"],
        soft_preferences: ["排队风险低", "离学校近"]
      }
    }
  ],
  conflicts: [
    {
      type: "taste",
      severity: "high",
      description: "小林想吃辣，但阿杰完全不吃辣。",
      resolution_strategy: "优先保证不吃辣硬约束，选择可选辣度或同时有辣/不辣菜的餐厅。"
    },
    {
      type: "budget",
      severity: "medium",
      description: "总预算是人均 100，但阿杰更希望不超过 80。",
      resolution_strategy: "首推控制在人均 80-90，超过 100 的方案只能作为失败对照。"
    },
    {
      type: "time",
      severity: "high",
      description: "小周 20:30 前要回宿舍，不能太远，也不能排队太久。",
      resolution_strategy: "优先选择步行 15 分钟内、排队风险 low、营业时间覆盖晚餐的餐厅。"
    }
  ],
  candidates: [
    {
      restaurant_id: "r_001",
      name: "东门小院融合菜",
      category: "融合菜",
      avg_price: 82,
      distance_m: 950,
      walk_minutes: 12,
      open_time: "11:00",
      close_time: "22:00",
      supports_spicy: true,
      supports_non_spicy: true,
      is_hotpot: false,
      quiet_score: 4.5,
      chat_friendly: true,
      queue_risk: "low",
      rating: 4.7,
      member_scores: {
        小林: 82,
        阿杰: 94,
        小周: 90
      },
      score: 89,
      audit: {
        passed: true,
        hard_rules: {
          budget_check: "pass",
          diet_check: "pass",
          time_check: "pass",
          open_hours_check: "pass"
        },
        soft_checks: {
          atmosphere_check: "pass",
          queue_check: "pass",
          fairness_check: "pass"
        },
        llm_explanation:
          "这家店可选辣度，能满足小林想吃辣；同时有不辣菜，保护阿杰的硬约束。步行 12 分钟、排队风险低，小周 20:30 前回宿舍也可行。"
      },
      reason: "人均 82，步行 12 分钟，可选辣度，有不辣选项，环境安静，排队风险低。",
      tags: ["安静", "可选辣度", "适合聊天", "学校附近"]
    },
    {
      restaurant_id: "r_007",
      name: "南门轻食西餐",
      category: "轻食西餐",
      avg_price: 76,
      distance_m: 720,
      walk_minutes: 9,
      open_time: "10:00",
      close_time: "21:30",
      supports_spicy: false,
      supports_non_spicy: true,
      is_hotpot: false,
      quiet_score: 4.3,
      chat_friendly: true,
      queue_risk: "low",
      rating: 4.5,
      member_scores: {
        小林: 66,
        阿杰: 92,
        小周: 88
      },
      score: 82,
      audit: {
        passed: true,
        hard_rules: {
          budget_check: "pass",
          diet_check: "pass",
          time_check: "pass",
          open_hours_check: "pass"
        },
        soft_checks: {
          atmosphere_check: "pass",
          queue_check: "pass",
          fairness_check: "risk"
        },
        llm_explanation:
          "这家更稳、更便宜，也很近，但不能满足小林想吃辣的软偏好，所以适合作为保守备选。"
      },
      reason: "便宜、近、安静，硬约束全通过，但口味惊喜感较弱。",
      tags: ["便宜", "安静", "低排队", "保守备选"]
    },
    {
      restaurant_id: "r_011",
      name: "老街川味小馆",
      category: "川菜",
      avg_price: 108,
      distance_m: 520,
      walk_minutes: 7,
      open_time: "11:00",
      close_time: "23:00",
      supports_spicy: true,
      supports_non_spicy: false,
      is_hotpot: false,
      quiet_score: 3.2,
      chat_friendly: false,
      queue_risk: "medium",
      rating: 4.8,
      member_scores: {
        小林: 94,
        阿杰: 28,
        小周: 72
      },
      score: 58,
      audit: {
        passed: false,
        hard_rules: {
          budget_check: "fail",
          diet_check: "fail",
          time_check: "pass",
          open_hours_check: "pass"
        },
        soft_checks: {
          atmosphere_check: "fail",
          queue_check: "risk",
          fairness_check: "fail"
        },
        llm_explanation:
          "这家评分高且离学校近，但人均超过预算，又没有不辣选项，会直接伤害阿杰的硬约束，因此不能作为推荐。"
      },
      reason: "很近、评分高，但预算和忌口自检失败，用来展示普通推荐的风险。",
      tags: ["评分高", "近", "偏辣", "失败对照"]
    }
  ],
  final_choice: {
    restaurant_id: "r_001",
    name: "东门小院融合菜",
    reason:
      "没有违反任何硬约束，并且最低个人满意度最高。它在辣度、预算、距离、安静度和排队风险之间取得了最稳的平衡。",
    risks: ["阿杰的人均 80 预算会略微超出 2 元左右", "如果临时到店高峰，建议提前 10 分钟出发"],
    backup: "南门轻食西餐"
  },
  group_message:
    "我帮大家看了一下，推荐明晚 18:30 去「东门小院融合菜」。人均 82 左右，离学校步行 12 分钟，环境比较安静，有不辣菜也能选辣味，不用排太久，小周 20:30 前回宿舍也来得及。备选是「南门轻食西餐」，更稳但小林想吃辣会满足弱一点。大家 OK 的话我来约？",
  normal_ai_message:
    "附近评分高的川菜馆是「老街川味小馆」，评分 4.8，距离 520 米，可以考虑。"
};
