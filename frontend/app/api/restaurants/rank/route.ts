import { NextResponse } from "next/server";
import { rankShopsByPreference } from "@/lib/restaurantData/rankService";
import type { PreferenceSlots, UserMemory } from "@/lib/restaurantData/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RankRequest = {
  slots?: PreferenceSlots;
  userMemory?: UserMemory;
  limit?: number;
};

export async function POST(request: Request) {
  let input: RankRequest = {};

  try {
    input = (await request.json()) as RankRequest;
  } catch {
    input = {};
  }

  const result = await rankShopsByPreference(input.slots ?? {}, input.userMemory ?? {}, input.limit ?? 5);
  return NextResponse.json(result);
}
