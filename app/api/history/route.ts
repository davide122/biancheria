import { NextResponse } from "next/server";
import { getItalyDayInfo } from "@/lib/day";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { dayKey } = getItalyDayInfo();

    const [products, dailyUsages] = await Promise.all([
      prisma.product.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          quantity: true,
          dirtyAmount: true,
        },
      }),
      prisma.dailyUsage.findMany({
        where: { dayKey },
        select: {
          productId: true,
          removedAmount: true,
        },
      }),
    ]);

    const usageMap = new Map(
      dailyUsages.map((usage) => [usage.productId, usage.removedAmount]),
    );

    const items = products.map((product) => ({
      id: product.id,
      name: product.name,
      quantity: product.quantity,
      dirtyAmount: product.dirtyAmount,
      usedToday: usageMap.get(product.id) ?? 0,
    }));

    const totalDirty = items.reduce((sum, item) => sum + item.dirtyAmount, 0);
    const totalUsedToday = items.reduce((sum, item) => sum + item.usedToday, 0);

    return NextResponse.json({
      dayKey,
      items,
      totalDirty,
      totalUsedToday,
    });
  } catch (error) {
    console.error("GET /api/history failed", error);

    return NextResponse.json(
      { error: "Impossibile caricare lo storico" },
      { status: 500 },
    );
  }
}
