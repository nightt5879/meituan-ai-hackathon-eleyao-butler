import { describe, expect, it } from "vitest";
import { auditPlan, detectConflicts, extractParticipantConstraints, scoreCandidates } from "@/lib/mockFunctions";
import { makeParticipant, makeRestaurant, makeTask } from "./helpers";

describe("extractParticipantConstraints", () => {
  it("captures a no-spicy hard constraint and a budget soft preference", () => {
    const result = extractParticipantConstraints({ nickname: "甲", raw_preference: "不吃辣，预算50以内", manual_fields: {} });
    expect(result.hard_constraints).toContain("不吃辣");
    expect(result.soft_preferences.some((item) => item.includes("50"))).toBe(true);
  });
});

describe("auditPlan", () => {
  it("fails the diet check when a no-spicy member meets a spicy-only restaurant", () => {
    const noSpicy = makeParticipant({ extracted_constraints: { hard_constraints: ["不吃辣"], soft_preferences: [] } });
    const restaurant = makeRestaurant({ supports_non_spicy: false });
    const audit = auditPlan(restaurant, [noSpicy], makeTask({ budget_max: 100 }), { 甲: 80 });
    expect(audit.hard_rules.diet_check).toBe("fail");
    expect(audit.passed).toBe(false);
  });

  it("fails the fairness check when the lowest member satisfaction is too low", () => {
    const audit = auditPlan(makeRestaurant(), [makeParticipant()], makeTask(), { 甲: 80, 乙: 40 });
    expect(audit.soft_checks.fairness_check).toBe("fail");
  });
});

describe("detectConflicts", () => {
  it("flags a high-severity taste conflict between spicy and no-spicy members", () => {
    const spicy = makeParticipant({ participant_id: "a", nickname: "甲", extracted_constraints: { hard_constraints: [], soft_preferences: ["想吃辣"] } });
    const noSpicy = makeParticipant({ participant_id: "b", nickname: "乙", extracted_constraints: { hard_constraints: ["不吃辣"], soft_preferences: [] } });
    const conflicts = detectConflicts([spicy, noSpicy], 100);
    const taste = conflicts.find((conflict) => conflict.type === "taste");
    expect(taste?.severity).toBe("high");
  });
});

describe("scoreCandidates", () => {
  it("sorts audit-passing candidates ahead of failing ones", () => {
    const noSpicy = makeParticipant({ extracted_constraints: { hard_constraints: ["不吃辣"], soft_preferences: [] } });
    const ok = makeRestaurant({ restaurant_id: "ok", name: "有不辣", supports_non_spicy: true });
    const bad = makeRestaurant({ restaurant_id: "bad", name: "只有辣", supports_non_spicy: false });
    const ranked = scoreCandidates([bad, ok], [noSpicy], makeTask());
    expect(ranked[0].restaurant_id).toBe("ok");
    expect(ranked[0].audit.passed).toBe(true);
  });
});
