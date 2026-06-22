import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await prisma.product.updateMany({
      data: {
        dirtyAmount: 0,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/history/pickup failed", error);

    return NextResponse.json(
      { error: "Impossibile registrare il ritiro" },
      { status: 500 },
    );
  }
}
