import { describe, expect, it } from "vitest";
import { buildGroupRestaurantCandidates, summarizeGroupConstraints } from "@/lib/server/groupRestaurantCandidates";
import { makeParticipant, makeTask } from "./helpers";

describe("summarizeGroupConstraints", () => {
  it("takes the lowest personal budget, capped by the global budget", () => {
    const task = makeTask({ budget_max: 100 });
    const participants = [
      makeParticipant({ participant_id: "a", manual_fields: { budget_max: 60 } }),
      makeParticipant({ participant_id: "b", manual_fields: { budget_max: 40 } })
    ];
    expect(summarizeGroupConstraints(task, participants).budgetMax).toBe(40);
  });

  it("requires non-spicy only when someone has a no-spicy hard constraint", () => {
    const task = makeTask();
    const withNoSpicy = [makeParticipant({ extracted_constraints: { hard_constraints: ["不吃辣"], soft_preferences: [] } })];
    const withoutNoSpicy = [makeParticipant({ extracted_constraints: { hard_constraints: [], soft_preferences: ["想吃辣"] } })];
    expect(summarizeGroupConstraints(task, withNoSpicy).requireNonSpicy).toBe(true);
    expect(summarizeGroupConstraints(task, withoutNoSpicy).requireNonSpicy).toBe(false);
  });

  it("caps walk minutes when someone has a leave-before deadline", () => {
    const task = makeTask();
    const participants = [makeParticipant({ manual_fields: { leave_before: "21:00" } })];
    expect(summarizeGroupConstraints(task, participants).maxWalkMinutes).toBe(15);
  });
});

describe("buildGroupRestaurantCandidates (real dataset)", () => {
  it("never surfaces a spicy-only shop when someone cannot eat spicy", async () => {
    const task = makeTask({ budget_max: 100 });
    const participants = [
      makeParticipant({ participant_id: "a", extracted_constraints: { hard_constraints: ["不吃辣"], soft_preferences: [] } }),
      makeParticipant({ participant_id: "b" })
    ];
    const candidates = await buildGroupRestaurantCandidates(task, participants);
    expect(candidates.length).toBeGreaterThanOrEqual(4);
    for (const candidate of candidates) {
      expect(candidate.supports_non_spicy).toBe(true);
    }
  });

  it("keeps every candidate within budget+tolerance when the compliant pool is large", async () => {
    // budget 100 -> tolerance 25 -> <=125; the compliant pool is far larger than the limit,
    // so no over-budget relaxed-fill candidate should leak in.
    const task = makeTask({ budget_max: 100 });
    const candidates = await buildGroupRestaurantCandidates(task, [makeParticipant()]);
    for (const candidate of candidates) {
      expect(candidate.avg_price).toBeLessThanOrEqual(125);
    }
  });

  it("emits only real dataset ids, never fabricated openclaw_* ids", async () => {
    const candidates = await buildGroupRestaurantCandidates(makeTask(), [makeParticipant()]);
    for (const candidate of candidates) {
      expect(candidate.restaurant_id.length).toBeGreaterThan(0);
      expect(candidate.restaurant_id.startsWith("openclaw_")).toBe(false);
    }
  });
});
