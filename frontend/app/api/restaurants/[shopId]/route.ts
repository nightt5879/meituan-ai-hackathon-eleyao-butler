import { NextResponse } from "next/server";
import { getShopDetail } from "@/lib/restaurantData/searchService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ shopId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { shopId } = await params;
  const detail = await getShopDetail(shopId);

  if (!detail) {
    return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
