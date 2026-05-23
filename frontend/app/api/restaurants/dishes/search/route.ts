import { NextResponse } from "next/server";
import { searchDishes } from "@/lib/restaurantData/searchService";
import type { SearchDishesFilters } from "@/lib/restaurantData/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let filters: SearchDishesFilters = {};

  try {
    filters = (await request.json()) as SearchDishesFilters;
  } catch {
    filters = {};
  }

  const result = await searchDishes(filters);
  return NextResponse.json(result);
}
