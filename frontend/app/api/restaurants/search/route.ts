import { NextResponse } from "next/server";
import { searchShops } from "@/lib/restaurantData/searchService";
import type { SearchShopsQuery } from "@/lib/restaurantData/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let query: SearchShopsQuery = {};

  try {
    query = (await request.json()) as SearchShopsQuery;
  } catch {
    query = {};
  }

  const result = await searchShops(query);
  return NextResponse.json(result);
}
