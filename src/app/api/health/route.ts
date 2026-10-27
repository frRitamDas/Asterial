import { NextResponse } from "next/server";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      product: ASTERIAL_BRAND.name,
      version: ASTERIAL_BRAND.version,
      developer: ASTERIAL_BRAND.developer,
      attribution: ASTERIAL_BRAND.attribution,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
