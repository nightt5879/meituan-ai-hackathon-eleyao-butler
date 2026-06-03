import { describe, expect, it } from "vitest";
import { normalizeRecommendation } from "@/lib/server/openclawRecommendation";
import type { MockRestaurant } from "@/lib/types";
import { makeParticipant, makeTask } from "./helpers";

function makeReal(id: string, name: string, price: number): MockRestaurant {
  return {
    restaurant_id: id,
    name,
    category: "餐厅",
    avg_price: price,
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
    tags: ["真实标签"]
  };
}

const task = makeTask();
const participants = [makeParticipant()];
const real = [makeReal("r1", "真实A", 50), makeReal("r2", "真实B", 60)];

describe("normalizeRecommendation backfill", () => {
  it("overrides LLM-fabricated facts with the server's authoritative candidate data", () => {
    const raw = {
      candidates: [
        { restaurant_id: "r1", name: "AI乱编的名字", avg_price: 999, reason: "AI 的理由" },
        { restaurant_id: "r2", name: "真实B", avg_price: 60, reason: "ok" }
      ],
      final_choice: { restaurant_id: "r1" },
      group_message: "去 r1",
      normal_ai_message: "普通AI"
    };
    const result = normalizeRecommendation(raw, task, participants, real);
    const first = result.candidates[0];
    expect(first.name).toBe("真实A"); // not "AI乱编的名字"
    expect(first.avg_price).toBe(50); // not 999
    expect(first.reason).toBe("AI 的理由"); // LLM reasoning is preserved
    expect(result.final_choice.name).toBe("真实A");
  });

  it("keeps a hallucinated restaurant id without crashing", () => {
    const raw = {
      candidates: [
        { restaurant_id: "ghost", name: "幻觉店", avg_price: 70 },
        { restaurant_id: "r1", name: "真实A", avg_price: 50 }
      ],
      final_choice: { restaurant_id: "r1" }
    };
    const result = normalizeRecommendation(raw, task, participants, real);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.some((candidate) => candidate.name === "幻觉店")).toBe(true);
  });

  it("throws when the model returns fewer than 2 candidates", () => {
    const raw = { candidates: [{ restaurant_id: "r1", name: "真实A" }], final_choice: { restaurant_id: "r1" } };
    expect(() => normalizeRecommendation(raw, task, participants, real)).toThrow();
  });
});
